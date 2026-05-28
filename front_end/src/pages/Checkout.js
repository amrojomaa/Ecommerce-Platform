import { tUi } from '../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaTag } from 'react-icons/fa';
import { toast } from 'react-toastify';
import http from '../services/http';
import { ORDER_ENDPOINTS } from '../config/api';
import { useCart } from '../hooks/useCart';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Checkout.css';

const SHIPPING_OPTIONS = [
  {
    id: 'west_bank_gaza',
    name: 'West Bank and Gaza Strip',
    labelKey: 'ui.pages.checkout.shippingOptionWestBank_b4e8c2d2cb',
    fee: 20,
  },
  {
    id: 'international',
    name: 'International Shipping',
    labelKey: 'ui.pages.checkout.shippingOptionInternational_b4e8c2d2cc',
    fee: 40,
  },
];

const readSavedShippingOption = () => {
  try {
    const saved = localStorage.getItem('selectedShippingRegion');
    if (saved) {
      const parsed = JSON.parse(saved);
      const matched = SHIPPING_OPTIONS.find(
        (option) => option.name === parsed.name || option.fee === parsed.fee
      );
      if (matched) {
        return matched;
      }
    }
  } catch {
    // ignore invalid storage
  }
  return SHIPPING_OPTIONS[0];
};

