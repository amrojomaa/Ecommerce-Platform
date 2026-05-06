import os
import stripe
from fastapi import HTTPException, status, Depends, APIRouter
from sqlalchemy.orm import Session, selectinload
from ..database import get_db
from app import models, schemas
from app import OAuth2

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

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
        # PaymentIntentCreate.currency is an enum; read its value safely.
        currency = getattr(payment_data.currency, "value", payment_data.currency)
        currency = str(currency).lower()
        currency_multipliers = {
            "usd": 100,
            "ils": 100,
            "jod": 1000,
        }
        multiplier = currency_multipliers.get(currency)
        if multiplier is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported currency. Allowed: usd, jod, ils"
            )

        # Convert amount to Stripe's smallest supported unit for each currency.
        amount_cents = int(round(payment_data.amount * multiplier))
        if amount_cents <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be greater than zero"
            )
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency,
            metadata={
                "user_id": current_user.id,
                "order_id": payment_data.order_id or "",
            }
        )
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        }
    except HTTPException:
        raise
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating payment intent: {str(e)}"
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
        # Retrieve payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_confirm.payment_intent_id)
        
        if intent.status != "succeeded":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment not succeeded. Status: {intent.status}"
            )
        
        # If order_id is provided, update order status to paid
        if payment_confirm.order_id:
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
                
                # Automatically create a delivery job for online paid orders only
                if getattr(order, "sale_channel", None) != "pos":
                    from .delivery import internal_create_delivery_job
                    internal_create_delivery_job(order.id, db)
            
            db.commit()
        
        return {
            "status": "success",
            "message": "Payment confirmed successfully",
            "payment_intent_id": payment_confirm.payment_intent_id
        }
    except HTTPException:
        raise
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error confirming payment: {str(e)}"
        )
