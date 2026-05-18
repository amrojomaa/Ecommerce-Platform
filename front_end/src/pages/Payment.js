import { tUi } from "../i18n/uiText";import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements } from
'@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { INSTALLMENT_ENDPOINTS, PAYMENT_ENDPOINTS, ORDER_ENDPOINTS, buildUrl } from '../config/api';
import { roundCurrencyAmount } from '../utils/helpers';
import { useCart } from '../hooks/useCart';
import { useCurrency } from '../hooks/useCurrency';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Payment.css';

const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

const PaymentForm = ({
  amountInUsd,
  orderId,
  installmentRequestId,
  installmentScheduleId,
  onSuccess,
  currentCurrency,
  stripeCurrency,
  convertPrice,
  formatCurrency
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const payableAmount = roundCurrencyAmount(
    convertPrice(amountInUsd, currentCurrency),
    currentCurrency
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (payableAmount <= 0) {
        throw new Error('Invalid payment amount.');
      }

      // Create payment intent
      const intentResponse = await http.post(PAYMENT_ENDPOINTS.CREATE_INTENT, {
        amount: payableAmount,
        order_id: orderId,
        installment_request_id: installmentRequestId,
        installment_schedule_id: installmentScheduleId,
        currency: stripeCurrency
      });

      const { client_secret, payment_intent_id } = intentResponse.data;

      // Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: cardElement
          }
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        if (installmentRequestId && installmentScheduleId) {
          const endpoint = buildUrl(INSTALLMENT_ENDPOINTS.MY_MARK_PAID, {
            request_id: installmentRequestId,
            schedule_id: installmentScheduleId
          });
          await http.patch(endpoint, {
            payment_intent_id: payment_intent_id
          });
        } else {
          // Confirm payment on backend
          await http.post(PAYMENT_ENDPOINTS.CONFIRM, {
            payment_intent_id: payment_intent_id,
            order_id: orderId
          });
        }

        toast.success(tUi("ui.pages.payment.paymentSuccessful_09bbd8bc49"));
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
        <label>{tUi("ui.pages.payment.cardDetails_39aedd6f29")}</label>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4'
                }
              },
              invalid: {
                color: '#9e2146'
              }
            }
          }} />
        
      </div>

      {error && <div className="payment-error">{error}</div>}

      <motion.button
        type="submit"
        className="pay-button"
        disabled={!stripe || loading}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}>
        
        {loading ?
        <>
            <LoadingSpinner size="small" />{tUi("ui.pages.payment.processingPayment_073698e8cb")}

        </> : tUi("ui.pages.payment.payValue_ac81d68b1e", { value0:

          formatCurrency(amountInUsd, currentCurrency) })
        }
      </motion.button>
    </form>);

};

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart, fetchCart } = useCart();
  const { currentCurrency, stripeCurrency, convertPrice, formatCurrency } = useCurrency();
  const [orderId, setOrderId] = useState(null);
  const [installmentRequestId, setInstallmentRequestId] = useState(null);
  const [installmentScheduleId, setInstallmentScheduleId] = useState(null);
  const [amount, setAmount] = useState(0);
  const [orderCreated, setOrderCreated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stripePromise, setStripePromise] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeLoadError, setStripeLoadError] = useState('');

  const initializeStripe = useCallback(async () => {
    setStripeLoading(true);
    setStripeLoadError('');

    if (!stripePublishableKey) {
      setStripeLoadError('Stripe is not configured. Please set REACT_APP_STRIPE_PUBLISHABLE_KEY.');
      setStripeLoading(false);
      return;
    }

    const nextStripePromise = loadStripe(stripePublishableKey).catch((error) => {
      console.error('Failed to load Stripe.js', error);
      return null;
    });

    setStripePromise(nextStripePromise);

    const stripe = await nextStripePromise;
    if (!stripe) {
      setStripeLoadError('Failed to load Stripe.js. Check your internet connection and try again.');
    }
    setStripeLoading(false);
  }, []);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        // Get order information from location state
        const orderAmount = location.state?.amount;
        const existingOrderId = location.state?.orderId;
        const targetInstallmentRequestId = location.state?.installmentRequestId;
        const targetInstallmentScheduleId = location.state?.installmentScheduleId;

        if (orderAmount) {
          setAmount(orderAmount);

          if (targetInstallmentRequestId && targetInstallmentScheduleId) {
            setInstallmentRequestId(targetInstallmentRequestId);
            setInstallmentScheduleId(targetInstallmentScheduleId);
            setOrderCreated(true);
            return;
          }

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
          toast.error(tUi("ui.pages.payment.noOrderInformationFound_561393a6aa"));
          navigate('/orders');
        }
      } catch (error) {
        console.error('Error initializing payment:', error);
        toast.error(tUi("ui.pages.payment.failedToInitializePaymentPlease_8874227d62"));
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [location, navigate]);

  useEffect(() => {
    initializeStripe();
  }, [initializeStripe]);

  const handlePaymentSuccess = async () => {
    if (installmentRequestId && installmentScheduleId) {
      setTimeout(() => {
        navigate('/installments');
      }, 1200);
      return;
    }

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
    } finally {
      await fetchCart();
    }

    // Redirect to orders page
    setTimeout(() => {
      navigate('/orders');
    }, 1500);
  };

  if (loading) {
    return (
      <div className="payment-loading">
        <LoadingSpinner size="large" />
        <p>{tUi("ui.pages.payment.initializingPayment_fd94c8ac65")}</p>
      </div>);

  }

  return (
    <div className="payment-page">
      <h1>{tUi("ui.pages.payment.payment_2fd70791db")}</h1>
      
      <div className="payment-container">
        <motion.div
          className="payment-summary"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}>
          
          <h2>{tUi("ui.pages.payment.orderSummary_2732d1541f")}</h2>
          <div className="summary-details">
            {installmentRequestId ?
            <>
                <div className="summary-row">
                  <span>{tUi("ui.pages.payment.installmentRequest_cb14601df2")}</span>
                  <span>#{installmentRequestId}</span>
                </div>
              </> :

            <div className="summary-row">
                <span>{tUi("ui.pages.payment.orderId_d8d11f83b9")}</span>
                <span>#{orderId || tUi("ui.pages.payment.processing_c5b2a4eb99")}</span>
              </div>
            }
            <div className="summary-row">
              <span>{tUi("ui.pages.payment.totalAmount_6d8825a3cb")}</span>
              <span className="total-amount">{formatCurrency(amount, currentCurrency)}</span>
            </div>
            <div className="summary-row">
              <span>{tUi("ui.pages.payment.paymentCurrency_dceed56642")}</span>
              <span>{currentCurrency}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="payment-form-container"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}>
          
          <h2>{tUi("ui.pages.payment.paymentInformation_080893f7ef")}</h2>
          {stripeLoading &&
          <div className="payment-loading-inline">
              <LoadingSpinner size="small" />
              <p>{tUi("ui.pages.payment.loadingSecurePaymentGateway_384a1c4eb7")}</p>
            </div>
          }
          {!stripeLoading && stripeLoadError &&
          <div className="payment-error-block">
              <div className="payment-error">{stripeLoadError}</div>
              <button
              type="button"
              className="retry-payment-btn"
              onClick={initializeStripe}>{tUi("ui.pages.payment.retryLoadingStripe_1afbfaf06c")}


            </button>
            </div>
          }
          {!stripeLoading && !stripeLoadError && orderCreated && stripePromise &&
          <Elements stripe={stripePromise}>
              <PaymentForm
              amountInUsd={amount}
              orderId={orderId}
              installmentRequestId={installmentRequestId}
              installmentScheduleId={installmentScheduleId}
              onSuccess={handlePaymentSuccess}
              currentCurrency={currentCurrency}
              stripeCurrency={stripeCurrency}
              convertPrice={convertPrice}
              formatCurrency={formatCurrency} />
            
            </Elements>
          }
        </motion.div>
      </div>
    </div>);

};

export default Payment;