const Checkout = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const { cartItems, subtotal, promotionDiscount, appliedPromotion, grandTotal } = useCart();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const accountPhone = (user?.phone || '').trim();
  const showPhoneField = !accountPhone;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    zipCode: '',
    country: '',
    phone: '',
  });

  const [shippingRegion, setShippingRegion] = useState(readSavedShippingOption);

  const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const orderTotal = grandTotal + shippingRegion.fee;

  const handleShippingChange = (option) => {
    setShippingRegion(option);
    localStorage.setItem(
      'selectedShippingRegion',
      JSON.stringify({ name: option.name, fee: option.fee })
    );
  };

  useEffect(() => {
    if (cartItems.length === 0) {
      toast.info(tUi('ui.pages.checkout.yourCartIsEmpty_d5391da0dc'));
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
      toast.error(tUi('ui.pages.checkout.pleaseFillInAllRequired_50039ce3dd'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        phone: accountPhone || formData.phone.trim() || undefined,
        shipping_region: shippingRegion.name,
        shipping_fee: shippingRegion.fee,
      };
      const response = await http.post(ORDER_ENDPOINTS.CHECKOUT, payload);

      if (response.data?.merged) {
        toast.success(tUi('ui.pages.checkout.orderMergedSuccessfully_b4e8c2d3ea', { value0: response.data.id }));
      } else {
        toast.success(tUi('ui.pages.checkout.orderPlacedSuccessfully_4042f7157d'));
      }

      setTimeout(() => {
        navigate('/orders');
      }, 1500);
    } catch (error) {
      toast.error(
        error.response?.data?.detail || error.message || tUi('ui.pages.checkout.failedToPlaceOrder_b4e8c2d2c1')
      );
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="page-loading checkout-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--storefront checkout-page">
      <PageHeader
        title={tUi('ui.pages.checkout.checkout_69315371da')}
        subtitle={tUi('ui.pages.checkout.subtitle_b4e8c2d2c0')}
        animate={false}
      />

      <div className="checkout-layout">
        <motion.form
          className="checkout-shipping-panel page-form-panel"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <header className="checkout-shipping-header">
            <h2 className="page-section-title">{tUi('ui.pages.checkout.shippingInformation_d88cac7166')}</h2>
          </header>

          <div className="checkout-form-grid">
            <div className="checkout-field">
              <label htmlFor="address">{tUi('ui.pages.checkout.address_c66e170a3e')}</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder={tUi('ui.pages.checkout.addressPlaceholder_b4e8c2d2c4')}
                required
              />
            </div>

            <div className="checkout-field">
              <label htmlFor="city">{tUi('ui.pages.checkout.city_3421768f9e')}</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder={tUi('ui.pages.checkout.cityPlaceholder_b4e8c2d2c5')}
                required
              />
            </div>

            <div className="checkout-field">
              <label htmlFor="country">{tUi('ui.pages.checkout.country_e719f63442')}</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                placeholder={tUi('ui.pages.checkout.countryPlaceholder_b4e8c2d2c8')}
              />
            </div>

            <div className="checkout-field">
              <label htmlFor="zipCode">{tUi('ui.pages.checkout.zipCode_3c43826e0f')}</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                placeholder={tUi('ui.pages.checkout.zipPlaceholder_b4e8c2d2c7')}
                required
              />
            </div>

            {showPhoneField && (
              <div className="checkout-field checkout-field--full">
                <label htmlFor="phone">{tUi('ui.pages.checkout.phone_24a3e62f5a')}</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder={tUi('ui.pages.checkout.phonePlaceholder_b4e8c2d2c9')}
                />
              </div>
            )}
          </div>

          <fieldset className="checkout-shipping-options">
            <legend className="checkout-shipping-options-label">
              {tUi('ui.pages.checkout.shippingOptionsLabel_b4e8c2d2cd')}
            </legend>
            {SHIPPING_OPTIONS.map((option) => {
              const isSelected = shippingRegion.id === option.id;
              const optionId = `checkout-shipping-${option.id}`;

              return (
                <label
                  key={option.id}
                  htmlFor={optionId}
                  className={`checkout-shipping-option${isSelected ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    id={optionId}
                    name="shippingRegion"
                    className="checkout-shipping-option-input"
                    checked={isSelected}
                    onChange={() => handleShippingChange(option)}
                  />
                  <span className="checkout-shipping-option-box" aria-hidden="true">
                    {isSelected ? '☑' : '☐'}
                  </span>
                  <span className="checkout-shipping-option-copy">
                    {tUi(option.labelKey)} — {formatCurrency(option.fee)}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <motion.button
            type="submit"
            className="page-btn-primary checkout-submit-btn"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                {tUi('ui.pages.checkout.processing_59c9b49800')}
              </>
            ) : (
              <>
                {tUi('ui.pages.checkout.placeOrder_e42fa41868')}
                <FaArrowRight aria-hidden="true" />
              </>
            )}
          </motion.button>
        </motion.form>

        <motion.aside
          className="checkout-order-summary page-summary-card page-card--static"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          aria-label={tUi('ui.pages.checkout.orderSummary_d0a0edc227')}
        >
          <header className="checkout-summary-header">
            <div className="checkout-summary-title-row">
              <h2 className="page-section-title">{tUi('ui.pages.checkout.orderSummary_d0a0edc227')}</h2>
              <span className="checkout-summary-count">
                {tUi('ui.pages.cart.itemsCount_d4e7a9b2f1', { value0: totalQuantity })}
              </span>
            </div>
          </header>

          {promotionDiscount > 0 && (
            <div className="checkout-summary-promo" role="status">
              <span className="checkout-summary-promo-icon" aria-hidden="true">
                <FaTag />
              </span>
              <div className="checkout-summary-promo-copy">
                <strong>
                  {appliedPromotion?.name || tUi('ui.pages.checkout.promotion_8e2a388c14')}
                </strong>
                <span>
                  {tUi('ui.pages.cart.promotionSaved_c6f1e8d3a7', {
                    value0: formatCurrency(promotionDiscount),
                  })}
                </span>
              </div>
            </div>
          )}

          <ul className="checkout-summary-items">
            {cartItems.map((item) => {
              const localizedItem = localizeProduct(item.product || {}, languageCode);
              const productName = localizedItem.localized_name || tUi('ui.pages.checkout.product_7454e0bf02');

              return (
                <li key={item.id} className="checkout-summary-item">
                  <div className="checkout-summary-item-copy">
                    <p className="checkout-summary-item-name">{productName}</p>
                    <p className="checkout-summary-item-meta">
                      {tUi('ui.pages.cart.quantityTimesPrice_e2b5c8f4d6', {
                        value0: item.quantity || 1,
                        value1: formatCurrency(item.product?.price || 0),
                      })}
                    </p>
                  </div>
                  <span className="checkout-summary-item-total">{formatCurrency(item.total || 0)}</span>
                </li>
              );
            })}
          </ul>

          <div className="checkout-summary-totals">
            <div className="page-summary-row">
              <span>{tUi('ui.pages.checkout.subtotal_86a223f217')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {promotionDiscount > 0 && (
              <div className="page-summary-row page-summary-row--discount">
                <span>
                  {tUi('ui.pages.checkout.promotion_8e2a388c14')}
                  {appliedPromotion?.name
                    ? tUi('ui.pages.checkout.value_60d597c6ec', { value0: appliedPromotion.name })
                    : ''}
                </span>
                <span>-{formatCurrency(promotionDiscount)}</span>
              </div>
            )}
            <div className="page-summary-row">
              <span>{tUi('ui.pages.checkout.shipping_c4ae97807a')}</span>
              <span>{formatCurrency(shippingRegion.fee)}</span>
            </div>
            <div className="checkout-summary-total">
              <span className="checkout-summary-total-label">{tUi('ui.pages.checkout.total_bdf441497c')}</span>
              <span className="checkout-summary-total-amount">{formatCurrency(orderTotal)}</span>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
};

export default Checkout;
