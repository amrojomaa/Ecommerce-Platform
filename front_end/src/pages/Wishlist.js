import { tUi } from '../i18n/uiText';
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaArrowRight, FaHeart, FaShoppingCart, FaTrash } from 'react-icons/fa';
import { useWishlist } from '../hooks/useWishlist';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { getImageUrl } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import StarRating from '../components/StarRating';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Products.css';
import '../styles/pages/Wishlist.css';

const Wishlist = () => {
  const { wishlistItems, removeFromWishlist, loading, fetchWishlist } = useWishlist();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const resolveProductId = (item) => item.product_id ?? item.product?.id ?? null;

  const getHeaderSubtitle = () => {
    if (wishlistItems.length === 0) {
      return tUi('ui.pages.wishlist.subtitleEmpty_b4e8c2d2d1');
    }

    return tUi('ui.pages.wishlist.subtitleWithItems_b4e8c2d2d0', { count: wishlistItems.length });
  };

  const handleRemove = async (product) => {
    const localized = localizeProduct(product, languageCode);
    const confirmed = await confirm({
      title: tUi('ui.pages.wishlist.removeFromWishlist_a74e7f0fd2'),
      message: tUi('ui.pages.wishlist.removeConfirmMessage_b4e8c2d2d2', {
        value0: localized.localized_name || product.name,
      }),
      confirmText: tUi('ui.pages.wishlist.remove_b2597b3f3e'),
      cancelText: tUi('ui.pages.wishlist.cancel_32e949f897'),
    });

    if (confirmed) {
      await removeFromWishlist(product.name);
    }
  };

  const handleDeleteAll = async () => {
    if (wishlistItems.length === 0) {
      return;
    }

    const confirmed = await confirm({
      title: tUi('ui.pages.wishlist.deleteAllItems_b7b329cb96'),
      message: tUi('ui.pages.wishlist.areYouSureYouWant_32be9b96fc'),
      confirmText: tUi('ui.pages.wishlist.deleteAll_6e9fe227ec'),
      cancelText: tUi('ui.pages.wishlist.cancel_32e949f897'),
    });

    if (!confirmed) {
      return;
    }

    const productNames = wishlistItems.map((item) => item.name);
    for (const productName of productNames) {
      const result = await removeFromWishlist(productName);
      if (!result.success) {
        await fetchWishlist();
        toast.error(result.error || tUi('ui.pages.wishlist.failedToDelete_b4e8c2d2d4'));
        return;
      }
    }

    await fetchWishlist();
    toast.success(tUi('ui.pages.wishlist.allWishlistItemsDeleted_de016c0740'));
  };

  const handleAddToCart = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await addToCart(product.name, 1);
      if (result.success) {
        toast.success(tUi('ui.pages.products.productAddedToCart_577eece582'));
      } else {
        toast.error(result.error || tUi('ui.pages.wishlist.failedToAddToCart_b4e8c2d2d5'));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || tUi('ui.pages.wishlist.failedToAddToCart_b4e8c2d2d5'));
    }
  };

  if (loading && wishlistItems.length === 0) {
    return (
      <div className="page-loading wishlist-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--storefront wishlist-page">
      <PageHeader
        title={tUi('ui.pages.wishlist.myWishlist_8547aa7391')}
        subtitle={getHeaderSubtitle()}
        animate={false}
        actions={
          wishlistItems.length > 0 ? (
            <motion.button
              type="button"
              className="wishlist-delete-all-btn"
              onClick={handleDeleteAll}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FaTrash aria-hidden="true" />
              {tUi('ui.pages.wishlist.deleteAll_6e9fe227ec')}
            </motion.button>
          ) : null
        }
      />

      {wishlistItems.length === 0 ? (
        <motion.section
          className="wishlist-empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          aria-label={tUi('ui.pages.wishlist.yourWishlistIsEmpty_25ded470c1')}
        >
          <FaHeart className="wishlist-empty-icon" aria-hidden="true" />
          <h2>{tUi('ui.pages.wishlist.yourWishlistIsEmpty_25ded470c1')}</h2>
          <p>{tUi('ui.pages.wishlist.startAddingProductsYouLove_1dae7ca234')}</p>
          <Link to="/products" className="page-btn-primary wishlist-empty-cta">
            {tUi('ui.pages.wishlist.browseProducts_69993227ec')}
            <FaArrowRight aria-hidden="true" />
          </Link>
        </motion.section>
      ) : (
        <section className="wishlist-grid-section" aria-label={tUi('ui.pages.wishlist.myWishlist_8547aa7391')}>
          <div className="products-grid">
            {wishlistItems.map((product, index) => {
              const localized = localizeProduct(product, languageCode);
              const originalPrice = Number(product.original_price ?? product.price ?? 0);
              const discountedPrice = Number(product.discounted_price ?? product.price ?? 0);
              const hasDiscount = Boolean(product.has_discount) || discountedPrice < originalPrice;
              const discountPercent =
                hasDiscount && originalPrice > 0
                  ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)
                  : 0;
              const productId = resolveProductId(product);

              return (
                <motion.div
                  key={product.name}
                  className="products-card-wrapper"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                  whileHover={{ y: -5 }}
                >
                  <Link to={`/products/${encodeURIComponent(product.name)}`} className="products-card">
                    <div className="products-card-media">
                      <span className="products-card-media-category">
                        {localized.localized_category_name}
                      </span>
                      {discountPercent > 0 && (
                        <span className="wishlist-discount-badge">-{discountPercent}%</span>
                      )}
                      <img
                        src={
                          product.images?.length
                            ? getImageUrl(product.images[0])
                            : getImageUrl('/images/placeholder.jpg')
                        }
                        alt={localized.localized_name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getImageUrl('/images/placeholder.jpg');
                        }}
                      />
                      <button
                        type="button"
                        className="wishlist-remove-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemove(product);
                        }}
                        aria-label={tUi('ui.pages.wishlist.removeFromWishlist_a74e7f0fd2')}
                        disabled={loading}
                      >
                        <FaTrash aria-hidden="true" />
                      </button>
                    </div>

                    <div className="products-card-body">
                      <h3 className="products-card-title">{localized.localized_name}</h3>
                      {productId && (
                        <div className="products-card-rating">
                          <StarRating
                            productId={productId}
                            showLabel={false}
                            interactive={false}
                            size="small"
                            initialAverageRating={product.average_rating}
                            initialTotalRatings={product.total_ratings}
                            fetchOnMount
                          />
                        </div>
                      )}
                      <div className="products-card-footer">
                        <div className="products-card-pricing">
                          {hasDiscount ? (
                            <>
                              <span className="products-card-price products-card-price-sale">
                                {formatCurrency(discountedPrice)}
                              </span>
                              <span className="products-card-price-before">{formatCurrency(originalPrice)}</span>
                            </>
                          ) : (
                            <span className="products-card-price">{formatCurrency(product.price)}</span>
                          )}
                        </div>
                        {isAuthenticated && (
                          <button
                            type="button"
                            className="products-card-cart-btn"
                            onClick={(e) => handleAddToCart(e, product)}
                            title={tUi('ui.pages.products.addToCart_0ebb524946')}
                          >
                            <FaShoppingCart aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default Wishlist;
