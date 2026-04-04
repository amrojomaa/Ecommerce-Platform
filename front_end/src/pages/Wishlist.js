import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useWishlist } from '../hooks/useWishlist';
import { formatPrice } from '../utils/helpers';
import { useLanguage } from '../hooks/useLanguage';
import { useDialog } from '../hooks/useDialog';
import { FaHeart, FaTrash } from 'react-icons/fa';
import API_BASE_URL from '../config/api';
import '../styles/pages/Wishlist.css';

const Wishlist = () => {
  const { wishlistItems, removeFromWishlist, clearWishlist } = useWishlist();
  const { t, isRTL } = useLanguage();
  const { showConfirm } = useDialog();

  const openRemoveConfirm = async (productName) => {
    const confirmed = await showConfirm({
      message: `${t('remove', 'Remove')} ${productName} ${t('fromWishlistQuestion', 'from wishlist?')}`,
      confirmText: t('ok', 'OK'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) return;

    const result = await removeFromWishlist(productName);
    if (!result?.success) {
      toast.error(result?.error || t('failedRemoveWishlist', 'Failed to remove item from wishlist'));
    }
  };

  const openClearConfirm = async () => {
    if (!wishlistItems.length) return;

    const confirmed = await showConfirm({
      message: t('clearWishlistQuestion', 'Are you sure you want to delete all items from wishlist?'),
      confirmText: t('ok', 'OK'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) return;

    const result = await clearWishlist();
    if (!result?.success) {
      toast.error(result?.error || t('failedClearWishlist', 'Failed to clear wishlist'));
    }
  };

  const getProductImage = (product) => {
    if (product.images && product.images.length > 0) {
      return `${API_BASE_URL}/${product.images[0]}`;
    }
    return `${API_BASE_URL}/images/placeholder.jpg`;
  };

  if (wishlistItems.length === 0) {
    return (
      <div className="wishlist-page">
        <div className="wishlist-container">
          <h1>{t('myWishlist', 'My Wishlist')}</h1>
          <div className="empty-wishlist">
            <FaHeart className="empty-icon" />
            <h2>{t('wishlistEmpty', 'Your wishlist is empty')}</h2>
            <p>{t('wishlistStartAdding', 'Start adding products you love to your wishlist!')}</p>
            <Link to="/products" className="browse-products-btn">
              {t('browseProducts', 'Browse Products')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="wishlist-container">
        <div className="wishlist-header">
          <h1>{t('myWishlist', 'My Wishlist')} ({wishlistItems.length})</h1>
          <button
            className="clear-wishlist-btn"
            onClick={openClearConfirm}
            type="button"
            title={t('clearWishlist', 'Delete All')}
          >
            <FaTrash />
            <span>{t('clearWishlist', 'Delete All')}</span>
          </button>
        </div>
        <div className="wishlist-grid">
          {wishlistItems.map((product, index) => (
            <motion.div
              key={product.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="wishlist-item"
            >
              <Link
                to={`/products/${encodeURIComponent(product.name)}`}
                className="wishlist-item-link"
              >
                <div className="wishlist-item-image">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    onError={(e) => {
                      e.target.src = `${API_BASE_URL}/images/placeholder.jpg`;
                    }}
                  />
                </div>
                <div className="wishlist-item-info">
                  <h3>{product.name}</h3>
                  <p className="wishlist-item-category">{product.category_name}</p>
                  {(() => {
                    const originalPrice = Number(product.original_price ?? product.price ?? 0);
                    const discountedPrice = Number(product.discounted_price ?? product.price ?? 0);
                    const hasDiscount = Boolean(product.has_discount) || discountedPrice < originalPrice;
                    return hasDiscount ? (
                      <div className="wishlist-price-block">
                        <p className="wishlist-item-price-old">{formatPrice(originalPrice)}</p>
                        <p className="wishlist-item-price-new">{formatPrice(discountedPrice)}</p>
                      </div>
                    ) : (
                      <p className="wishlist-item-price">{formatPrice(product.price)}</p>
                    );
                  })()}
                </div>
              </Link>
              <button
                className="remove-wishlist-btn"
                onClick={(e) => {
                  e.preventDefault();
                  openRemoveConfirm(product.name);
                }}
                title={t('removeFromWishlist', 'Remove from wishlist')}
              >
                <FaTrash />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Wishlist;
