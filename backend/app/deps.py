import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import security, services
from .db import get_db
from .models import User
from .services import ROLE_ADMIN, ROLES

_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if creds is None:
        raise _unauthorized("Not authenticated.")
    try:
        claims = security.decode_access_token(creds.credentials)
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid or expired token.") from exc
    user = db.get(User, uuid.UUID(claims["sub"]))
    if user is None:
        raise _unauthorized("User no longer exists.")
    return user


def get_approved_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in ROLES:
        raise HTTPException(status_code=403, detail="Account is waiting for administrator approval.")
    return user


def get_admin_user(user: Annotated[User, Depends(get_approved_user)]) -> User:
    if user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required.")
    return user


def get_api_key_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = services.get_user_by_api_key(db, creds.credentials) if creds else None
    if user is None:
        raise _unauthorized("Invalid API key.")
    return user


CurrentUser = Annotated[User, Depends(get_approved_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
ApiKeyUser = Annotated[User, Depends(get_api_key_user)]
DbSession = Annotated[Session, Depends(get_db)]
