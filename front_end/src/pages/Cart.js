import { tUi } from '../i18n/uiText';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaShieldAlt, FaShoppingCart, FaTag, FaTruck } from 'react-icons/fa';
import { FiTrash2 } from 'react-icons/fi';
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
    removeCartItem,
  } = useCart();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
  const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const getHeaderSubtitle = () => {
    if (cartItems.length === 0) {
      return tUi('ui.pages.cart.subtitleEmpty_a3f8c2d1e7');
    }

    return tUi('ui.pages.cart.subtitleWithItems_a3f8c2d1e6', { count: cartItems.length });
  };

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (!itemId) {
      toast.error(tUi('ui.pages.cart.invalidItemId_4c478f106a'));
      return;
    }

    if (newQuantity < 1) {
      newQuantity = 1;
    }

    const result = await updateCartItem(itemId, newQuantity);
    if (result.success) {
      toast.success(tUi('ui.pages.cart.cartUpdated_fb3514f71d'));
    } else {
      toast.error(result.error || tUi('ui.pages.cart.failedToUpdate_a3f8c2d1e8'));
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!itemId) {
      toast.error(tUi('ui.pages.cart.invalidItemId_4c478f106a'));
      return;
    }

    const result = await removeCartItem(itemId);
    if (result.success) {
      toast.success(tUi('ui.pages.cart.itemRemovedFromCart_b8877d495a'));
    } else {
      toast.error(result.error || tUi('ui.pages.cart.failedToRemove_a3f8c2d1e9'));
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error(tUi('ui.pages.cart.yourCartIsEmpty_977a093fcf'));
      return;
    }
    navigate('/checkout');
  };

  const handleDeleteAll = async () => {
    if (cartItems.length === 0) {
      return;
    }

    const confirmed = await confirm({
      title: tUi('ui.pages.cart.deleteAllItems_461a578884'),
      message: tUi('ui.pages.cart.areYouSureYouWant_9221b8ce13'),
      confirmText: tUi('ui.pages.cart.deleteAll_077da7e3f2'),
      cancelText: tUi('ui.pages.cart.cancel_74261aa62c'),
    });
    if (!confirmed) {
      return;
    }

    const results = await Promise.all(cartItems.map((item) => removeCartItem(item.id)));
    const failed = results.some((result) => !result.success);

    if (failed) {
      toast.error(tUi('ui.pages.cart.someItemsCouldNotBe_ba1660dea1'));
      return;
    }

    toast.success(tUi('ui.pages.cart.allItemsDeletedFromCart_c9752caafe'));
  };

  if (loading) {
    return (
      <div className="page-loading cart-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--storefront cart-page">
      <PageHeader
        kicker={tUi('ui.pages.cart.kicker_a3f8c2d1e5')}
        title={tUi('ui.pages.cart.shoppingCart_7367ced874')}
        subtitle={getHeaderSubtitle()}
        actions={
          cartItems.length > 0 ? (
            <motion.button
              type="button"
              className="cart-delete-all-btn"
              onClick={handleDeleteAll}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FiTrash2 aria-hidden="true" />
              {tUi('ui.pages.cart.deleteAll_077da7e3f2')}
            </motion.button>
          ) : null
        }
      />

      {cartItems.length === 0 ? (
        <motion.section
          className="cart-empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          aria-label={tUi('ui.pages.cart.yourCartIsEmpty_977a093fcf')}
        >
          <FaShoppingCart className="cart-empty-icon" aria-hidden="true" />
          <h2>{tUi('ui.pages.cart.emptyTitle_a3f8c2d1ea')}</h2>
          <p>{tUi('ui.pages.cart.emptyHint_a3f8c2d1eb')}</p>
          <Link to="/products" className="page-btn-primary cart-empty-cta">
            {tUi('ui.pages.cart.continueShopping_5009154016')}
            <FaArrowRight aria-hidden="true" />
          </Link>
        </motion.section>
      ) : (
        <div className="cart-layout">
          <section className="cart-section cart-items-section" aria-label={tUi('ui.pages.cart.shoppingCart_7367ced874')}>
            <div className="cart-items-list">
              {cartItems.map((item, index) => {
                const localizedItem = localizeProduct(item.product || {}, languageCode);
                const originalPrice = Number(item.product?.original_price ?? item.product?.price ?? 0);
                const discountedPrice = Number(item.product?.discounted_price ?? item.product?.price ?? 0);
                const hasDiscount =
                  Boolean(item.product?.has_discount) || discountedPrice < originalPrice;
                const productName = localizedItem.localized_name || tUi('ui.pages.cart.product_d44e1d3515');

                return (
                  <motion.article
                    key={item.id || index}
                    className="cart-item-card"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <Link
                      to={`/products/${encodeURIComponent(item.product?.name || '')}`}
                      className="cart-item-thumb"
                    >
                      <img
                        src={
                          item.product?.images?.length
                            ? getImageUrl(item.product.images[0])
                            : getImageUrl('/images/placeholder.jpg')
                        }
                        alt={productName}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                        }}
                      />
                    </Link>

                    <div className="cart-item-body">
                      <div className="cart-item-copy">
                        <h3 className="cart-item-name">
                          <Link to={`/products/${encodeURIComponent(item.product?.name || '')}`}>
                            {productName}
                          </Link>
                        </h3>
                        <p className="cart-item-price">
                          {hasDiscount ? (
                            <span className="cart-item-price-discount">
                              <span className="cart-item-price-old">{formatCurrency(originalPrice)}</span>
                              <span className="cart-item-price-sale">{formatCurrency(discountedPrice)}</span>
                            </span>
                          ) : (
                            formatCurrency(item.product?.price || 0)
                          )}
                        </p>
                      </div>

                      <div className="cart-item-actions">
                        <div className="cart-item-quantity">
                          <span className="cart-item-quantity-label">
                            {tUi('ui.pages.cart.quantityLabel_a3f8c2d1ee')}
                          </span>
                          <div className="cart-quantity-controls">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, (item.quantity || 1) - 1)}
                              className="cart-quantity-btn"
                              disabled={loading || (item.quantity || 1) <= 1}
                              aria-label={tUi('ui.pages.cart.decreaseQuantity_a3f8c2d1ef')}
                            >
                              −
                            </button>
                            <span className="cart-quantity-value">{item.quantity || 1}</span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, (item.quantity || 1) + 1)}
                              className="cart-quantity-btn"
                              disabled={loading}
                              aria-label={tUi('ui.pages.cart.increaseQuantity_a3f8c2d1f0')}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="cart-item-line-total">
                          <span className="cart-item-line-total-label">
                            {tUi('ui.pages.cart.lineTotal_a3f8c2d1f1')}
                          </span>
                          <strong>{formatCurrency(item.total || 0)}</strong>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="cart-remove-btn"
                          aria-label={tUi('ui.pages.cart.removeItem_0cc61ca1e3')}
                          disabled={loading}
                        >
                          <FiTrash2 aria-hidden="true" />
                          <span>{tUi('ui.pages.cart.removeItem_0cc61ca1e3')}</span>
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <motion.aside
            className="cart-order-summary page-summary-card page-card--static"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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
      )}
    </div>
  );
};

export default Cart;
