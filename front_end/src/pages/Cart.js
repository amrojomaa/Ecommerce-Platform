import { tUi } from '../i18n/uiText';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaShieldAlt, FaTag, FaTruck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useCart } from '../hooks/useCart';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import { getImageUrl } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const {
    cartItems,
    subtotal,
    promotionDiscount,
    appliedPromotion,
    grandTotal,
    loading,
    updateCartItem,
    removeCartItem
  } = useCart();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
  const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // useEffect(() => {
  //   fetchCart();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (!itemId) {
      toast.error(tUi("ui.pages.cart.invalidItemId_4c478f106a"));
      return;
    }

    // Ensure minimum quantity is 1
    if (newQuantity < 1) {
      newQuantity = 1;
    }

    const result = await updateCartItem(itemId, newQuantity);
    if (result.success) {
      toast.success(tUi("ui.pages.cart.cartUpdated_fb3514f71d"));
    } else {
      toast.error(result.error || 'Failed to update cart');
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!itemId) {
      toast.error(tUi("ui.pages.cart.invalidItemId_4c478f106a"));
      return;
    }

    const result = await removeCartItem(itemId);
    if (result.success) {
      toast.success(tUi("ui.pages.cart.itemRemovedFromCart_b8877d495a"));
    } else {
      toast.error(result.error || 'Failed to remove item');
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error(tUi("ui.pages.cart.yourCartIsEmpty_977a093fcf"));
      return;
    }
    navigate('/checkout');
  };

  const handleDeleteAll = async () => {
    if (cartItems.length === 0) {
      return;
    }

    const confirmed = await confirm({
      title: tUi("ui.pages.cart.deleteAllItems_461a578884"),
      message: tUi("ui.pages.cart.areYouSureYouWant_9221b8ce13"),
      confirmText: tUi("ui.pages.cart.deleteAll_077da7e3f2"),
      cancelText: tUi("ui.pages.cart.cancel_74261aa62c")
    });
    if (!confirmed) {
      return;
    }

    const results = await Promise.all(
      cartItems.map((item) => removeCartItem(item.id))
    );
    const failed = results.some((result) => !result.success);

    if (failed) {
      toast.error(tUi("ui.pages.cart.someItemsCouldNotBe_ba1660dea1"));
      return;
    }

    toast.success(tUi("ui.pages.cart.allItemsDeletedFromCart_c9752caafe"));
  };

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  return (
    <div className="page-shell page-shell--storefront cart-page">
      <PageHeader
        kicker={tUi("ui.pages.cart.shoppingCart_7367ced874")}
        title={tUi("ui.pages.cart.shoppingCart_7367ced874")}
        subtitle={cartItems.length > 0
          ? `${cartItems.length} ${cartItems.length === 1 ? 'item' : 'items'}`
          : tUi("ui.pages.cart.yourCartIsEmpty_977a093fcf")}
      />
      
      {cartItems.length === 0 ?
      <motion.div
        className="page-empty empty-cart"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        
          <p>{tUi("ui.pages.cart.yourCartIsEmpty_977a093fcf")}</p>
          <Link to="/products" className="page-btn-primary continue-shopping-btn">{tUi("ui.pages.cart.continueShopping_5009154016")}

        </Link>
        </motion.div> :

      <div className="cart-container">
          <div className="cart-items">
            <div className="cart-items-actions">
              <button
              type="button"
              className="page-btn-danger delete-all-btn"
              onClick={handleDeleteAll}
              disabled={loading || cartItems.length === 0}>{tUi("ui.pages.cart.deleteAll_077da7e3f2")}


            </button>
            </div>
            {cartItems.map((item, index) =>
          <motion.div
            key={item.id || index}
            className="cart-item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}>
            
                <div className="cart-item-image">
                  <img
                src={item.product?.images && item.product.images.length > 0 ?
                getImageUrl(item.product.images[0]) :
                getImageUrl('/images/placeholder.jpg')}
                alt={localizeProduct(item.product || {}, languageCode).localized_name || tUi("ui.pages.cart.product_d44e1d3515")}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                }} />
              
                </div>
                
                <div className="cart-item-info">
                  {(() => {
                const localizedItem = localizeProduct(item.product || {}, languageCode);
                const originalPrice = Number(item.product?.original_price ?? item.product?.price ?? 0);
                const discountedPrice = Number(item.product?.discounted_price ?? item.product?.price ?? 0);
                const hasDiscount = Boolean(item.product?.has_discount) || discountedPrice < originalPrice;
                return (
                  <>
                  <h3>
                    <Link to={`/products/${encodeURIComponent(item.product?.name || '')}`}>
                      {localizedItem.localized_name || tUi("ui.pages.cart.product_d44e1d3515")}
                    </Link>
                  </h3>
                  <p className="cart-item-price">
                    {hasDiscount ?
                      <span className="cart-discount-price-block">
                        <span className="cart-old-price">
                          {formatCurrency(originalPrice)}
                        </span>
                        <span className="cart-new-price">
                          {formatCurrency(discountedPrice)}
                        </span>
                      </span> :

                      formatCurrency(item.product?.price || 0)
                      }
                  </p>
                      </>);

              })()}
                </div>

                <div className="cart-item-quantity">
                  <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const currentQuantity = item.quantity || 1;
                  if (currentQuantity > 1) {
                    handleQuantityChange(item.id, currentQuantity - 1);
                  }
                }}
                className="quantity-btn"
                disabled={loading || (item.quantity || 1) <= 1}>
                
                    -
                  </button>
                  <span className="quantity-value">{item.quantity || 1}</span>
                  <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleQuantityChange(item.id, (item.quantity || 1) + 1);
                }}
                className="quantity-btn"
                disabled={loading}>
                
                    +
                  </button>
                </div>

                <div className="cart-item-total">
                  <p className="item-total">
                    {formatCurrency(item.total || 0)}
                  </p>
                </div>

                <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRemoveItem(item.id);
              }}
              className="remove-item-btn"
              aria-label={tUi("ui.pages.cart.removeItem_0cc61ca1e3")}
              disabled={loading}>
              
                  ├ù
                </button>
              </motion.div>
          )}
          </div>

          <motion.aside
            className="cart-order-summary page-summary-card page-card--static"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            aria-label={tUi('ui.pages.cart.orderSummary_97f6cd5623')}
          >
            <header className="cart-summary-header">
              <span className="page-kicker">{tUi('ui.pages.cart.summaryKicker_b8e4f2a1c3')}</span>
              <div className="cart-summary-title-row">
                <h2 className="page-section-title">{tUi('ui.pages.cart.orderSummary_97f6cd5623')}</h2>
                <span className="cart-summary-count">
                  {tUi('ui.pages.cart.itemsCount_d4e7a9b2f1', { value0: totalQuantity })}
                </span>
              </div>
            </header>

            {promotionDiscount > 0 && (
              <div className="cart-summary-promo" role="status">
                <span className="cart-summary-promo-icon" aria-hidden="true">
                  <FaTag />
                </span>
                <div className="cart-summary-promo-copy">
                  <strong>
                    {appliedPromotion?.name || tUi('ui.pages.cart.promotion_956ee3b550')}
                  </strong>
                  <span>
                    {tUi('ui.pages.cart.promotionSaved_c6f1e8d3a7', {
                      value0: formatCurrency(promotionDiscount),
                    })}
                  </span>
                </div>
              </div>
            )}

            <ul className="cart-summary-items">
              {cartItems.map((item) => {
                const localizedItem = localizeProduct(item.product || {}, languageCode);
                const productName = localizedItem.localized_name || tUi('ui.pages.cart.product_d44e1d3515');
                const imageSrc = item.product?.images?.length
                  ? getImageUrl(item.product.images[0])
                  : getImageUrl('/images/placeholder.jpg');

                return (
                  <li key={item.id} className="cart-summary-item">
                    <div className="cart-summary-item-thumb">
                      <img
                        src={imageSrc}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                        }}
                      />
                    </div>
                    <div className="cart-summary-item-copy">
                      <p className="cart-summary-item-name">{productName}</p>
                      <p className="cart-summary-item-meta">
                        {tUi('ui.pages.cart.quantityTimesPrice_e2b5c8f4d6', {
                          value0: item.quantity || 1,
                          value1: formatCurrency(item.product?.price || 0),
                        })}
                      </p>
                    </div>
                    <span className="cart-summary-item-total">{formatCurrency(item.total || 0)}</span>
                  </li>
                );
              })}
            </ul>

            <div className="cart-summary-totals">
              <div className="page-summary-row">
                <span>{tUi('ui.pages.cart.subtotal_a87a323a5f')}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {promotionDiscount > 0 && (
                <div className="page-summary-row page-summary-row--discount">
                  <span>
                    {tUi('ui.pages.cart.promotion_956ee3b550')}
                    {appliedPromotion?.name
                      ? tUi('ui.pages.cart.value_dbed6349c6', { value0: appliedPromotion.name })
                      : ''}
                  </span>
                  <span>-{formatCurrency(promotionDiscount)}</span>
                </div>
              )}
              <div className="page-summary-row">
                <span>{tUi('ui.pages.cart.shipping_1bc05a98aa')}</span>
                <span className="cart-summary-shipping-note">
                  {tUi('ui.pages.cart.shippingCalculatedAtCheckout_f3a9c1e7b2')}
                </span>
              </div>
            </div>

            <div className="cart-summary-grand-total">
              <span>{tUi('ui.pages.cart.total_cf0b507074')}</span>
              <span className="cart-summary-grand-amount">{formatCurrency(grandTotal)}</span>
            </div>

            <ul className="cart-summary-trust">
              <li>
                <FaShieldAlt aria-hidden="true" />
                <span>{tUi('ui.pages.cart.secureCheckout_a7d2e4f9c1')}</span>
              </li>
              <li>
                <FaTruck aria-hidden="true" />
                <span>{tUi('ui.pages.cart.freeShippingEligible_b5c8d1e6f3')}</span>
              </li>
            </ul>

            <motion.button
              type="button"
              className="page-btn-primary cart-summary-checkout"
              onClick={handleCheckout}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {tUi('ui.pages.cart.proceedToCheckout_48e6337c2b')}
              <FaArrowRight aria-hidden="true" />
            </motion.button>
            <Link to="/products" className="page-btn-secondary cart-summary-continue">
              {tUi('ui.pages.cart.continueShopping_5009154016')}
            </Link>
          </motion.aside>
        </div>
      }
    </div>);

};

export default Cart;
