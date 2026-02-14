import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { ORDER_ENDPOINTS } from '../config/api';
import { formatPrice } from '../utils/helpers';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, grandTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    phone: '',
  });

  useEffect(() => {
    if (cartItems.length === 0) {
      toast.info('Your cart is empty');
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.address || !formData.city || !formData.zipCode) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Create order via checkout endpoint
      await http.post(ORDER_ENDPOINTS.CHECKOUT);
      
      toast.success('Order placed successfully!');
      
      // Clear cart after successful order
      if (cartItems[0]?.cart_id) {
        await clearCart(cartItems[0].cart_id);
      }
      
      // Redirect to orders page
      setTimeout(() => {
        navigate('/orders');
      }, 1500);
    } catch (error) {
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      
      <div className="checkout-container">
        <motion.form
          className="checkout-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2>Shipping Information</h2>
          
          <div className="form-group">
            <label htmlFor="address">Address *</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">City *</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="state">State</label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="zipCode">Zip Code *</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="country">Country</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
            />
          </div>

          <motion.button
            type="submit"
            className="submit-order-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                Processing...
              </>
            ) : (
              'Place Order'
            )}
          </motion.button>
        </motion.form>

        <motion.div
          className="order-summary"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2>Order Summary</h2>
          
          <div className="order-items">
            {cartItems.map((item) => (
              <div key={item.id} className="order-item">
                <div className="order-item-info">
                  <h4>{item.product?.name || 'Product'}</h4>
                  <p>Quantity: {item.quantity || 1}</p>
                </div>
                <p className="order-item-price">
                  {formatPrice(item.total || 0)}
                </p>
              </div>
            ))}
          </div>

          <div className="order-totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
            <div className="total-row">
              <span>Shipping:</span>
              <span>Free</span>
            </div>
            <div className="total-row final-total">
              <span>Total:</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Checkout;
