import { tUi } from "../i18n/uiText";import React from 'react';
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
    removeCartItem
  } = useCart();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();

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
      <div className="cart-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  return (
    <div className="cart-page">
      <h1>{tUi("ui.pages.cart.shoppingCart_7367ced874")}</h1>
      
      {cartItems.length === 0 ?
      <motion.div
        className="empty-cart"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        
          <p>{tUi("ui.pages.cart.yourCartIsEmpty_977a093fcf")}</p>
          <Link to="/products" className="continue-shopping-btn">{tUi("ui.pages.cart.continueShopping_5009154016")}

        </Link>
        </motion.div> :

      <div className="cart-container">
          <div className="cart-items">
            <div className="cart-items-actions">
              <button
              type="button"
              className="delete-all-btn"
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
                alt={item.product?.name || tUi("ui.pages.cart.product_d44e1d3515")}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                }} />
              
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
                      {item.product?.name || tUi("ui.pages.cart.product_d44e1d3515")}
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
              
                  ×
                </button>
              </motion.div>
          )}
          </div>

          <div className="cart-summary">
            <motion.div
            className="summary-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}>
            
              <h2>{tUi("ui.pages.cart.orderSummary_97f6cd5623")}</h2>
              <div className="summary-row">
                <span>{tUi("ui.pages.cart.subtotal_a87a323a5f")}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {promotionDiscount > 0 &&
            <div className="summary-row summary-row-discount">
                  <span>{tUi("ui.pages.cart.promotion_956ee3b550")}
                {appliedPromotion?.name ? tUi("ui.pages.cart.value_dbed6349c6", { value0: appliedPromotion.name }) : ''}:
                  </span>
                  <span>-{formatCurrency(promotionDiscount)}</span>
                </div>
            }
              <div className="summary-row">
                <span>{tUi("ui.pages.cart.shipping_1bc05a98aa")}</span>
                <span>{tUi("ui.pages.cart.free_0b31c2b7fd")}</span>
              </div>
              <div className="summary-row total">
                <span>{tUi("ui.pages.cart.total_cf0b507074")}</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
              <motion.button
              className="checkout-btn"
              onClick={handleCheckout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}>{tUi("ui.pages.cart.proceedToCheckout_48e6337c2b")}


            </motion.button>
              <Link to="/products" className="continue-shopping-link">{tUi("ui.pages.cart.continueShopping_5009154016")}

            </Link>
            </motion.div>
          </div>
        </div>
      }
    </div>);

};

export default Cart;
