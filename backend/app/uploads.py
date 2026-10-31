from fastapi import HTTPException, UploadFile


async def read_upload_limited(file: UploadFile, max_bytes: int, label: str) -> bytes:
    """Read an upload in bounded chunks and stop once its configured size limit is exceeded."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(min(64 * 1024, max_bytes + 1 - total)):
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail=f"{label} exceeds the {max_bytes}-byte upload limit.")
        chunks.append(chunk)
    return b"".join(chunks)
