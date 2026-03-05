import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatPrice } from '../utils/helpers';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/pages/Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const {
    cartItems,
    grandTotal,
    loading,
    updateCartItem,
    removeCartItem,
    fetchCart,
  } = useCart();

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
                    alt={item.product?.name || 'Product'}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150x150?text=No+Image';
                    }}
                  />
                </div>
                
                <div className="cart-item-info">
                  <h3>
                    <Link to={`/products/${encodeURIComponent(item.product?.name || '')}`}>
                      {item.product?.name || 'Product'}
                    </Link>
                  </h3>
                  <p className="cart-item-price">
                    {formatPrice(item.product?.price || 0)}
                  </p>
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
                <span>Subtotal:</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <span>Free</span>
              </div>
              <div className="summary-row total">
                <span>Total:</span>
                <span>{formatPrice(grandTotal)}</span>
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
