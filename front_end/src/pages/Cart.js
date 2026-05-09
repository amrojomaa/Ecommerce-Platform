import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useCart } from '../hooks/useCart';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import { getImageUrl } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Cart.css';

const Cart = () => {
  const navigate = useNavigate();
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

  // useEffect(() => {
  //   fetchCart();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (!itemId) {
      toast.error('Invalid item ID');
      return;
    }
    
    // Ensure minimum quantity is 1
    if (newQuantity < 1) {
      newQuantity = 1;
    }
    
    const result = await updateCartItem(itemId, newQuantity);
    if (result.success) {
      toast.success('Cart updated');
    } else {
      toast.error(result.error || 'Failed to update cart');
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!itemId) {
      toast.error('Invalid item ID');
      return;
    }
    
    const result = await removeCartItem(itemId);
    if (result.success) {
      toast.success('Item removed from cart');
    } else {
      toast.error(result.error || 'Failed to remove item');
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    navigate('/checkout');
  };

  const handleDeleteAll = async () => {
    if (cartItems.length === 0) {
      return;
    }

    const confirmed = await confirm({
      title: 'Delete all items',
      message: 'Are you sure you want to delete all items from your cart?',
      confirmText: 'Delete all',
      cancelText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }

    const results = await Promise.all(
      cartItems.map((item) => removeCartItem(item.id))
    );
    const failed = results.some((result) => !result.success);

    if (failed) {
      toast.error('Some items could not be deleted. Please try again.');
      return;
    }

    toast.success('All items deleted from cart');
  };

  if (loading) {
    return (
      <div className="cart-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Shopping Cart</h1>
      
      {cartItems.length === 0 ? (
        <motion.div
          className="empty-cart"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>Your cart is empty</p>
          <Link to="/products" className="continue-shopping-btn">
            Continue Shopping
          </Link>
        </motion.div>
      ) : (
        <div className="cart-container">
          <div className="cart-items">
            <div className="cart-items-actions">
              <button
                type="button"
                className="delete-all-btn"
                onClick={handleDeleteAll}
                disabled={loading || cartItems.length === 0}
              >
                Delete all
              </button>
            </div>
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
                      ? getImageUrl(item.product.images[0])
                      : getImageUrl('/images/placeholder.jpg')}
                    alt={item.product?.name || 'Product'}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
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
                      {item.product?.name || 'Product'}
                    </Link>
                  </h3>
                  <p className="cart-item-price">
                    {hasDiscount ? (
                      <span className="cart-discount-price-block">
                        <span className="cart-old-price">
                          {formatCurrency(originalPrice)}
                        </span>
                        <span className="cart-new-price">
                          {formatCurrency(discountedPrice)}
                        </span>
                      </span>
                    ) : (
                      formatCurrency(item.product?.price || 0)
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
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {promotionDiscount > 0 && (
                <div className="summary-row summary-row-discount">
                  <span>
                    Promotion{appliedPromotion?.name ? ` (${appliedPromotion.name})` : ''}:
                  </span>
                  <span>-{formatCurrency(promotionDiscount)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Shipping:</span>
                <span>Free</span>
              </div>
              <div className="summary-row total">
                <span>Total:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
              <motion.button
                className="checkout-btn"
                onClick={handleCheckout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Proceed to Checkout
              </motion.button>
              <Link to="/products" className="continue-shopping-link">
                Continue Shopping
              </Link>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
