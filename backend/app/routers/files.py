import uuid
from urllib.parse import quote

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response

from .. import services
from ..config import get_settings
from ..deps import CurrentUser, DbSession
from ..schemas import FileOut
from ..uploads import read_upload_limited

router = APIRouter(tags=["files"])


@router.post("/items/{item_id}/files", response_model=FileOut)
async def add_file(item_id: uuid.UUID, user: CurrentUser, db: DbSession, file: UploadFile = File(...)) -> FileOut:
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    content = await read_upload_limited(file, max_bytes, "File")
    saved = services.add_file(db, user.id, item_id, file.filename or "file", content)
    return FileOut(id=saved.id, name=saved.name, size=saved.size)


@router.get("/files/{file_id}")
def download_file(file_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    saved = services.get_file(db, user.id, file_id)
    safe_name = services.sanitize_filename(saved.name)
    ascii_name = safe_name.encode("ascii", "ignore").decode("ascii").replace('"', "") or "file"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(safe_name, safe='')}"
    return Response(
        content=saved.content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": disposition},
    )


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    services.delete_file(db, user.id, file_id)
