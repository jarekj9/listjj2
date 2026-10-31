"""MCP server (streamable HTTP, mounted at /mcp).

Every tool authenticates the caller with `Authorization: Bearer <user API key>`.
"""

import uuid

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from . import services
from .db import SessionLocal
from .models import User
from .schemas import ItemIn

INSTRUCTIONS = """
Listjj is a personal notes and todo-list application.

Data model:
- An authenticated user owns categories.
- A category contains zero or more notes or todo items.
- Each item belongs to exactly one category.
- Items have a name, description, numeric value, tags, and active status.

Use get_categories before add_item when the category ID is unknown. Never guess IDs.
For shopping-list requests, use the category named "zakupy". If it does not exist,
offer to create that category before adding shopping items.
Only operate on the authenticated user's data.
Deleting a category is destructive: it automatically deletes every item in that category.
Confirm destructive deletions with the user when appropriate.
"""

# Host-header (DNS rebinding) checks are disabled: the app is reached through LAN/reverse-proxy
# hostnames and every MCP request is authenticated with the user's API key instead.
mcp = FastMCP(
    "Listjj",
    instructions=INSTRUCTIONS,
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


def _authenticated_user(db, ctx: Context) -> User:
    request = ctx.request_context.request
    header = request.headers.get("authorization", "") if request is not None else ""
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    user = services.get_user_by_api_key(db, token) if token else None
    if user is None:
        raise PermissionError("Missing or invalid API key (send 'Authorization: Bearer <key>').")
    return user


def _resolve_category(db, user: User, category_id: str | None, category_name: str | None) -> uuid.UUID:
    if category_id:
        return uuid.UUID(category_id)
    if category_name and category_name.strip():
        category = services.get_category_by_name(db, user.id, category_name)
        if category is None:
            raise KeyError(f"Category '{category_name}' not found.")
        return category.id
    raise ValueError("Either category_id or category_name is required.")


def _category_dict(c) -> dict:
    return {"id": str(c.id), "name": c.name, "description": c.description}


def _item_dict(i) -> dict:
    return {
        "id": str(i.id),
        "name": i.name,
        "description": i.description,
        "value": i.value,
        "active": i.active,
        "tags": i.tag_list,
        "categoryId": str(i.category_id),
        "categoryName": i.category.name if i.category else "",
        "sequenceNumber": i.sequence_number,
    }


@mcp.tool(
    description="Creates a new category for the authenticated user. Categories group notes and todo items; each item belongs to exactly one category."
)
def add_category(
    ctx: Context,
    name: str,
    description: str = "",
) -> dict:
    """name: short category name, for example 'Shopping', 'Work', or 'Ideas'. description: optional purpose."""
    with SessionLocal() as db:
        user = _authenticated_user(db, ctx)
        category = services.upsert_category(db, user.id, None, name, description)
        return _category_dict(category)


@mcp.tool(description="Lists all categories owned by the authenticated user. Use this before adding an item when the category ID is not known.")
def get_categories(ctx: Context) -> list[dict]:
    with SessionLocal() as db:
        user = _authenticated_user(db, ctx)
        return [_category_dict(c) for c in services.list_categories(db, user.id)]


@mcp.tool(
    description="Creates a note or todo item inside an existing category owned by the authenticated user. Provide either category_id or category_name."
)
def add_item(
    ctx: Context,
    name: str,
    category_id: str | None = None,
    category_name: str | None = None,
    description: str = "",
    value: float = 0.0,
    tags: list[str] | None = None,
    active: bool = True,
) -> dict:
    """name: short note title or todo name. category_id: ID of the category (from get_categories).
    category_name: case-insensitive category name, used when category_id is not given.
    description: optional detailed note. value: optional number (price, quantity, score...).
    tags: optional labels. active: True for an open todo/note, False for completed or archived."""
    with SessionLocal() as db:
        user = _authenticated_user(db, ctx)
        cid = _resolve_category(db, user, category_id, category_name)
        item = services.save_item(
            db,
            user.id,
            ItemIn(
                name=name,
                description=description,
                value=value,
                tags=tags or [],
                active=active,
                category_id=cid,
            ),
        )
        return _item_dict(item)


@mcp.tool(
    description="Updates an existing note or todo item owned by the authenticated user. Omitted fields remain unchanged. An item can be moved to another owned category."
)
def update_item(
    ctx: Context,
    item_id: str,
    name: str | None = None,
    description: str | None = None,
    category_id: str | None = None,
    value: float | None = None,
    tags: list[str] | None = None,
    active: bool | None = None,
) -> dict:
    with SessionLocal() as db:
        user = _authenticated_user(db, ctx)
        item = services.patch_item(
            db,
            user.id,
            uuid.UUID(item_id),
            name=name,
            description=description,
            category_id=uuid.UUID(category_id) if category_id else None,
            value=value,
            tags=tags,
            active=active,
        )
        return _item_dict(item)


@mcp.tool(description="Permanently deletes a note or todo item owned by the authenticated user.")
def delete_item(ctx: Context, item_id: str) -> dict:
    with SessionLocal() as db:
        user = _authenticated_user(db, ctx)
        services.delete_item(db, user.id, uuid.UUID(item_id))
        return {"deleted": item_id}


@mcp.tool(
    description="Permanently deletes a category owned by the authenticated user and automatically deletes every item inside it. Confirm with the user before using this destructive operation."
)
def delete_category(ctx: Context, category_id: str) -> dict:
    with SessionLocal() as db:
        user = _authenticated_user(db, ctx)
        services.delete_category(db, user.id, uuid.UUID(category_id))
        return {"deleted": category_id}


@mcp.tool(
    description="Gets all notes and todo items belonging to a category owned by the authenticated user. Provide either category_id or category_name."
)
def get_items_by_category(
    ctx: Context,
    category_id: str | None = None,
    category_name: str | None = None,
) -> list[dict]:
    with SessionLocal() as db:
        user = _authenticated_user(db, ctx)
        cid = _resolve_category(db, user, category_id, category_name)
        services.get_category(db, user.id, cid)  # ownership check
        return [_item_dict(i) for i in services.search_items(db, user.id, category_id=cid)]
