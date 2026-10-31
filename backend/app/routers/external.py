"""Key-authenticated endpoints for simple clients (watches, scripts, shortcuts).

Authorization: Bearer <user API key>. Replaces the old /api/Listjj/* endpoints.
"""

from fastapi import APIRouter, HTTPException

from .. import services
from ..deps import ApiKeyUser, DbSession
from ..models import Item
from ..schemas import ExternalDeleteIn, ExternalItemIn, ItemIn, ItemOut
from .items import item_out

router = APIRouter(prefix="/external", tags=["external"])
legacy_router = APIRouter(prefix="/Listjj", tags=["legacy external API"])


@router.get("/items", response_model=list[ItemOut])
def all_items(user: ApiKeyUser, db: DbSession) -> list[ItemOut]:
    return [item_out(i) for i in services.search_items(db, user.id)]


@router.post("/items", response_model=ItemOut)
def upsert_item(body: ExternalItemIn, user: ApiKeyUser, db: DbSession) -> ItemOut:
    category = services.get_category_by_name(db, user.id, body.category_name)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    if body.id is not None and db.get(Item, body.id) is not None:
        # update: keep tags and active flag as they are
        item = services.patch_item(
            db,
            user.id,
            body.id,
            name=body.name,
            description=body.description,
            value=body.value,
            category_id=category.id,
        )
    else:
        item = services.save_item(
            db,
            user.id,
            ItemIn(
                id=body.id,
                name=body.name,
                description=body.description,
                value=body.value,
                category_id=category.id,
            ),
        )
    return item_out(item)


@router.post("/items/delete", status_code=204)
def delete_item(body: ExternalDeleteIn, user: ApiKeyUser, db: DbSession) -> None:
    services.delete_item(db, user.id, body.id)


@router.get("/categories/{name}/first-item", response_model=ItemOut)
def first_item_in_category(name: str, user: ApiKeyUser, db: DbSession) -> ItemOut:
    category = services.get_category_by_name(db, user.id, name)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    items = services.search_items(db, user.id, category_id=category.id)
    if not items:
        raise HTTPException(status_code=404, detail="List is empty.")
    return item_out(items[0])


def _legacy_api_key_user(key: str, db: DbSession):
    user = services.get_user_by_api_key(db, key)
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized access.")
    return user


@legacy_router.get("/GetValues")
def legacy_ping() -> dict[str, str]:
    return {"ping": "pong"}


@legacy_router.get("/GetAllListjj", response_model=list[ItemOut])
def legacy_all_items(user: ApiKeyUser, db: DbSession) -> list[ItemOut]:
    """Compatibility alias for clients using the original bearer-key endpoint."""
    return [item_out(item) for item in services.search_items(db, user.id)]


@legacy_router.get("/GetByCategoryName", response_model=ItemOut)
def legacy_first_item(name: str, key: str, db: DbSession) -> ItemOut:
    """Compatibility alias for the old Tizen client, which sends its key in the query string."""
    user = _legacy_api_key_user(key, db)
    category = services.get_category_by_name(db, user.id, name)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    items = services.search_items(db, user.id, category_id=category.id)
    if not items:
        raise HTTPException(status_code=404, detail="List is empty.")
    return item_out(items[0])


@legacy_router.post("/AddItem")
def legacy_add_item(body: ExternalItemIn, user: ApiKeyUser, db: DbSession) -> dict[str, str]:
    category = services.get_category_by_name(db, user.id, body.category_name)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    if body.id is not None and db.get(Item, body.id) is not None:
        services.patch_item(
            db,
            user.id,
            body.id,
            name=body.name,
            description=body.description,
            value=body.value,
            category_id=category.id,
        )
    else:
        services.save_item(
            db,
            user.id,
            ItemIn(
                id=body.id,
                name=body.name,
                description=body.description,
                value=body.value,
                category_id=category.id,
            ),
        )
    return {"status": "ok"}


@legacy_router.post("/DelItem")
def legacy_delete_item(body: ExternalDeleteIn, user: ApiKeyUser, db: DbSession) -> dict[str, str]:
    services.delete_item(db, user.id, body.id)
    return {"status": "Deleted."}
