import { tUi } from '../i18n/uiText';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FaArrowRight,
  FaHeart,
  FaRegHeart,
  FaShoppingCart,
  FaStar,
  FaSync,
  FaUndo,
} from 'react-icons/fa';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import {
  fetchBatchRecommendations,
  fetchRealtimeRecommendations,
  resetRecommendationProfile,
} from '../services/recommendations';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import StarRating from '../components/StarRating';
import { ProductCardSkeleton } from '../components/Skeleton';
import { getImageUrl } from '../utils/helpers';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/pages/Products.css';
import '../styles/pages/Recommendations.css';

const Recommendations = () => {
  const confirm = useConfirm();
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const { isAuthenticated } = useAuth();
  const { formatCurrency } = useCurrency();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const [realtime, setRealtime] = useState([]);
  const [batch, setBatch] = useState([]);
  const [loadingRt, setLoadingRt] = useState(true);
  const [loadingBatch, setLoadingBatch] = useState(true);
  const [refreshingBatch, setRefreshingBatch] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [historyJustCleared, setHistoryJustCleared] = useState(false);

  const loadRealtime = useCallback(async () => {
    setLoadingRt(true);
    try {
      const { data } = await fetchRealtimeRecommendations(12);
      setRealtime(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err?.message || tUi('ui.pages.recommendations.failedLoadRealtime_b4e8c2d407'));
      setRealtime([]);
    } finally {
      setLoadingRt(false);
    }
  }, []);

  const loadBatch = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshingBatch(true);
    } else {
      setLoadingBatch(true);
    }
    try {
      const { data } = await fetchBatchRecommendations(15, forceRefresh);
      setBatch(Array.isArray(data) ? data : []);
      if (forceRefresh) {
        toast.success(tUi('ui.pages.recommendations.batchRecommendationsRefreshed_3c588c1cd7'));
      }
    } catch (err) {
      toast.error(err?.message || tUi('ui.pages.recommendations.failedLoadBatch_b4e8c2d408'));
      setBatch([]);
    } finally {
      setLoadingBatch(false);
      setRefreshingBatch(false);
    }
  }, []);

  useEffect(() => {
    loadRealtime();
    loadBatch(false);
  }, [loadRealtime, loadBatch]);

  const handleResetRecommendations = async () => {
    const ok = await confirm({
      title: tUi('ui.pages.recommendations.resetRecommendations_849eafbc0e'),
      message: tUi('ui.pages.recommendations.thisClearsYourSavedProduct_09c55cba3d'),
      confirmText: tUi('ui.pages.recommendations.reset_fa323b2d19'),
      cancelText: tUi('ui.pages.recommendations.cancel_5a0d97a8e1'),
    });
    if (!ok) {
      return;
    }

    setResetting(true);
    try {
      const { data } = await resetRecommendationProfile();
      const n = typeof data?.interactions_deleted === 'number' ? data.interactions_deleted : null;
      setRealtime([]);
      setBatch([]);
      setHistoryJustCleared(true);
      toast.success(
        n !== null && n >= 0
          ? tUi('ui.pages.recommendations.resetSuccessWithCount_b4e8c2d410', { value0: n })
          : tUi('ui.pages.recommendations.resetSuccess_b4e8c2d411')
      );
    } catch (err) {
      toast.error(err?.message || tUi('ui.pages.recommendations.failedReset_b4e8c2d409'));
    } finally {
      setResetting(false);
    }
  };

  const handleAddToCart = async (event, product) => {
    event.preventDefault();
    event.stopPropagation();
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

  const handleWishlistToggle = async (event, product) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      if (isInWishlist(product.name)) {
        await removeFromWishlist(product.name);
      } else {
        await addToWishlist(product);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || tUi('ui.pages.wishlist.failedToDelete_b4e8c2d2d4'));
    }
  };

  const renderProductCard = (entry, index) => {
    const product = entry.product;
    if (!product) {
      return null;
    }

    const localized = localizeProduct(product, languageCode);
    const originalPrice = Number(product.original_price ?? product.price ?? 0);
    const discountedPrice = Number(product.discounted_price ?? product.price ?? 0);
    const hasDiscount = Boolean(product.discount_enabled) || discountedPrice < originalPrice;
    const productId = product.id ?? null;
    const inWishlist = isInWishlist(product.name);

    return (
      <motion.div
        key={`${product.id}-${index}`}
        className="products-card-wrapper"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.45 }}
        whileHover={{ y: -5 }}
      >
        <Link to={`/products/${encodeURIComponent(product.name)}`} className="products-card">
          <div className="products-card-media">
            <span className="products-card-media-category">{localized.localized_category_name}</span>
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
            {isAuthenticated && (
              <button
                type="button"
                className={`products-card-wishlist-btn${inWishlist ? ' active' : ''}`}
                onClick={(event) => handleWishlistToggle(event, product)}
                aria-label={
                  inWishlist
                    ? tUi('ui.pages.products.removeFromWishlist_7b86347347')
                    : tUi('ui.pages.products.addToWishlist_e79ca5d19a')
                }
              >
                {inWishlist ? (
                  <FaHeart className="wishlist-icon-filled" aria-hidden="true" />
                ) : (
                  <FaRegHeart className="wishlist-icon-outline" aria-hidden="true" />
                )}
              </button>
            )}
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
                  onClick={(event) => handleAddToCart(event, product)}
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
  };

  const renderSectionBody = (items, loading, emptyMessage) => {
    if (loading && items.length === 0) {
      return (
        <div className="products-grid reco-grid">
          {[...Array(6)].map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <motion.div
          className="reco-empty"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FaStar className="reco-empty-icon" aria-hidden="true" />
          <h3>{tUi('ui.pages.recommendations.emptyTitle_b4e8c2d404')}</h3>
          <p>{emptyMessage}</p>
          <Link to="/products" className="page-btn-primary reco-empty-cta">
            {tUi('ui.pages.wishlist.browseProducts_69993227ec')}
            <FaArrowRight aria-hidden="true" />
          </Link>
        </motion.div>
      );
    }

    return <div className="products-grid reco-grid">{items.map((entry, index) => renderProductCard(entry, index))}</div>;
  };

  return (
    <div className="page-shell page-shell--storefront reco-page">
      <PageHeader
        kicker={t('navbar.forYou')}
        title={tUi('ui.pages.recommendations.recommendedForYou_33db7a2db1')}
        subtitle={tUi('ui.pages.recommendations.usesYourViewsSearchesWishlist_7518b14b04')}
        animate={false}
        actions={
          <motion.button
            type="button"
            className="reco-reset-btn"
            onClick={handleResetRecommendations}
            disabled={resetting}
            title={tUi('ui.pages.recommendations.clearRecommendationHistoryDoesNot_d511c61ddd')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FaUndo aria-hidden="true" />
            {resetting
              ? tUi('ui.pages.recommendations.resetting_c7defdfad7')
              : tUi('ui.pages.recommendations.resetRecommendations_10844cd05c')}
          </motion.button>
        }
      />

      {historyJustCleared && (
        <motion.div
          className="reco-cleared-banner"
          role="status"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {tUi('ui.pages.recommendations.clearedBannerMessage_b4e8c2d413')}
        </motion.div>
      )}

      <section className="reco-section" aria-label={tUi('ui.pages.recommendations.realtime_37d7df59d7')}>
        <div className="reco-section-header">
          <div className="reco-section-header-copy">
            <span className="page-kicker">{tUi('ui.pages.recommendations.realtimeKicker_b4e8c2d415')}</span>
            <h2 className="reco-section-title">{tUi('ui.pages.recommendations.realtime_37d7df59d7')}</h2>
            <p className="reco-section-subtitle">
              {tUi('ui.pages.recommendations.realtimeSubtitle_b4e8c2d402')}
            </p>
          </div>
          <motion.button
            type="button"
            className="page-btn-secondary reco-action-btn"
            onClick={() => loadRealtime()}
            disabled={loadingRt}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FaSync className={loadingRt ? 'reco-spin' : ''} aria-hidden="true" />
            {tUi('ui.pages.recommendations.refresh_ba2298225f')}
          </motion.button>
        </div>

        {loadingRt && realtime.length > 0 ? (
          <div className="reco-inline-loading">
            <LoadingSpinner size="small" />
          </div>
        ) : null}

        {renderSectionBody(
          realtime,
          loadingRt,
          tUi('ui.pages.recommendations.nothingYetViewAProduct_7f253a9a74')
        )}
      </section>

      <section className="reco-section" aria-label={tUi('ui.pages.recommendations.batchCached_5246e3e266')}>
        <div className="reco-section-header">
          <div className="reco-section-header-copy">
            <span className="page-kicker">{tUi('ui.pages.recommendations.batchKicker_b4e8c2d416')}</span>
            <h2 className="reco-section-title">{tUi('ui.pages.recommendations.batchCached_5246e3e266')}</h2>
            <p className="reco-section-subtitle">
              {tUi('ui.pages.recommendations.batchSubtitle_b4e8c2d403')}
            </p>
          </div>
          <div className="reco-section-actions">
            <motion.button
              type="button"
              className="page-btn-secondary reco-action-btn"
              onClick={() => loadBatch(false)}
              disabled={loadingBatch || refreshingBatch}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FaSync className={loadingBatch ? 'reco-spin' : ''} aria-hidden="true" />
              {tUi('ui.pages.recommendations.loadCache_e03259ab79')}
            </motion.button>
            <motion.button
              type="button"
              className="page-btn-primary reco-action-btn"
              onClick={() => loadBatch(true)}
              disabled={loadingBatch || refreshingBatch}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FaSync className={refreshingBatch ? 'reco-spin' : ''} aria-hidden="true" />
              {tUi('ui.pages.recommendations.recomputeNow_bac7d8c8a7')}
            </motion.button>
          </div>
        </div>

        {renderSectionBody(
          batch,
          loadingBatch,
          tUi('ui.pages.recommendations.noBatchResultsYetView_1937d58ec4')
        )}
      </section>
    </div>
  );
};

export default Recommendations;
