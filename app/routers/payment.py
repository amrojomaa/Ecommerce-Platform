import os
import stripe
import logging
from fastapi import HTTPException, status, Depends, APIRouter
from sqlalchemy.orm import Session, selectinload, joinedload
from ..database import get_db
from .. import models, schemas
from .. import OAuth2

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(
    tags=['Payment']
)

CURRENCY_MULTIPLIERS = {
    "usd": 100,
    "ils": 100,
    "jod": 1000,
}
CURRENCY_DECIMALS = {
    "usd": 2,
    "ils": 2,
    "jod": 3,
}
DEFAULT_EXCHANGE_RATES = {
    "usd": 1.0,
    "jod": 0.709,
    "ils": 3.65,
}


def _require_stripe_key() -> None:
    if not stripe.api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment service is not configured",
        )


def _get_exchange_rate(currency: str) -> float:
    normalized = str(currency or "").strip().lower()
    if normalized == "usd":
        return 1.0

    env_var = f"USD_TO_{normalized.upper()}"
    raw = os.getenv(env_var)
    if raw:
        try:
            parsed = float(raw)
            if parsed > 0:
                return parsed
        except ValueError:
            pass
    return DEFAULT_EXCHANGE_RATES.get(normalized, 1.0)


def _round_currency_amount(amount: float, currency: str) -> float:
    decimals = CURRENCY_DECIMALS.get(currency, 2)
    return round(float(amount), decimals)


def _to_minor_units(amount: float, currency: str) -> int:
    multiplier = CURRENCY_MULTIPLIERS.get(currency)
    if multiplier is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported currency. Allowed: usd, jod, ils",
        )
    return int(round(float(amount) * multiplier))


def _resolve_authoritative_amount_usd(
    payment_data: schemas.PaymentIntentCreate,
    db: Session,
    user_id: int,
) -> tuple[float, dict]:
    if payment_data.order_id and payment_data.installment_request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either order_id or installment_request_id, not both",
        )
    if payment_data.installment_schedule_id and not payment_data.installment_request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="installment_schedule_id requires installment_request_id",
        )

    if not payment_data.order_id and not payment_data.installment_request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A payment target is required",
        )

    if payment_data.order_id:
        order = (
            db.query(models.DBOrder)
            .filter(
                models.DBOrder.id == payment_data.order_id,
                models.DBOrder.user_id == user_id,
            )
            .first()
        )
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )
        if order.status != "created":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only orders with status 'created' can be paid",
            )
        amount_usd = float(order.total_amount or 0)
        if amount_usd <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order amount must be greater than zero",
            )
        return amount_usd, {
            "order_id": str(order.id),
            "installment_request_id": "",
            "installment_schedule_id": "",
        }

    if payment_data.installment_request_id:
        installment_request = (
            db.query(models.DBInstallmentRequest)
            .filter(
                models.DBInstallmentRequest.id == payment_data.installment_request_id,
                models.DBInstallmentRequest.user_id == user_id,
            )
            .first()
        )
        if not installment_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Installment request not found",
            )
        if installment_request.status not in {"approved", "completed"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Installment request is not payable",
            )

        if payment_data.installment_schedule_id:
            schedule = (
                db.query(models.DBInstallmentSchedule)
                .filter(
                    models.DBInstallmentSchedule.id == payment_data.installment_schedule_id,
                    models.DBInstallmentSchedule.request_id == payment_data.installment_request_id,
                )
                .first()
            )
            if not schedule:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Installment schedule not found",
                )
            if schedule.status == "paid":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Installment schedule is already paid",
                )
            outstanding = max(float(schedule.amount_due or 0) - float(schedule.amount_paid or 0), 0.0)
            if outstanding <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Installment schedule has no outstanding balance",
                )
            return outstanding, {
                "order_id": "",
                "installment_request_id": str(installment_request.id),
                "installment_schedule_id": str(schedule.id),
            }

        remaining_balance = max(float(installment_request.remaining_balance or 0), 0.0)
        if remaining_balance <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Installment request has no outstanding balance",
            )
        return remaining_balance, {
            "order_id": "",
            "installment_request_id": str(installment_request.id),
            "installment_schedule_id": "",
        }

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unable to resolve payment target",
    )


def _normalize_stripe_metadata(raw_metadata) -> dict:
    if raw_metadata is None:
        return {}
    if isinstance(raw_metadata, dict):
        return raw_metadata
    if hasattr(raw_metadata, "to_dict_recursive"):
        return raw_metadata.to_dict_recursive()
    if hasattr(raw_metadata, "to_dict"):
        return raw_metadata.to_dict()
    try:
        return dict(raw_metadata)
    except Exception:
        return {}


