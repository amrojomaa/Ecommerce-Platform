import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { PAYMENT_ENDPOINTS, ORDER_ENDPOINTS } from '../config/api';
import { formatPrice } from '../utils/helpers';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Payment.css';

const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const PaymentForm = ({ amount, orderId, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create payment intent
      const intentResponse = await http.post(PAYMENT_ENDPOINTS.CREATE_INTENT, {
        order_id: orderId,
        currency: 'usd'
      });

      const { client_secret, payment_intent_id } = intentResponse.data;

      // Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: cardElement,
          }
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // Confirm payment on backend
        await http.post(PAYMENT_ENDPOINTS.CONFIRM, {
          payment_intent_id: payment_intent_id,
          order_id: orderId
        });

        toast.success('Payment successful!');
        onSuccess();
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.detail || err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="card-element-container">
        <label>Card Details</label>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      {error && <div className="payment-error">{error}</div>}

      <motion.button
        type="submit"
        className="pay-button"
        disabled={!stripe || loading}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
      >
        {loading ? (
          <>
            <LoadingSpinner size="small" />
            Processing Payment...
          </>
        ) : (
          `Pay ${formatPrice(amount)}`
        )}
      </motion.button>
    </form>
  );
};

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const [orderId, setOrderId] = useState(null);
  const [amount, setAmount] = useState(0);
  const [orderCreated, setOrderCreated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        // Get order information from location state
        const orderAmount = location.state?.amount;
        const existingOrderId = location.state?.orderId;
        
        if (orderAmount) {
          setAmount(orderAmount);
          
          if (existingOrderId) {
            // Use existing order
            setOrderId(existingOrderId);
            setOrderCreated(true);
          } else {
            // Create new order from checkout
            const orderResponse = await http.post(ORDER_ENDPOINTS.CHECKOUT);
            setOrderId(orderResponse.data.id);
            setOrderCreated(true);
          }
        } else {
          // If no amount provided, redirect to orders
          toast.error('No order information found');
          navigate('/orders');
        }
      } catch (error) {
        console.error('Error initializing payment:', error);
        toast.error('Failed to initialize payment. Please try again.');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [location, navigate]);

  const handlePaymentSuccess = async () => {
    // Clear cart after successful payment
    try {
      const cartResponse = await http.get('/showmecart');
      if (cartResponse.data?.items?.length > 0) {
        // Get cart_id from the cart response or items
        const cartId = cartResponse.data.items[0]?.cart_id || cartResponse.data.cart_id;
        if (cartId) {
          await clearCart(cartId);
        }
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
    }

    // Redirect to orders page
    setTimeout(() => {
      navigate('/orders');
    }, 1500);
  };

  if (!stripePromise) {
    return (
      <div className="payment-loading">
        <p>Stripe is not configured. Please contact support.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="payment-loading">
        <LoadingSpinner size="large" />
        <p>Initializing payment...</p>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <h1>Payment</h1>
      
      <div className="payment-container">
        <motion.div
          className="payment-summary"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2>Order Summary</h2>
          <div className="summary-details">
            <div className="summary-row">
              <span>Order ID:</span>
              <span>#{orderId || 'Processing...'}</span>
            </div>
            <div className="summary-row">
              <span>Total Amount:</span>
              <span className="total-amount">{formatPrice(amount)}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="payment-form-container"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2>Payment Information</h2>
          {orderCreated && (
            <Elements stripe={stripePromise}>
              <PaymentForm 
                amount={amount} 
                orderId={orderId}
                onSuccess={handlePaymentSuccess}
              />
            </Elements>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Payment;
