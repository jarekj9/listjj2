import uuid

from fastapi import APIRouter

from .. import services
from ..deps import CurrentUser, DbSession
from ..schemas import CategoryIn, CategoryOut, RecentCategoryIn, RecentCategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(user: CurrentUser, db: DbSession) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in services.list_categories(db, user.id)]


@router.post("", response_model=CategoryOut)
def upsert_category(body: CategoryIn, user: CurrentUser, db: DbSession) -> CategoryOut:
    category = services.upsert_category(db, user.id, body.id, body.name, body.description)
    return CategoryOut.model_validate(category)


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    services.delete_category(db, user.id, category_id)


@router.get("/recent", response_model=RecentCategoryOut)
def get_recent_category(user: CurrentUser, db: DbSession) -> RecentCategoryOut:
    return RecentCategoryOut(category_id=services.get_recent_category_id(db, user))


@router.put("/recent", response_model=RecentCategoryOut)
def set_recent_category(body: RecentCategoryIn, user: CurrentUser, db: DbSession) -> RecentCategoryOut:
    services.set_recent_category(db, user, body.category_id)
    return RecentCategoryOut(category_id=body.category_id)
