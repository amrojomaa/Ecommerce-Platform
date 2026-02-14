import os
import stripe
from fastapi import HTTPException, status, Depends, APIRouter
from sqlalchemy.orm import Session
from ..database import get_db
from app import models, schemas
from app import OAuth2

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_51QEXAMPLE")  # Replace with your Stripe secret key

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
        # Convert amount to cents (Stripe uses smallest currency unit)
        amount_cents = int(payment_data.amount * 100)
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=payment_data.currency,
            metadata={
                "user_id": current_user.id,
                "order_id": payment_data.order_id or "",
            }
        )
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        }
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
        
        # If order_id is provided, update order status
        if payment_confirm.order_id:
            order = (
                db.query(models.DBOrder)
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
            
            # You can add a payment_status field to your Order model if needed
            # For now, we'll just return success
        
        return {
            "status": "success",
            "message": "Payment confirmed successfully",
            "payment_intent_id": payment_confirm.payment_intent_id
        }
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
