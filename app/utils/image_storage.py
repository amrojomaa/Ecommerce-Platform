import hashlib
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile, status


PROJECT_ROOT = Path(__file__).resolve().parents[2]
IMAGES_ROOT_DIR = Path(os.getenv("IMAGE_STORAGE_DIR", PROJECT_ROOT / "images")).resolve()
PUBLIC_IMAGES_PREFIX = "images"

DEFAULT_MAX_IMAGE_UPLOAD_BYTES = int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", str(8 * 1024 * 1024)))
STREAM_CHUNK_SIZE = 1024 * 1024

ALLOWED_IMAGE_MIME_TO_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def ensure_images_root() -> None:
    IMAGES_ROOT_DIR.mkdir(parents=True, exist_ok=True)


def is_local_image_path(path: Optional[str]) -> bool:
    if not path:
        return False
    parsed = urlparse(path)
    if parsed.scheme in {"http", "https"}:
        return False
    normalized = path.replace("\\", "/").lstrip("/")
    return normalized.startswith(f"{PUBLIC_IMAGES_PREFIX}/")


def _normalize_category(category: str) -> str:
    normalized = (category or "").replace("\\", "/")
    parts = [part.strip() for part in normalized.split("/") if part.strip() and part not in {".", ".."}]
    if not parts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image category must not be empty",
        )
    return "/".join(parts)


def _guess_extension(upload: UploadFile, content_type: str) -> str:
    if content_type in ALLOWED_IMAGE_MIME_TO_EXTENSION:
        return ALLOWED_IMAGE_MIME_TO_EXTENSION[content_type]

    original_ext = Path(upload.filename or "").suffix.lower()
    if original_ext in {".jpg", ".jpeg"}:
        return ".jpg"
    if original_ext in {".png", ".webp", ".gif"}:
        return original_ext
    return ".jpg"


def _verify_image_file(path: Path) -> None:
    try:
        from PIL import Image
    except ImportError:
        return

    try:
        with Image.open(path) as image:
            image.verify()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid image",
        ) from exc


def save_uploaded_image(
    upload: UploadFile,
    category: str,
    *,
    max_bytes: Optional[int] = None,
) -> str:
    if not upload or not upload.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file is required",
        )

    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_IMAGE_MIME_TO_EXTENSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Allowed types: JPEG, PNG, WEBP, GIF",
        )

    limit = max_bytes if max_bytes is not None else DEFAULT_MAX_IMAGE_UPLOAD_BYTES
    if limit <= 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid image upload size configuration",
        )

    safe_category = _normalize_category(category)
    ext = _guess_extension(upload, content_type)
    ensure_images_root()

    temp_parent = IMAGES_ROOT_DIR / safe_category / "_tmp"
    temp_parent.mkdir(parents=True, exist_ok=True)

    hasher = hashlib.sha256()
    total_size = 0
    temp_file_path: Optional[Path] = None

    try:
        upload.file.seek(0)
    except Exception:
        pass

    try:
        with NamedTemporaryFile(delete=False, dir=temp_parent, prefix="upload_", suffix=".tmp") as temp_file:
            temp_file_path = Path(temp_file.name)
            while True:
                chunk = upload.file.read(STREAM_CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > limit:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Image exceeds max allowed size of {limit} bytes",
                    )
                hasher.update(chunk)
                temp_file.write(chunk)
    except HTTPException:
        if temp_file_path and temp_file_path.exists():
            temp_file_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        if temp_file_path and temp_file_path.exists():
            temp_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed while writing image to storage",
        ) from exc

    if not temp_file_path or not temp_file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded image",
        )

    if total_size <= 0:
        temp_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file is empty",
        )

    try:
        _verify_image_file(temp_file_path)
    except HTTPException:
        temp_file_path.unlink(missing_ok=True)
        raise

    digest = hasher.hexdigest()
    shard_a, shard_b = digest[:2], digest[2:4]
    relative_path = f"{PUBLIC_IMAGES_PREFIX}/{safe_category}/{shard_a}/{shard_b}/{digest}{ext}"
    destination_path = IMAGES_ROOT_DIR / safe_category / shard_a / shard_b / f"{digest}{ext}"
    destination_path.parent.mkdir(parents=True, exist_ok=True)

    if destination_path.exists():
        temp_file_path.unlink(missing_ok=True)
    else:
        os.replace(temp_file_path, destination_path)

    return relative_path


def resolve_local_image_path(path: str) -> Optional[Path]:
    if not is_local_image_path(path):
        return None

    normalized = path.replace("\\", "/").lstrip("/")
    if not normalized.startswith(f"{PUBLIC_IMAGES_PREFIX}/"):
        return None

    relative_tail = normalized[len(PUBLIC_IMAGES_PREFIX) + 1 :]
    resolved = (IMAGES_ROOT_DIR / relative_tail).resolve()

    try:
        resolved.relative_to(IMAGES_ROOT_DIR)
    except ValueError:
        return None

    return resolved


def delete_local_image(path: Optional[str]) -> bool:
    if not path:
        return False

    local_path = resolve_local_image_path(path)
    if not local_path or not local_path.exists():
        return False

    local_path.unlink(missing_ok=True)

    current = local_path.parent
    while current != IMAGES_ROOT_DIR and current.exists():
        try:
            next(current.iterdir())
            break
        except StopIteration:
            current.rmdir()
            current = current.parent
        except OSError:
            break

    return True
