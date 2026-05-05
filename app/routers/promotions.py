from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.admin import require_admin

router = APIRouter(prefix="/promotions", tags=["Promotions"])

_FILTER_AUDIENCE_LABEL = {
    "include_products": "selected products",
    "exclude_products": "eligible products",
    "include_categories": "selected categories",
    "exclude_categories": "eligible categories",
}


def _format_currency(value: float) -> str:
    if float(value).is_integer():
        return f"${int(value)}"
    return f"${value:.2f}"


def _summarize_filter_values(values: list[str], max_items: int = 3) -> str:
    cleaned = [str(v).strip() for v in values if str(v).strip()]
    if not cleaned:
        return ""

    shown = cleaned[:max_items]
    if len(cleaned) > max_items:
        shown.append(f"+{len(cleaned) - max_items} more")
    return ", ".join(shown)


def _build_audience_text(filter_type: str, filter_values: list[str]) -> str:
    audience = _FILTER_AUDIENCE_LABEL.get(filter_type, "selected products")
    value_summary = _summarize_filter_values(filter_values)
    if not value_summary:
        return audience

    if filter_type in {"exclude_products", "exclude_categories"}:
        return f"{audience} (excluding {value_summary})"
    return f"{audience} ({value_summary})"


def _build_customer_message(promotion: models.DBPromotion) -> str:
    target_value = float(promotion.target_value or 0)
    discount_value = float(promotion.discount_value or 0)
    audience = _build_audience_text(
        str(promotion.filter_type or ""),
        list(promotion.filter_values or []),
    )

    if promotion.target_type == "amount":
        target_part = f"Spend {_format_currency(target_value)} on {audience}"
    else:
        qty = int(target_value) if target_value.is_integer() else target_value
        target_part = f"Buy {qty} items from {audience}"

    if promotion.discount_type == "percentage":
        discount_part = f"get {discount_value:g}% off"
    else:
        discount_part = f"get {_format_currency(discount_value)} off"

    return f"Promotion available: {target_part} and {discount_part}."


@router.get("/products/options", response_model=List[str])
def get_product_name_options(
    db: Session = Depends(get_db),
    _admin_user: models.DBUser = Depends(require_admin),
):
    rows = db.query(models.DBProduct.name).order_by(models.DBProduct.name.asc()).all()
    return [name for (name,) in rows]


@router.get("/categories/options", response_model=List[str])
def get_category_name_options(
    db: Session = Depends(get_db),
    _admin_user: models.DBUser = Depends(require_admin),
):
    rows = db.query(models.DBCategory.name).order_by(models.DBCategory.name.asc()).all()
    return [name for (name,) in rows]


@router.get("", response_model=List[schemas.PromotionResponse])
def get_promotions(
    db: Session = Depends(get_db),
    _admin_user: models.DBUser = Depends(require_admin),
):
    return (
        db.query(models.DBPromotion)
        .order_by(models.DBPromotion.is_active.desc(), models.DBPromotion.updated_at.desc())
        .all()
    )


@router.get("/active", response_model=Optional[schemas.ActivePromotionPublicResponse])
def get_active_promotion(
    db: Session = Depends(get_db),
):
    promotion = (
        db.query(models.DBPromotion)
        .filter(models.DBPromotion.is_active.is_(True))
        .order_by(models.DBPromotion.updated_at.desc(), models.DBPromotion.id.desc())
        .first()
    )
    if not promotion:
        return None

    return schemas.ActivePromotionPublicResponse(
        id=promotion.id,
        name=promotion.name,
        target_type=promotion.target_type,
        target_value=float(promotion.target_value or 0),
        discount_type=promotion.discount_type,
        discount_value=float(promotion.discount_value or 0),
        filter_type=promotion.filter_type,
        filter_values=list(promotion.filter_values or []),
        customer_message=_build_customer_message(promotion),
    )


def _ensure_unique_name(
    db: Session,
    promotion_name: str,
    exclude_id: int | None = None,
) -> None:
    query = db.query(models.DBPromotion).filter(models.DBPromotion.name == promotion_name)
    if exclude_id is not None:
        query = query.filter(models.DBPromotion.id != exclude_id)
    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Promotion name already exists.",
        )


@router.post("", response_model=schemas.PromotionResponse, status_code=status.HTTP_201_CREATED)
def create_promotion(
    payload: schemas.PromotionCreate,
    db: Session = Depends(get_db),
    _admin_user: models.DBUser = Depends(require_admin),
):
    _ensure_unique_name(db, payload.name)

    if payload.is_active:
        db.query(models.DBPromotion).update(
            {models.DBPromotion.is_active: False}, synchronize_session=False
        )

    new_promotion = models.DBPromotion(**payload.model_dump())
    db.add(new_promotion)
    db.commit()
    db.refresh(new_promotion)
    return new_promotion


@router.put("/{promotion_id}", response_model=schemas.PromotionResponse)
def update_promotion(
    promotion_id: int,
    payload: schemas.PromotionUpdate,
    db: Session = Depends(get_db),
    _admin_user: models.DBUser = Depends(require_admin),
):
    promotion = db.query(models.DBPromotion).filter(models.DBPromotion.id == promotion_id).first()
    if not promotion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found.")

    _ensure_unique_name(db, payload.name, exclude_id=promotion_id)

    if payload.is_active:
        db.query(models.DBPromotion).filter(models.DBPromotion.id != promotion_id).update(
            {models.DBPromotion.is_active: False},
            synchronize_session=False,
        )

    for field, value in payload.model_dump().items():
        setattr(promotion, field, value)

    db.commit()
    db.refresh(promotion)
    return promotion


@router.patch("/{promotion_id}/active", response_model=schemas.PromotionResponse)
def set_promotion_active_state(
    promotion_id: int,
    payload: schemas.PromotionStatusUpdate,
    db: Session = Depends(get_db),
    _admin_user: models.DBUser = Depends(require_admin),
):
    promotion = db.query(models.DBPromotion).filter(models.DBPromotion.id == promotion_id).first()
    if not promotion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found.")

    if payload.is_active:
        db.query(models.DBPromotion).filter(models.DBPromotion.id != promotion_id).update(
            {models.DBPromotion.is_active: False},
            synchronize_session=False,
        )
    promotion.is_active = payload.is_active
    db.commit()
    db.refresh(promotion)
    return promotion


@router.delete("/{promotion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    _admin_user: models.DBUser = Depends(require_admin),
):
    promotion = db.query(models.DBPromotion).filter(models.DBPromotion.id == promotion_id).first()
    if not promotion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found.")

    db.delete(promotion)
    db.commit()