@router.post("/payment/create-intent", response_model=schemas.PaymentIntentResponse)
def create_payment_intent(
    payment_data: schemas.PaymentIntentCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(OAuth2.get_current_user)
):
    """
    Create a Stripe payment intent for an order
    """
    try:
        _require_stripe_key()
        amount_usd, target_metadata = _resolve_authoritative_amount_usd(payment_data, db, current_user.id)

        # PaymentIntentCreate.currency is an enum; read its value safely.
        currency = getattr(payment_data.currency, "value", payment_data.currency)
        currency = str(currency).lower()
        if currency not in CURRENCY_MULTIPLIERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported currency. Allowed: usd, jod, ils",
            )

        exchange_rate = _get_exchange_rate(currency)
        authoritative_amount = _round_currency_amount(amount_usd * exchange_rate, currency)
        amount_cents = _to_minor_units(authoritative_amount, currency)
        if amount_cents <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be greater than zero",
            )
        
        # Create payment intent
        metadata = {
            "user_id": str(current_user.id),
            "order_id": target_metadata["order_id"],
            "installment_request_id": target_metadata["installment_request_id"],
            "installment_schedule_id": target_metadata["installment_schedule_id"],
            "expected_currency": currency,
            "expected_amount_minor": str(amount_cents),
            "expected_amount": f"{authoritative_amount:.{CURRENCY_DECIMALS.get(currency, 2)}f}",
            "exchange_rate_from_usd": f"{exchange_rate}",
            "source_amount_usd": f"{amount_usd:.2f}",
        }

        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency,
            metadata=metadata
        )
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        }
    except HTTPException:
        raise
    except stripe.error.StripeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment provider rejected the request"
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating payment intent"
        )


@router.post("/payment/confirm")
def confirm_payment(
    payment_confirm: schemas.PaymentConfirm,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(OAuth2.get_current_user)
):
    """
    Confirm payment and update order status
    """
    try:
        _require_stripe_key()
        # Retrieve payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_confirm.payment_intent_id)
        
        if intent.status != "succeeded":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment not succeeded. Status: {intent.status}"
            )

        metadata = _normalize_stripe_metadata(intent.metadata)
        metadata_user_id = str(metadata.get("user_id", "")).strip()
        metadata_order_id = str(metadata.get("order_id", "")).strip()
        expected_currency = str(metadata.get("expected_currency", "")).strip().lower()
        expected_amount_minor_raw = str(metadata.get("expected_amount_minor", "")).strip()
        if metadata_user_id and metadata_user_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This payment intent does not belong to the current user",
            )

        if expected_currency and str(intent.currency or "").lower() != expected_currency:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment intent currency does not match server expectation",
            )
        if expected_amount_minor_raw:
            try:
                expected_amount_minor = int(expected_amount_minor_raw)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payment intent metadata is invalid",
                )
            charged_minor = int(getattr(intent, "amount_received", 0) or 0)
            if charged_minor != expected_amount_minor:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payment amount does not match server expectation",
                )
        
        # If order_id is provided, update order status to paid
        if payment_confirm.order_id:
            if metadata_order_id and metadata_order_id != str(payment_confirm.order_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payment intent does not match this order",
                )
            order = (
                db.query(models.DBOrder)
                .options(
                    selectinload(models.DBOrder.orderitems).joinedload(models.DBOrderItem.product)
                )
                .filter(
                    models.DBOrder.id == payment_confirm.order_id,
                    models.DBOrder.user_id == current_user.id
                )
                .first()
            )
            
            if not order:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Order not found"
                )
            
            # Only decrease stock if status is not already "paid"
            if order.status != "paid":
                # Decrease stock for each order item
                for order_item in order.orderitems:
                    product = order_item.product
                    if product.quantity < order_item.quantity:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Insufficient stock for product {product.name}. Available: {product.quantity}, Requested: {order_item.quantity}"
                        )
                    product.quantity -= order_item.quantity
                
                # Update order status to paid
                order.status = "paid"

                for order_item in order.orderitems:
                    db.add(
                        models.DBUserInteraction(
                            user_id=order.user_id,
                            product_id=order_item.product_id,
                            event_type=models.InteractionEventType.PURCHASE,
                            query_text=None,
                        )
                    )
                db.query(models.DBRecommendationBatchCache).filter(
                    models.DBRecommendationBatchCache.user_id == order.user_id
                ).delete()

            db.commit()

            cart = db.query(models.DBCart).filter(models.DBCart.user_id == current_user.id).first()
            if cart:
                db.query(models.DBCartItem).filter(
                    models.DBCartItem.cart_id == cart.id
                ).delete(synchronize_session=False)
                db.commit()

            # Create delivery job after committing to avoid failing payment confirmation.
            if getattr(order, "sale_channel", None) != "pos":
                try:
                    from .delivery import internal_create_delivery_job
                    internal_create_delivery_job(order.id, db)
                except Exception as delivery_error:
                    logging.warning("Failed to create delivery job for order %s: %s", order.id, delivery_error)
        
        return {
            "status": "success",
            "message": "Payment confirmed successfully",
            "payment_intent_id": payment_confirm.payment_intent_id
        }
    except HTTPException:
        raise
    except stripe.error.StripeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment provider rejected the confirmation request"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error confirming payment: {str(e)}"
        )
