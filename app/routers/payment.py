import os
import stripe
from fastapi import HTTPException, status, Depends, APIRouter
from sqlalchemy.orm import Session, selectinload
from ..database import get_db
from app import models, schemas
from app import OAuth2
from decimal import Decimal, ROUND_HALF_UP
import logging

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=['Payment']
)

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
        if not stripe.api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment processor is not configured",
            )

        order = (
            db.query(models.DBOrder)
            .filter(
                models.DBOrder.id == payment_data.order_id,
                models.DBOrder.user_id == current_user.id,
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
                detail="Payment intent can only be created for orders in 'created' status",
            )

        # Derive payable amount from server-side order record only.
        amount_cents = int(
            (Decimal(str(order.total_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100)
        )
        if amount_cents <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid order total amount",
            )
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=payment_data.currency,
            metadata={
                "user_id": str(current_user.id),
                "order_id": str(order.id),
            }
        )
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        }
    except stripe.error.StripeError as e:
        logger.warning("Stripe error in create_payment_intent: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create payment intent"
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error creating payment intent")
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
        if not stripe.api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment processor is not configured",
            )

        if not payment_confirm.order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="order_id is required",
            )

        # Retrieve payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_confirm.payment_intent_id)
        
        if intent.status != "succeeded":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment not succeeded. Status: {intent.status}"
            )
        
        order = (
            db.query(models.DBOrder)
            .options(selectinload(models.DBOrder.orderitems).joinedload(models.DBOrderItem.product))
            .filter(
                models.DBOrder.id == payment_confirm.order_id,
                models.DBOrder.user_id == current_user.id,
            )
            .first()
        )
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        metadata = intent.get("metadata", {})
        if (
            str(metadata.get("user_id")) != str(current_user.id)
            or str(metadata.get("order_id")) != str(order.id)
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment intent does not match this order",
            )

        expected_amount = int(
            (Decimal(str(order.total_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100)
        )
        if intent.amount != expected_amount or intent.currency.lower() != "usd":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount or currency mismatch",
            )

        # Idempotent behavior: if already paid, return success.
        if order.status == "paid":
            return {
                "status": "success",
                "message": "Order already marked as paid",
                "payment_intent_id": payment_confirm.payment_intent_id,
            }

        if order.status != "created":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot pay order with status '{order.status}'",
            )

        for order_item in order.orderitems:
            product = order_item.product
            if product.quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for product {product.name}",
                )
            product.quantity -= order_item.quantity

        order.status = "paid"
        db.commit()
        
        return {
            "status": "success",
            "message": "Payment confirmed successfully",
            "payment_intent_id": payment_confirm.payment_intent_id
        }
    except stripe.error.StripeError as e:
        logger.warning("Stripe error in confirm_payment: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to confirm payment"
        )
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("Error confirming payment")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error confirming payment"
        )
