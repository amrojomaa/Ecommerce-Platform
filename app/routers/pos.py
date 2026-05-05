import secrets
from collections import defaultdict
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import cast, Date, func
from sqlalchemy.orm import Session, joinedload, selectinload

from app import models, schemas, utils
from app.database import get_db
from app.routers.admin import require_cashier
from app.routers.products import get_product_with_images
from app.services import promotion_engine

# Must pass Pydantic EmailStr (e.g. in GET /users/all). ".local" is rejected as reserved.
WALKIN_EMAIL = "pos.walkin@example.com"
_LEGACY_WALKIN_EMAIL = "pos.walkin@internal.local"

router = APIRouter(prefix="/pos", tags=["POS"])


def _ensure_walkin_user(db: Session) -> models.DBUser:
    u = db.query(models.DBUser).filter(models.DBUser.email == WALKIN_EMAIL).first()
    if u:
        return u
    legacy = db.query(models.DBUser).filter(models.DBUser.email == _LEGACY_WALKIN_EMAIL).first()
    if legacy:
        legacy.email = WALKIN_EMAIL
        db.commit()
        db.refresh(legacy)
        return legacy
    u = models.DBUser(
        email=WALKIN_EMAIL,
        password=utils.hash(secrets.token_urlsafe(32)),
        first_name="Walk-in",
        last_name="Customer",
        role="customer",
        provider="email",
        is_verified=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _prepare_pos_lines(
    items: List[schemas.POSLineItem],
    db: Session,
) -> list[tuple[models.DBProduct, int, float, float]]:
    merged: defaultdict[int, int] = defaultdict(int)
    for line in items:
        if line.quantity < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each line must have quantity >= 1")
        merged[line.product_id] += line.quantity

    product_ids = list(merged.keys())
    products = (
        db.query(models.DBProduct)
        .options(joinedload(models.DBProduct.images))
        .filter(models.DBProduct.id.in_(product_ids))
        .all()
    )
    by_id = {p.id: p for p in products}
    if len(by_id) != len(product_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more products were not found")

    line_totals: list[tuple[models.DBProduct, int, float, float]] = []
    for pid, qty in merged.items():
        p = by_id[pid]
        if p.quantity < qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {p.name}. Available: {p.quantity}, requested: {qty}",
            )
        unit = float(p.final_price)
        line_totals.append((p, qty, unit, round(unit * qty, 2)))

    return line_totals


def _calculate_pos_promotion_totals(
    line_totals: list[tuple[models.DBProduct, int, float, float]],
    db: Session,
) -> dict:
    promo_lines = [
        promotion_engine.PromotionLineItem(
            product_id=p.id,
            product_name=p.name,
            category_name=p.category_name,
            quantity=qty,
            unit_price=unit,
            line_total=line_total,
        )
        for p, qty, unit, line_total in line_totals
    ]
    return promotion_engine.calculate_promotion_totals(
        promo_lines,
        promotion_engine.get_active_promotion(db),
    )


@router.get("/products", response_model=List[schemas.POSProductRow])
def pos_product_search(
    q: str = "",
    category: str = "",
    db: Session = Depends(get_db),
    _user: models.DBUser = Depends(require_cashier),
):
    query = db.query(models.DBProduct).options(joinedload(models.DBProduct.images))
    if q:
        query = query.filter(models.DBProduct.name.ilike(f"%{q}%"))
    if category:
        query = query.filter(models.DBProduct.category_name.ilike(f"%{category}%"))
    products = query.order_by(models.DBProduct.name).limit(100).all()
    return [get_product_with_images(p) for p in products]


@router.post("/promotion-preview", response_model=schemas.PromotionCalculationResponse)
def pos_promotion_preview(
    body: schemas.POSPromotionPreviewRequest,
    db: Session = Depends(get_db),
    _cashier_user: models.DBUser = Depends(require_cashier),
):
    if not body.items:
        return schemas.PromotionCalculationResponse(
            subtotal=0,
            promotion_discount=0,
            grand_total=0,
            applied_promotion=None,
        )
    line_totals = _prepare_pos_lines(body.items, db)
    summary = _calculate_pos_promotion_totals(line_totals, db)
    return schemas.PromotionCalculationResponse(**summary)


@router.post("/sale", response_model=schemas.OrderResponse)
def create_pos_sale(
    body: schemas.POSCheckoutRequest,
    db: Session = Depends(get_db),
    cashier_user: models.DBUser = Depends(require_cashier),
):
    if not body.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")
    line_totals = _prepare_pos_lines(body.items, db)
    summary = _calculate_pos_promotion_totals(line_totals, db)
    walkin = _ensure_walkin_user(db)

    new_order = models.DBOrder(
        user_id=walkin.id,
        total_amount=float(summary["grand_total"]),
        status="paid",
        sale_channel="pos",
        cashier_id=cashier_user.id,
        payment_method=body.payment_method,
        promotion_discount=float(summary["promotion_discount"]),
        promotion_name=(summary["applied_promotion"]["name"] if summary["applied_promotion"] else None),
    )
    db.add(new_order)
    db.flush()

    for p, qty, unit, line_total in line_totals:
        p.quantity -= qty
        db.add(
            models.DBOrderItem(
                order_id=new_order.id,
                product_id=p.id,
                quantity=qty,
                price=unit,
                total=line_total,
            )
        )
        db.add(
            models.DBUserInteraction(
                user_id=walkin.id,
                product_id=p.id,
                event_type=models.InteractionEventType.PURCHASE,
                query_text=None,
            )
        )

    db.query(models.DBRecommendationBatchCache).filter(
        models.DBRecommendationBatchCache.user_id == walkin.id
    ).delete(synchronize_session=False)

    db.commit()

    loaded = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images),
        )
        .filter(models.DBOrder.id == new_order.id)
        .first()
    )
    return loaded


@router.get("/sales/today", response_model=List[schemas.POSSaleSummaryRow])
def pos_my_sales_today(
    db: Session = Depends(get_db),
    cashier_user: models.DBUser = Depends(require_cashier),
):
    rows = (
        db.query(models.DBOrder)
        .filter(
            models.DBOrder.sale_channel == "pos",
            models.DBOrder.cashier_id == cashier_user.id,
            cast(models.DBOrder.created_at, Date) == func.current_date(),
        )
        .order_by(models.DBOrder.created_at.desc())
        .all()
    )
    return [
        schemas.POSSaleSummaryRow(
            id=o.id,
            created_at=o.created_at,
            total_amount=o.total_amount,
            promotion_discount=float(o.promotion_discount or 0),
            promotion_name=o.promotion_name,
            payment_method=o.payment_method,
            status=o.status,
        )
        for o in rows
    ]
