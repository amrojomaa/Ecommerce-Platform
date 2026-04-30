import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useWishlist } from '../hooks/useWishlist';
import { formatPrice } from '../utils/helpers';
import { FaHeart, FaTrash } from 'react-icons/fa';
import API_BASE_URL from '../config/api';
import '../styles/pages/Wishlist.css';

const Wishlist = () => {
  const { wishlistItems, removeFromWishlist, loading, fetchWishlist } = useWishlist();

  const handleRemove = (productName) => {
    if (window.confirm(`Remove ${productName} from wishlist?`)) {
      removeFromWishlist(productName);
    }
  };

  const getProductImage = (product) => {
    if (product.images && product.images.length > 0) {
      return `${API_BASE_URL}/${product.images[0]}`;
    }
    return `${API_BASE_URL}/images/placeholder.jpg`;
  };

  const handleDeleteAll = async () => {
    if (wishlistItems.length === 0) {
      return;
    }

    if (
      !window.confirm(
        'Are you sure you want to delete all items from your wishlist?'
      )
    ) {
      return;
    }

    const productNames = wishlistItems.map((item) => item.name);
    const results = [];
    for (const productName of productNames) {
      results.push(await removeFromWishlist(productName));
    }

    await fetchWishlist();

    const failed = results.some((result) => !result.success);

    if (failed) {
      toast.error(
        'Some wishlist items could not be deleted. Please try again.'
      );
      return;
    }

    toast.success('All wishlist items deleted');
  };

  if (wishlistItems.length === 0) {
    return (
      <div className="wishlist-page">
        <div className="wishlist-container">
          <h1>My Wishlist</h1>
          <div className="empty-wishlist">
            <FaHeart className="empty-icon" />
            <h2>Your wishlist is empty</h2>
            <p>Start adding products you love to your wishlist!</p>
            <Link to="/products" className="browse-products-btn">
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <div className="wishlist-container">
        <div className="wishlist-header">
          <h1>My Wishlist ({wishlistItems.length})</h1>
          <button
            type="button"
            className="delete-all-btn"
            onClick={handleDeleteAll}
            disabled={loading || wishlistItems.length === 0}
          >
            Delete all
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
                  handleRemove(product.name);
                }}
                title="Remove from wishlist"
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
