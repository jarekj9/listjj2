import datetime as dt
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from .config import get_settings

log = logging.getLogger("listjj.security")

_PBKDF2_ITERATIONS = 310_000
_FALLBACK_SECRET = secrets.token_urlsafe(48)
_GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
_MICROSOFT_ISSUER_PREFIX = "https://login.microsoftonline.com/"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
    except ValueError:
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)


def _jwt_secret() -> str:
    secret = get_settings().jwt_secret
    if secret:
        return secret
    return _FALLBACK_SECRET


def create_access_token(user_id: uuid.UUID, email: str, role: str | None) -> str:
    settings = get_settings()
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role or "",
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + dt.timedelta(days=settings.jwt_expiry_days),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token, _jwt_secret(), algorithms=["HS256"], issuer=get_settings().jwt_issuer
    )


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True)


def verify_external_id_token(provider: str, token: str) -> str:
    """Verify a Google or Microsoft ID token and return the lower-cased email. Raises ValueError."""
    settings = get_settings()
    options = {"require": ["exp", "aud", "iss"]}
    try:
        if provider == "google":
            if not settings.google_client_id:
                raise ValueError("Google login is not configured.")
            key = _jwks_client(_GOOGLE_JWKS).get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token, key, algorithms=["RS256"], audience=settings.google_client_id, options=options
            )
            if claims.get("iss") not in _GOOGLE_ISSUERS:
                raise ValueError("Unexpected token issuer.")
        elif provider == "microsoft":
            if not settings.microsoft_client_id:
                raise ValueError("Microsoft login is not configured.")
            tenant = settings.microsoft_tenant_id
            jwks_url = f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"
            key = _jwks_client(jwks_url).get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token, key, algorithms=["RS256"], audience=settings.microsoft_client_id, options=options
            )
            issuer = str(claims.get("iss", ""))
            if not issuer.startswith(_MICROSOFT_ISSUER_PREFIX):
                raise ValueError("Unexpected token issuer.")
            if tenant != "common" and claims.get("tid") != tenant:
                raise ValueError("Token belongs to another tenant.")
        else:
            raise ValueError("Unknown login provider.")
    except jwt.PyJWTError as exc:
        log.info("External token rejected: %s", exc)
        raise ValueError("Invalid token.") from exc

    email = claims.get("email") or (claims.get("preferred_username") if provider == "microsoft" else None)
    if not email:
        raise ValueError("Token contains no email address.")
    if provider == "google" and claims.get("email_verified") is not True:
        raise ValueError("Google account email is not verified.")
    if provider == "microsoft" and claims.get("email_verified") is False:
        raise ValueError("Microsoft account email is not verified.")
    email = str(email).strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Identity token does not contain a valid email address.")
    return email
