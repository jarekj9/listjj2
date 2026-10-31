"""Business logic shared by REST routers, the external API and the MCP server.

All functions take an explicit user_id and enforce ownership. They raise
NotFound / BadRequest / Unauthorized, which main.py maps to HTTP errors.
"""

import csv
import datetime as dt
import hmac
import io
import math
import unicodedata
import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload, undefer

from . import security
from .config import get_settings
from .models import Category, File, Item, User, utcnow
from .schemas import ItemIn

ROLE_USER = "User"
ROLE_ADMIN = "Admin"
ROLES = (ROLE_USER, ROLE_ADMIN)
CSV_HEADER = ["SequenceNumber", "Value", "Name", "Description", "Category", "Active", "Tags"]


class NotFound(Exception):
    pass


class BadRequest(Exception):
    pass


class Unauthorized(Exception):
    pass


# ---------- users & auth ----------
def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def get_user_by_api_key(db: Session, key: str) -> User | None:
    try:
        parsed = uuid.UUID(key.strip())
    except (ValueError, AttributeError):
        return None
    user = db.scalar(select(User).where(User.api_key == parsed))
    if user is None or user.role not in ROLES:
        return None
    return user


def register(db: Session, email: str, password: str, admin_bootstrap_token: str | None = None) -> User:
    email = normalize_email(email)
    if get_user_by_email(db, email):
        raise BadRequest("Account with this email already exists.")
    settings = get_settings()
    is_admin_address = bool(settings.admin_email) and email == settings.admin_email
    if is_admin_address:
        if not settings.admin_bootstrap_token:
            raise BadRequest("Admin bootstrap is not configured.")
        if not admin_bootstrap_token or not hmac.compare_digest(
            admin_bootstrap_token, settings.admin_bootstrap_token
        ):
            raise BadRequest("A valid admin bootstrap token is required for this address.")
    role = ROLE_ADMIN if is_admin_address else None
    user = User(
        id=uuid.uuid4(), email=email, password_hash=security.hash_password(password), role=role, created=utcnow()
    )
    db.add(user)
    db.commit()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if user is None or not security.verify_password(password, user.password_hash):
        raise Unauthorized("Username and password are invalid.")
    return user


def login_external(db: Session, provider: str, token: str) -> User:
    try:
        email = security.verify_external_id_token(provider, token)
    except ValueError as exc:
        raise Unauthorized(str(exc)) from exc
    user = get_user_by_email(db, email)
    if user is None:
        if email == get_settings().admin_email:
            raise Unauthorized("Create the administrator account with the configured bootstrap token first.")
        role = None
        user = User(id=uuid.uuid4(), email=email, role=role, created=utcnow())
        db.add(user)
        db.commit()
    return user


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.email)))


def upsert_user(db: Session, user_id: uuid.UUID | None, email: str, password: str | None, role: str | None) -> User:
    email = normalize_email(email)
    role = role or None
    if role is not None and role not in ROLES:
        raise BadRequest(f"Unknown role '{role}'.")

    clash = get_user_by_email(db, email)
    if user_id:
        user = db.get(User, user_id)
        if user is None:
            if clash is not None:
                raise BadRequest("Account with this email already exists.")
            if not password:
                raise BadRequest("Password is required for a new user.")
            user = User(id=user_id, created=utcnow())
            db.add(user)
    else:
        if clash is not None:
            raise BadRequest("Account with this email already exists.")
        if not password:
            raise BadRequest("Password is required for a new user.")
        user = User(id=uuid.uuid4(), created=utcnow())
        db.add(user)

    if clash is not None and clash.id != user.id:
        raise BadRequest("Account with this email already exists.")
    if password:
        if len(password) < 6:
            raise BadRequest("Password must be at least 6 characters.")
        user.password_hash = security.hash_password(password)
    user.email = email
    user.role = role
    db.commit()
    return user


def delete_user(db: Session, admin: User, user_id: uuid.UUID) -> None:
    if user_id == admin.id:
        raise BadRequest("You cannot delete your own account.")
    user = db.get(User, user_id)
    if user is None:
        raise NotFound("User not found.")
    db.delete(user)
    db.commit()


def generate_api_key(db: Session, user: User) -> uuid.UUID:
    user.api_key = uuid.uuid4()
    db.commit()
    return user.api_key


def set_api_key(db: Session, user: User, raw_key: str) -> uuid.UUID:
    try:
        key = uuid.UUID(raw_key.strip())
    except ValueError as exc:
        raise BadRequest("API key must be a GUID.") from exc
    owner = db.scalar(select(User).where(User.api_key == key))
    if owner is not None and owner.id != user.id:
        raise BadRequest("This API key is already used by another account.")
    user.api_key = key
    db.commit()
    return key


# ---------- categories ----------
def get_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise NotFound("Category not found.")
    return category


