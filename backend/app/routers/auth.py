import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from .. import security, services
from ..deps import CurrentUser, DbSession, get_current_user
from ..models import User
from ..schemas import ApiKeyIn, ApiKeyOut, LoginIn, RegisterIn, RegisterOut, TokenOut, UserOut
from ..services import BadRequest, Unauthorized

router = APIRouter(prefix="/auth", tags=["auth"])
settings_router = APIRouter(prefix="/settings/api-key", tags=["settings"])


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, role=user.role, api_key=user.api_key)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DbSession) -> TokenOut:
    try:
        if body.google_jwt:
            user = services.login_external(db, "google", body.google_jwt)
        elif body.microsoft_jwt:
            user = services.login_external(db, "microsoft", body.microsoft_jwt)
        elif body.email and body.password:
            user = services.authenticate(db, body.email, body.password)
        else:
            raise BadRequest("Email and password, or an identity token, are required.")
    except Unauthorized as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return TokenOut(token=security.create_access_token(user.id, user.email, user.role))


@router.post("/register", response_model=RegisterOut)
def register(body: RegisterIn, db: DbSession) -> RegisterOut:
    user = services.register(db, body.email, body.password, body.admin_bootstrap_token)
    message = (
        "Administrator account created. You can now sign in."
        if user.role == services.ROLE_ADMIN
        else "Account created. An administrator must approve it before you can use the app."
    )
    return RegisterOut(message=message)


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return _user_out(user)


@settings_router.get("", response_model=ApiKeyOut)
def get_api_key(user: CurrentUser) -> ApiKeyOut:
    return ApiKeyOut(api_key=user.api_key)


@settings_router.post("/generate", response_model=ApiKeyOut)
def generate_api_key(user: CurrentUser, db: DbSession) -> ApiKeyOut:
    return ApiKeyOut(api_key=services.generate_api_key(db, user))


@settings_router.put("", response_model=ApiKeyOut)
def set_api_key(body: ApiKeyIn, user: CurrentUser, db: DbSession) -> ApiKeyOut:
    return ApiKeyOut(api_key=services.set_api_key(db, user, str(body.api_key)))
