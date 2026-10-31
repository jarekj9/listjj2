import uuid

from fastapi import APIRouter

from .. import services
from ..deps import AdminUser, CurrentUser, DbSession
from ..schemas import AdminUserOut, UserIn

router = APIRouter(tags=["users"])


def _out(user) -> AdminUserOut:
    return AdminUserOut(id=user.id, email=user.email, role=user.role)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(_: AdminUser, db: DbSession) -> list[AdminUserOut]:
    return [_out(u) for u in services.list_users(db)]


@router.post("/users", response_model=AdminUserOut)
def upsert_user(body: UserIn, _: AdminUser, db: DbSession) -> AdminUserOut:
    user = services.upsert_user(db, body.id, body.email, body.password, body.role)
    return _out(user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: uuid.UUID, admin: AdminUser, db: DbSession) -> None:
    services.delete_user(db, admin, user_id)


@router.get("/roles", response_model=list[str])
def list_roles(_: CurrentUser) -> list[str]:
    return list(services.ROLES)