def get_category_by_name(db: Session, user_id: uuid.UUID, name: str) -> Category | None:
    folded_name = name.strip().casefold()
    return next(
        (
            category
            for category in db.scalars(
                select(Category).where(Category.user_id == user_id).order_by(Category.created)
            )
            if category.name.casefold() == folded_name
        ),
        None,
    )


def list_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    return list(db.scalars(select(Category).where(Category.user_id == user_id).order_by(Category.name)))


def upsert_category(
    db: Session, user_id: uuid.UUID, category_id: uuid.UUID | None, name: str, description: str
) -> Category:
    name = name.strip()
    if not name:
        raise BadRequest("Category name is required.")
    if len(name) > 200:
        raise BadRequest("Category name must be at most 200 characters.")
    category = None
    if category_id:
        category = db.get(Category, category_id)
        if category is not None and category.user_id != user_id:
            raise NotFound("Category not found.")
    if category is None:
        category = Category(id=category_id or uuid.uuid4(), user_id=user_id, created=utcnow())
        db.add(category)
    category.name = name
    category.description = description or ""
    db.commit()
    return category


def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    category = get_category(db, user_id, category_id)
    db.delete(category)  # items are removed by the database cascade
    db.commit()


def get_recent_category_id(db: Session, user: User) -> uuid.UUID | None:
    if user.recent_category_id is None:
        return None
    category = db.get(Category, user.recent_category_id)
    if category is None or category.user_id != user.id:
        return None
    return category.id


def set_recent_category(db: Session, user: User, category_id: uuid.UUID | None) -> None:
    if category_id is not None:
        get_category(db, user.id, category_id)
    user.recent_category_id = category_id
    db.commit()


# ---------- items ----------
def _tags_to_text(tags: list[str]) -> str:
    cleaned = [t.strip().replace(",", " ") for t in tags]
    return ",".join(t for t in cleaned if t)


def _item_query(user_id: uuid.UUID):
    return (
        select(Item)
        .where(Item.user_id == user_id)
        .options(selectinload(Item.files), selectinload(Item.category))
    )


def get_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> Item:
    item = db.scalar(_item_query(user_id).where(Item.id == item_id))
    if item is None:
        raise NotFound("Item not found.")
    return item


def search_items(
    db: Session,
    user_id: uuid.UUID,
    q: str | None = None,
    category_id: uuid.UUID | None = None,
    date_from: dt.datetime | None = None,
    date_to: dt.datetime | None = None,
) -> list[Item]:
    stmt = _item_query(user_id)
    if category_id is not None:
        stmt = stmt.where(Item.category_id == category_id)
    if date_from is not None:
        stmt = stmt.where(Item.modified >= date_from)
    if date_to is not None:
        stmt = stmt.where(Item.modified <= date_to)
    items = list(db.scalars(stmt.order_by(Item.sequence_number)).all())
    for word in (q or "").split():
        exclude = word.startswith("!")
        term = (word[1:] if exclude else word).casefold()
        if not term:
            continue
        if exclude:
            items = [item for item in items if term not in f"{item.name} {item.tags}".casefold()]
        else:
            items = [item for item in items if term in f"{item.name} {item.tags}".casefold()]
    return items


def _next_sequence(db: Session, category_id: uuid.UUID) -> float:
    current_max = db.scalar(select(func.max(Item.sequence_number)).where(Item.category_id == category_id))
    return current_max + 1 if current_max is not None else 1.0


def save_item(db: Session, user_id: uuid.UUID, data: ItemIn) -> Item:
    name = data.name.strip()
    if not name:
        raise BadRequest("Item name is required.")
    if len(name) > 500:
        raise BadRequest("Item name must be at most 500 characters.")
    if not math.isfinite(data.value):
        raise BadRequest("Item value must be a finite number.")
    category = get_category(db, user_id, data.category_id)
    tags = _tags_to_text(data.tags)
    now = utcnow()

    existing = db.get(Item, data.id) if data.id else None
    if existing is not None and existing.user_id != user_id:
        raise NotFound("Item not found.")

    if existing is not None:
        item = existing
        if item.category_id != category.id:
            item.sequence_number = _next_sequence(db, category.id)
        item.category_id = category.id
        item.modified = now
    else:
        item = Item(
            id=data.id or uuid.uuid4(),
            user_id=user_id,
            category_id=category.id,
            sequence_number=_next_sequence(db, category.id),
            created=now,
            modified=now,
        )
        db.add(item)

    item.name = name
    item.description = data.description or ""
    item.value = data.value
    item.active = data.active
    item.tags = tags
    db.commit()
    return get_item(db, user_id, item.id)


def patch_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID, **changes) -> Item:
    """Partial update used by MCP: keys with value None are left unchanged."""
    item = get_item(db, user_id, item_id)
    values = {k: v for k, v in changes.items() if v is not None}
    return save_item(
        db,
        user_id,
        ItemIn(
            id=item.id,
            name=values.get("name", item.name),
            description=values.get("description", item.description),
            value=values.get("value", item.value),
            active=values.get("active", item.active),
            tags=values.get("tags", item.tag_list),
            category_id=values.get("category_id", item.category_id),
        ),
    )


