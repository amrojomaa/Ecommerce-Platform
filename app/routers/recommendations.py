import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import OAuth2, models, schemas
from app.database import get_db
from app.routers.admin import require_admin
from app.routers.products import get_product_with_images
from app.services import recommendation_engine as re

router = APIRouter(tags=["Recommendations"])

BATCH_STALE_SECONDS = float(os.getenv("RECOMMENDATION_BATCH_MAX_AGE_SEC", "86400"))


def _user_id(tok: schemas.TokenData) -> int:
    uid = getattr(tok, "id", None)
    if uid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return int(uid)


@router.post("/recommendations/reset")
def reset_my_recommendations(
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user),
):
    """
    Clear logged recommendation behavior for the current user (views, searches, etc.)
    and remove their precomputed batch cache. Does not change cart, wishlist, or orders.
    """
    uid = _user_id(current_user)
    deleted_interactions = db.query(models.DBUserInteraction).filter(
        models.DBUserInteraction.user_id == uid
    ).delete(synchronize_session=False)
    db.query(models.DBRecommendationBatchCache).filter(
        models.DBRecommendationBatchCache.user_id == uid
    ).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "interactions_deleted": int(deleted_interactions or 0)}


@router.post(
    "/recommendations/events",
    status_code=status.HTTP_201_CREATED,
)
def track_recommendation_event(
    payload: schemas.RecommendationEventCreate,
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user),
):
    uid = _user_id(current_user)
    if payload.product_id is not None:
        prod = db.query(models.DBProduct).filter(models.DBProduct.id == payload.product_id).first()
        if prod is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    row = models.DBUserInteraction(
        user_id=uid,
        product_id=payload.product_id,
        event_type=payload.event_type,
        query_text=payload.query_text if payload.event_type == "search" else None,
    )
    db.add(row)
    db.query(models.DBRecommendationBatchCache).filter(models.DBRecommendationBatchCache.user_id == uid).delete()
    db.commit()
    return {"ok": True}


@router.get("/recommendations/realtime", response_model=list[schemas.RecommendationProductEnvelope])
def realtime_recommendations(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user),
):
    if db.query(models.DBProduct).limit(1).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No catalogue data")
    uid = _user_id(current_user)
    ranked, _meta = re.recommend_hybrid_for_user(db, uid, limit, re.REALTIME_PARAMS)
    return _to_envelope_list(db, ranked)


def _parse_dt(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        s = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("/recommendations/batch", response_model=list[schemas.RecommendationProductEnvelope])
def batch_recommendations(
    limit: int = Query(15, ge=1, le=80),
    db: Session = Depends(get_db),
    current_user: schemas.TokenData = Depends(OAuth2.get_current_user),
    force_refresh: bool = Query(False),
):
    if db.query(models.DBProduct).limit(1).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No catalogue data")
    uid = _user_id(current_user)
    cached = db.query(models.DBRecommendationBatchCache).filter_by(user_id=uid).first()

    stale = force_refresh or cached is None
    if cached and not stale:
        try:
            comp = getattr(cached, "computed_at", None)
            if comp is None and isinstance(getattr(cached, "payload", None), dict):
                comp = _parse_dt(getattr(cached, "payload", {}).get("computed_at"))
            if comp:
                stale = (_utc_age_seconds(comp)) > BATCH_STALE_SECONDS
        except Exception:
            stale = True

    if stale:
        ranked, _meta = re.recommend_hybrid_for_user(db, uid, limit, re.BATCH_PARAMS)
        ref = datetime.now(timezone.utc)
        envelope_list = [{"product_id": p, "score": s, "sources": src} for p, s, src in ranked]
        db_payload = {
            "items": envelope_list,
            "computed_at": ref.isoformat(),
            "cold_start": _meta.get("cold_start"),
            "strategy": _meta.get("strategy"),
            "interaction_rows": _meta.get("interaction_rows"),
            "meta": _meta,
        }
        if cached:
            cached.payload = db_payload  # type: ignore[assignment]
            cached.computed_at = ref
        else:
            db.add(models.DBRecommendationBatchCache(user_id=uid, payload=db_payload, computed_at=ref))
        db.commit()
        return _to_envelope_list(db, ranked[:limit])

    assert cached is not None
    pdata = getattr(cached, "payload", None) or {}
    items = pdata.get("items") or []
    ranked = [(int(it["product_id"]), float(it["score"]), list(it.get("sources") or [])) for it in items[:limit]]
    return _to_envelope_list(db, ranked)


def _utc_age_seconds(ts: datetime) -> float:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - ts).total_seconds())


def _to_envelope_list(
    db: Session,
    ranked: list[tuple[int, float, list[str]]],
) -> list[schemas.RecommendationProductEnvelope]:
    out: list[schemas.RecommendationProductEnvelope] = []
    seen: set[int] = set()
    for pid, score, sources in ranked:
        if pid in seen:
            continue
        seen.add(pid)
        prod = db.query(models.DBProduct).filter(models.DBProduct.id == pid).first()
        if prod is None:
            continue
        out.append(
            schemas.RecommendationProductEnvelope(
                score=score,
                sources=sources,
                product=schemas.Product(**get_product_with_images(prod)),
            )
        )
    return out


@router.post("/recommendations/batch/recompute")
def trigger_batch_recompute(
    user_ids: str | None = Query(
        None,
        description="Comma-separated user IDs; omit to recompute everyone with logged interactions.",
    ),
    db: Session = Depends(get_db),
    _admin: models.DBUser = Depends(require_admin),
):
    ids: list[int]
    if user_ids:
        ids = sorted({int(x.strip()) for x in user_ids.split(",") if x.strip().isdigit()})
    else:
        rows = db.query(models.DBUserInteraction.user_id).distinct().all()
        ids = sorted({int(r[0]) for r in rows})

    wrote = re.recompute_batch_for_users(db, ids, params=re.BATCH_PARAMS, limit_default=20)
    return {"users_processed": wrote, "user_ids_sample": ids[:50], "truncated_notice": len(ids) > 50}
