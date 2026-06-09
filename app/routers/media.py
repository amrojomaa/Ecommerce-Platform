from fastapi import APIRouter, Query

from app.utils.image_storage import PUBLIC_IMAGES_PREFIX
from app.utils.image_thumbnails import thumbnail_file_response

router = APIRouter(tags=["Media"])


@router.get("/media/thumb/{image_path:path}")
def get_image_thumbnail(
    image_path: str,
    w: int = Query(480, ge=64, le=1200, description="Max width/height in pixels"),
    q: int = Query(75, ge=40, le=95, description="WEBP quality"),
):
    normalized = image_path.replace("\\", "/").lstrip("/")
    if normalized.startswith(f"{PUBLIC_IMAGES_PREFIX}/"):
        normalized = normalized[len(PUBLIC_IMAGES_PREFIX) + 1 :]
    full_path = f"{PUBLIC_IMAGES_PREFIX}/{normalized}"
    return thumbnail_file_response(full_path, width=w, quality=q)
