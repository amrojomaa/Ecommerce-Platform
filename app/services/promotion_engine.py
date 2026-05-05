from dataclasses import dataclass
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app import models


@dataclass
class PromotionLineItem:
    product_id: int
    product_name: str
    category_name: str
    quantity: int
    unit_price: float
    line_total: float


def get_active_promotion(db: Session) -> Optional[models.DBPromotion]:
    return (
        db.query(models.DBPromotion)
        .filter(models.DBPromotion.is_active.is_(True))
        .order_by(models.DBPromotion.updated_at.desc(), models.DBPromotion.id.desc())
        .first()
    )


def _normalize_name(value: str) -> str:
    return (value or "").strip().lower()


def _filter_eligible_items(
    items: list[PromotionLineItem],
    promotion: models.DBPromotion,
) -> list[PromotionLineItem]:
    filter_type = (promotion.filter_type or "").strip()
    raw_values = promotion.filter_values or []
    normalized_values = {_normalize_name(v) for v in raw_values if str(v).strip()}

    if not normalized_values:
        return []

    if filter_type == "include_products":
        return [i for i in items if _normalize_name(i.product_name) in normalized_values]
    if filter_type == "exclude_products":
        return [i for i in items if _normalize_name(i.product_name) not in normalized_values]
    if filter_type == "include_categories":
        return [i for i in items if _normalize_name(i.category_name) in normalized_values]
    if filter_type == "exclude_categories":
        return [i for i in items if _normalize_name(i.category_name) not in normalized_values]

    return []


def calculate_promotion_totals(
    items: Iterable[PromotionLineItem],
    promotion: Optional[models.DBPromotion],
) -> dict:
    line_items = list(items)
    subtotal = round(sum(float(item.line_total) for item in line_items), 2)

    result = {
        "subtotal": subtotal,
        "promotion_discount": 0.0,
        "grand_total": subtotal,
        "applied_promotion": None,
    }

    if not promotion or subtotal <= 0:
        return result

    eligible_items = _filter_eligible_items(line_items, promotion)
    eligible_amount = round(sum(float(item.line_total) for item in eligible_items), 2)
    eligible_quantity = sum(int(item.quantity) for item in eligible_items)

    target_type = promotion.target_type
    target_value = float(promotion.target_value or 0)
    target_metric = eligible_amount if target_type == "amount" else float(eligible_quantity)

    if target_metric < target_value:
        return result

    discount_type = promotion.discount_type
    discount_value = float(promotion.discount_value or 0)
    if discount_type == "percentage":
        discount = round(eligible_amount * (discount_value / 100), 2)
    else:
        discount = round(discount_value, 2)

    discount = max(0.0, min(discount, eligible_amount, subtotal))
    if discount <= 0:
        return result

    grand_total = round(max(subtotal - discount, 0.0), 2)
    result["promotion_discount"] = discount
    result["grand_total"] = grand_total
    result["applied_promotion"] = {
        "promotion_id": promotion.id,
        "name": promotion.name,
        "target_type": target_type,
        "target_value": target_value,
        "discount_type": discount_type,
        "discount_value": discount_value,
        "filter_type": promotion.filter_type,
        "filter_values": list(promotion.filter_values or []),
        "eligible_amount": eligible_amount,
        "eligible_quantity": eligible_quantity,
        "discount_applied": discount,
    }
    return result