def delete_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> None:
    item = get_item(db, user_id, item_id)
    db.delete(item)
    db.commit()


def move_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID, direction: str) -> bool:
    item = get_item(db, user_id, item_id)
    if direction == "up":
        condition = Item.sequence_number < item.sequence_number
        order = desc(Item.sequence_number)
    else:
        condition = Item.sequence_number > item.sequence_number
        order = Item.sequence_number
    neighbour = db.scalar(
        select(Item).where(Item.category_id == item.category_id, condition).order_by(order).limit(1)
    )
    if neighbour is None:
        return False
    item.sequence_number, neighbour.sequence_number = neighbour.sequence_number, item.sequence_number
    db.commit()
    return True


def sort_items_by_tags(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    category = get_category(db, user_id, category_id)
    items = list(db.scalars(select(Item).where(Item.category_id == category.id, Item.user_id == user_id)))
    items.sort(key=lambda i: (i.tags, i.sequence_number))
    for position, item in enumerate(items):
        item.sequence_number = float(position)
    db.commit()


def list_tags(db: Session, user_id: uuid.UUID, category_id: uuid.UUID | None = None) -> list[str]:
    stmt = select(Item.tags).where(Item.user_id == user_id)
    if category_id is not None:
        stmt = stmt.where(Item.category_id == category_id)
    tags: set[str] = set()
    for (text,) in db.execute(stmt):
        tags.update(t for t in text.split(",") if t)
    return sorted(tags)


# ---------- CSV ----------
def export_items_csv(db: Session, user_id: uuid.UUID) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\n")
    writer.writerow(CSV_HEADER)
    for item in search_items(db, user_id):
        writer.writerow(
            [
                item.sequence_number,
                item.value,
                item.name,
                item.description,
                item.category.name,
                str(item.active),
                ",".join(item.tag_list),
            ]
        )
    return buffer.getvalue()


def import_items_csv(db: Session, user_id: uuid.UUID, text: str) -> tuple[int, list[str]]:
    reader = csv.reader(io.StringIO(text), delimiter=";")
    next(reader, None)  # header
    categories: dict[str, Category] = {}
    imported = 0
    errors: list[str] = []
    for line_no, row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in row):
            continue
        row += [""] * (7 - len(row))
        try:
            name = row[2].strip()
            if not name:
                raise ValueError("empty name")
            if len(name) > 500:
                raise ValueError("item name exceeds 500 characters")
            value = float(row[1] or 0)
            sequence_number = float(row[0] or 0)
            if not math.isfinite(value) or not math.isfinite(sequence_number):
                raise ValueError("value and sequence number must be finite numbers")
            active = row[5].strip().lower() in ("true", "1", "yes")
            tags = _tags_to_text(row[6].replace(";", ",").split(","))
            category_name = row[4].strip() or "default"
            if len(category_name) > 200:
                raise ValueError("category name exceeds 200 characters")
            category_key = category_name.casefold()
            category = categories.get(category_key) or get_category_by_name(db, user_id, category_name)
            if category is None:
                category = Category(id=uuid.uuid4(), user_id=user_id, name=category_name, created=utcnow())
                db.add(category)
            categories[category_key] = category
            now = utcnow()
            db.add(
                Item(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    category_id=category.id,
                    name=name,
                    description=row[3],
                    value=value,
                    active=active,
                    tags=tags,
                    sequence_number=sequence_number,
                    created=now,
                    modified=now,
                )
            )
            imported += 1
        except ValueError as exc:
            errors.append(f"line {line_no}: {exc}")
    db.commit()
    return imported, errors


# ---------- files ----------
def sanitize_filename(filename: str | None) -> str:
    name = (filename or "file").replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(char for char in name if unicodedata.category(char)[0] != "C").strip()
    return (name or "file")[:500]


def add_file(db: Session, user_id: uuid.UUID, item_id: uuid.UUID, filename: str, content: bytes) -> File:
    item = get_item(db, user_id, item_id)
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise BadRequest(f"File exceeds {get_settings().max_upload_mb} MB limit.")
    file = File(
        id=uuid.uuid4(), item_id=item.id, name=sanitize_filename(filename), size=len(content), content=content
    )
    db.add(file)
    db.commit()
    return file


def get_file(db: Session, user_id: uuid.UUID, file_id: uuid.UUID) -> File:
    file = db.scalar(
        select(File)
        .join(Item, File.item_id == Item.id)
        .where(File.id == file_id, Item.user_id == user_id)
        .options(undefer(File.content))
    )
    if file is None:
        raise NotFound("File not found.")
    return file


def delete_file(db: Session, user_id: uuid.UUID, file_id: uuid.UUID) -> None:
    file = get_file(db, user_id, file_id)
    db.delete(file)
    db.commit()
