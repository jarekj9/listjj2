from fastapi import APIRouter

from ..config import get_settings
from ..deps import AdminUser

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/version")
def version() -> dict:
    return {"version": get_settings().app_version}


@router.get("/settings")
def view_settings(_: AdminUser) -> dict:
    s = get_settings()
    return {
        "version": s.app_version,
        "deployment": s.deployment_name,
        "database": s.database_url.split("@")[-1],
        "googleLoginEnabled": bool(s.google_client_id),
        "microsoftLoginEnabled": bool(s.microsoft_client_id),
        "adminEmailConfigured": bool(s.admin_email),
        "maxUploadMb": s.max_upload_mb,
        "jwtExpiryDays": s.jwt_expiry_days,
    }
