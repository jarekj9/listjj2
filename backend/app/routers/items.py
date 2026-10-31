import datetime as dt
import uuid
from typing import Literal

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from .. import services
from ..config import get_settings
from ..deps import CurrentUser, DbSession
from ..models import Item
from ..schemas import FileOut, ImportOut, ItemIn, ItemOut, MoveOut
from ..uploads import read_upload_limited

router = APIRouter(tags=["items"])


def item_out(item: Item) -> ItemOut:
    return ItemOut(
        id=item.id,
        name=item.name,
        description=item.description,
        value=item.value,
        active=item.active,
        tags=item.tag_list,
        sequence_number=item.sequence_number,
        category_id=item.category_id,
        category_name=item.category.name if item.category else "",
        created=item.created,
        modified=item.modified,
        files=[FileOut(id=f.id, name=f.name, size=f.size) for f in item.files],
    )


@router.get("/items", response_model=list[ItemOut])
def list_items(
    user: CurrentUser,
    db: DbSession,
    q: str | None = None,
    category_id: uuid.UUID | None = None,
    date_from: dt.datetime | None = None,
    date_to: dt.datetime | None = None,
) -> list[ItemOut]:
    items = services.search_items(db, user.id, q, category_id, date_from, date_to)
    return [item_out(i) for i in items]


# must be declared before /items/{item_id}
@router.get("/items/export")
def export_items(user: CurrentUser, db: DbSession) -> Response:
    text = services.export_items_csv(db, user.id)
    return Response(
        content=text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="listjj-export.csv"'},
    )


@router.post("/items/import", response_model=ImportOut)
async def import_items(user: CurrentUser, db: DbSession, file: UploadFile = File(...)) -> ImportOut:
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    raw = await read_upload_limited(file, max_bytes, "CSV file")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded.") from exc
    imported, errors = services.import_items_csv(db, user.id, text)
    return ImportOut(imported=imported, errors=errors)


@router.get("/items/{item_id}", response_model=ItemOut)
def get_item(item_id: uuid.UUID, user: CurrentUser, db: DbSession) -> ItemOut:
    return item_out(services.get_item(db, user.id, item_id))


@router.post("/items", response_model=ItemOut)
def save_item(body: ItemIn, user: CurrentUser, db: DbSession) -> ItemOut:
    return item_out(services.save_item(db, user.id, body))


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    services.delete_item(db, user.id, item_id)


@router.post("/items/{item_id}/move", response_model=MoveOut)
def move_item(
    item_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    direction: Literal["up", "down"] = Query(...),
) -> MoveOut:
    return MoveOut(moved=services.move_item(db, user.id, item_id, direction))


@router.post("/items/sort-by-tags/{category_id}", status_code=204)
def sort_by_tags(category_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    services.sort_items_by_tags(db, user.id, category_id)


@router.get("/tags", response_model=list[str])
def list_tags(user: CurrentUser, db: DbSession, category_id: uuid.UUID | None = None) -> list[str]:
    return services.list_tags(db, user.id, category_id)
