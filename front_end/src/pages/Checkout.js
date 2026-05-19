import { tUi } from "../i18n/uiText";import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { ORDER_ENDPOINTS } from '../config/api';
import { formatPrice } from '../utils/helpers';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import '../styles/pages/Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  useTranslation();
  const { cartItems, subtotal, promotionDiscount, appliedPromotion, grandTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    phone: ''
  });

  const [shippingRegion] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedShippingRegion');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return { name: 'West Bank and Gaza', fee: 20 };
  });

  useEffect(() => {
    if (cartItems.length === 0) {
      toast.info(tUi("ui.pages.checkout.yourCartIsEmpty_d5391da0dc"));
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.address || !formData.city || !formData.zipCode) {
      toast.error(tUi("ui.pages.checkout.pleaseFillInAllRequired_50039ce3dd"));
      return;
    }

    setLoading(true);
    try {
      // Create order via checkout endpoint and send formData
      const payload = {
        ...formData,
        shipping_region: shippingRegion.name,
        shipping_fee: shippingRegion.fee
      };
      await http.post(ORDER_ENDPOINTS.CHECKOUT, payload);

      toast.success(tUi("ui.pages.checkout.orderPlacedSuccessfully_4042f7157d"));

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
      <h1>{tUi("ui.pages.checkout.checkout_69315371da")}</h1>

      <div className="checkout-container">
        <motion.form
          className="checkout-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}>
          
          <h2>{tUi("ui.pages.checkout.shippingInformation_d88cac7166")}</h2>

          <div className="form-group">
            <label htmlFor="address">{tUi("ui.pages.checkout.address_c66e170a3e")}</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              required />
            
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">{tUi("ui.pages.checkout.city_3421768f9e")}</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                required />
              
            </div>

            <div className="form-group">
              <label htmlFor="state">{tUi("ui.pages.checkout.state_52f851971c")}</label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state}
                onChange={handleInputChange} />
              
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="zipCode">{tUi("ui.pages.checkout.zipCode_3c43826e0f")}</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                required />
              
            </div>

            <div className="form-group">
              <label htmlFor="country">{tUi("ui.pages.checkout.country_e719f63442")}</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange} />
              
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone">{tUi("ui.pages.checkout.phone_24a3e62f5a")}</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange} />
            
          </div>

          <motion.button
            type="submit"
            className="submit-order-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}>
            
            {loading ?
            <>
                <LoadingSpinner size="small" />{tUi("ui.pages.checkout.processing_59c9b49800")}

            </> : tUi("ui.pages.checkout.placeOrder_e42fa41868")


            }
          </motion.button>
        </motion.form>

        <motion.div
          className="order-summary"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}>
          
          <h2>{tUi("ui.pages.checkout.orderSummary_d0a0edc227")}</h2>

          <div className="order-items">
            {cartItems.map((item) =>
            <div key={item.id} className="order-item">
                <div className="order-item-info">
                  <h4>{item.product?.name || tUi("ui.pages.checkout.product_7454e0bf02")}</h4>
                  <p>{tUi("ui.pages.checkout.quantity_84bc7f1176")}{item.quantity || 1}</p>
                </div>
                <p className="order-item-price">
                  {formatPrice(item.total || 0)}
                </p>
              </div>
            )}
          </div>

          <div className="order-totals">
            <div className="total-row">
              <span>{tUi("ui.pages.checkout.subtotal_86a223f217")}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {promotionDiscount > 0 &&
            <div className="total-row total-row-discount">
                <span>{tUi("ui.pages.checkout.promotion_8e2a388c14")}
                {appliedPromotion?.name ? tUi("ui.pages.checkout.value_60d597c6ec", { value0: appliedPromotion.name }) : ''}:
                </span>
                <span>-{formatPrice(promotionDiscount)}</span>
              </div>
            }
            <div className="total-row">
              <span>{tUi("ui.pages.checkout.shipping_c4ae97807a")} ({shippingRegion.name}):</span>
              <span>{formatPrice(shippingRegion.fee)}</span>
            </div>
            <div className="total-row final-total">
              <span>{tUi("ui.pages.checkout.total_bdf441497c")}</span>
              <span>{formatPrice(grandTotal + shippingRegion.fee)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>);

};

export default Checkout;
