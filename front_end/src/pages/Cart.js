import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatPrice } from '../utils/helpers';
import { useCart } from '../hooks/useCart';
import { useLanguage } from '../hooks/useLanguage';
import { useDialog } from '../hooks/useDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { showConfirm } = useDialog();
  const {
    cartItems,
    grandTotal,
    loading,
    updateCartItem,
    removeCartItem,
    clearCart,
    fetchCart,
  } = useCart();

  // useEffect(() => {
  //   fetchCart();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (!itemId) {
      toast.error(t('invalidItemId', 'Invalid item ID'));
      return;
    }
    
    // Ensure minimum quantity is 1
    if (newQuantity < 1) {
      newQuantity = 1;
    }
    
    const result = await updateCartItem(itemId, newQuantity);
    if (result.success) {
      toast.success(t('cartUpdated', 'Cart updated'));
    } else {
      toast.error(result.error || t('failedUpdateCart', 'Failed to update cart'));
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!itemId) {
      toast.error(t('invalidItemId', 'Invalid item ID'));
      return;
    }
    
    const result = await removeCartItem(itemId);
    if (result.success) {
      toast.success(t('itemRemovedFromCart', 'Item removed from cart'));
    } else {
      toast.error(result.error || t('failedRemoveCartItem', 'Failed to remove item'));
    }
  };

  const handleClearCart = async () => {
    if (cartItems.length === 0) return;

    const confirmed = await showConfirm({
      message: t('clearCartQuestion', 'Are you sure you want to delete all items from cart?'),
      confirmText: t('ok', 'OK'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) return;

    const result = await clearCart();
    if (result.success) {
      toast.success(t('cartClearedSuccessfully', 'Cart cleared successfully'));
    } else {
      toast.error(result.error || t('failedClearCart', 'Failed to clear cart'));
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error(t('yourCartIsEmpty', 'Your cart is empty'));
      return;
    }
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="cart-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="cart-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cart-header">
        <h1>{t('shoppingCart', 'Shopping Cart')}</h1>
        {cartItems.length > 0 && (
          <button
            type="button"
            className="clear-cart-btn"
            onClick={handleClearCart}
          >
            {t('clearCart', 'Delete All')}
          </button>
        )}
      </div>
      
      {cartItems.length === 0 ? (
        <motion.div
          className="empty-cart"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>{t('yourCartIsEmpty', 'Your cart is empty')}</p>
          <Link to="/products" className="continue-shopping-btn">
            {t('continueShopping', 'Continue Shopping')}
          </Link>
        </motion.div>
      ) : (
        <div className="cart-container">
          <div className="cart-items">
            {cartItems.map((item, index) => (
              <motion.div
                key={item.id || index}
                className="cart-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="cart-item-image">
                  <img
                    src={item.product?.images && item.product.images.length > 0
                      ? `http://localhost:8000/${item.product.images[0]}`
                      : `http://localhost:8000/images/placeholder.jpg`}
                    alt={item.product?.name || t('product', 'Product')}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150x150?text=No+Image';
                    }}
                  />
                </div>
                
                <div className="cart-item-info">
                  {(() => {
                    const originalPrice = Number(item.product?.original_price ?? item.product?.price ?? 0);
                    const discountedPrice = Number(item.product?.discounted_price ?? item.product?.price ?? 0);
                    const hasDiscount = Boolean(item.product?.has_discount) || discountedPrice < originalPrice;
                    return (
                      <>
                  <h3>
                    <Link to={`/products/${encodeURIComponent(item.product?.name || '')}`}>
                      {item.product?.name || t('product', 'Product')}
                    </Link>
                  </h3>
                  <p className="cart-item-price">
                    {hasDiscount ? (
                      <span className="cart-discount-price-block">
                        <span className="cart-old-price">
                          {formatPrice(originalPrice)}
                        </span>
                        <span className="cart-new-price">
                          {formatPrice(discountedPrice)}
                        </span>
                      </span>
                    ) : (
                      formatPrice(item.product?.price || 0)
                    )}
                  </p>
                      </>
                    );
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
                    disabled={loading || (item.quantity || 1) <= 1}
                  >
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
                    disabled={loading}
                  >
                    +
                  </button>
                </div>

                <div className="cart-item-total">
                  <p className="item-total">
                    {formatPrice(item.total || 0)}
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
                  aria-label="Remove item"
                  disabled={loading}
                >
                  ×
                </button>
              </motion.div>
            ))}
          </div>

          <div className="cart-summary">
            <motion.div
              className="summary-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2>Order Summary</h2>
              <div className="summary-row">
                <span>{t('subtotal', 'Subtotal')}:</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
              <div className="summary-row">
                <span>{t('shipping', 'Shipping')}:</span>
                <span>{t('free', 'Free')}</span>
              </div>
              <div className="summary-row total">
                <span>{t('total', 'Total')}:</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
              <motion.button
                className="checkout-btn"
                onClick={handleCheckout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t('proceedToCheckout', 'Proceed to Checkout')}
              </motion.button>
              <Link to="/products" className="continue-shopping-link">
                {t('continueShopping', 'Continue Shopping')}
              </Link>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
