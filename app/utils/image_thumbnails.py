import hashlib
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status
from starlette.responses import FileResponse

from app.utils.image_storage import IMAGES_ROOT_DIR, resolve_local_image_path

THUMB_CACHE_DIR = IMAGES_ROOT_DIR / "_cache" / "thumbs"


def _build_cache_path(source: Path, width: int, quality: int) -> Path:
    stat = source.stat()
    key = f"{source}:{stat.st_mtime_ns}:{stat.st_size}:{width}:{quality}"
    digest = hashlib.sha256(key.encode()).hexdigest()[:24]
    return THUMB_CACHE_DIR / f"{digest}.webp"


def get_or_create_thumbnail(
    image_path: str,
    *,
    width: int = 480,
    quality: int = 75,
) -> Path:
    source = resolve_local_image_path(image_path)
    if not source or not source.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    width = max(64, min(width, 1200))
    quality = max(40, min(quality, 95))

    THUMB_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = _build_cache_path(source, width, quality)
    if cache_path.exists():
        return cache_path

    try:
        from PIL import Image
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image processing is unavailable",
        ) from exc

    try:
        with Image.open(source) as image:
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            image.thumbnail((width, width), Image.Resampling.LANCZOS)
            image.save(cache_path, format="WEBP", quality=quality, method=6)
    except Exception as exc:
        if cache_path.exists():
            cache_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to process image",
        ) from exc

    return cache_path


def thumbnail_file_response(image_path: str, *, width: int = 480, quality: int = 75) -> FileResponse:
    cache_path = get_or_create_thumbnail(image_path, width=width, quality=quality)
    return FileResponse(
        cache_path,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
