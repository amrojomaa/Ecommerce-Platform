import { tUi } from "../i18n/uiText";import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useWishlist } from '../hooks/useWishlist';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import { FaHeart, FaTrash } from 'react-icons/fa';
import API_BASE_URL from '../config/api';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Wishlist.css';

const Wishlist = () => {
  const { wishlistItems, removeFromWishlist, loading, fetchWishlist } =
  useWishlist();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();

  const handleRemove = async (productName) => {
    const confirmed = await confirm({
      title: tUi("ui.pages.wishlist.removeFromWishlist_a74e7f0fd2"),
      message: `Remove ${productName} from wishlist?`,
      confirmText: tUi("ui.pages.wishlist.remove_b2597b3f3e"),
      cancelText: tUi("ui.pages.wishlist.cancel_32e949f897")
    });
    if (confirmed) {
      await removeFromWishlist(productName);
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

    const confirmed = await confirm({
      title: tUi("ui.pages.wishlist.deleteAllItems_b7b329cb96"),
      message: tUi("ui.pages.wishlist.areYouSureYouWant_32be9b96fc"),
      confirmText: tUi("ui.pages.wishlist.deleteAll_6e9fe227ec"),
      cancelText: tUi("ui.pages.wishlist.cancel_32e949f897")
    });
    if (!confirmed) {
      return;
    }

    const productNames = wishlistItems.map((item) => item.name);
    for (const productName of productNames) {
      const result = await removeFromWishlist(productName);
      if (!result.success) {
        await fetchWishlist();
        toast.error(result.error || 'Some wishlist items could not be deleted. Please try again.');
        return;
      }
    }

    await fetchWishlist();
    toast.success(tUi("ui.pages.wishlist.allWishlistItemsDeleted_de016c0740"));
  };

  if (wishlistItems.length === 0) {
    return (
      <div className="wishlist-page-enhanced">
        <div className="wishlist-container-enhanced">
          <header className="wishlist-header-enhanced">
            <div>
              <h1 className="wishlist-title-enhanced">
                {tUi("ui.pages.wishlist.myWishlist_8547aa7391")} <span className="wishlist-title-count">(0)</span>
              </h1>
            </div>
          </header>
          <div className="empty-state-enhanced">
            <FaHeart className="empty-state-icon" />
            <h2 className="empty-state-title">{tUi("ui.pages.wishlist.yourWishlistIsEmpty_25ded470c1")}</h2>
            <p className="empty-state-text">{tUi("ui.pages.wishlist.startAddingProductsYouLove_1dae7ca234")}</p>
            <Link to="/products" className="empty-state-btn">
              {tUi("ui.pages.wishlist.browseProducts_69993227ec")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page-enhanced">
      <div className="wishlist-container-enhanced">
        <header className="wishlist-header-enhanced">
          <div>
            <h1 className="wishlist-title-enhanced">
              {tUi("ui.pages.wishlist.myWishlist_8547aa7391")} <span className="wishlist-title-count">({wishlistItems.length})</span>
            </h1>
          </div>
          <button
            type="button"
            className="delete-all-btn-enhanced"
            onClick={handleDeleteAll}
            disabled={loading || wishlistItems.length === 0}>
            {tUi("ui.pages.wishlist.deleteAll_6e9fe227ec")}
          </button>
        </header>

        <main className="wishlist-grid-enhanced">
          {wishlistItems.map((product, index) => {
            const originalPrice = Number(product.original_price ?? product.price ?? 0);
            const discountedPrice = Number(product.discounted_price ?? product.price ?? 0);
            const hasDiscount = Boolean(product.has_discount) || discountedPrice < originalPrice;

            return (
              <motion.article
                key={product.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="product-card-enhanced"
              >
                <div className="product-card-image-box">
                  <Link to={`/products/${encodeURIComponent(product.name)}`}>
                    <img
                      src={getProductImage(product)}
                      alt={localizeProduct(product, languageCode).localized_name}
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/images/placeholder.jpg`;
                      }}
                    />
                  </Link>
                  <button
                    className="product-card-remove-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(product.name);
                    }}
                    title={tUi("ui.pages.wishlist.removeFromWishlist_a74e7f0fd2")}
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                  </button>
                </div>
                
                <div className="product-card-info-box">
                  <Link to={`/products/${encodeURIComponent(product.name)}`} style={{ textDecoration: 'none' }}>
                    <h2 className="product-card-title">{localizeProduct(product, languageCode).localized_name}</h2>
                  </Link>
                  <span className="product-card-category">{localizeProduct(product, languageCode).localized_category_name}</span>
                  
                  {hasDiscount ? (
                    <div className="product-card-price-box">
                      <span className="product-card-price-old">{formatCurrency(originalPrice)}</span>
                      <span className="product-card-price-new">{formatCurrency(discountedPrice)}</span>
                    </div>
                  ) : (
                    <div className="product-card-price-box-flex">
                      <span className="product-card-price-regular">{formatCurrency(product.price)}</span>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </main>
      </div>
    </div>
  );
};

export default Wishlist;
