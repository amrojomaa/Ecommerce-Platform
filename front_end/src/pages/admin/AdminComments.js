import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { FaStar } from 'react-icons/fa';
import { FiCheck, FiFlag } from 'react-icons/fi';
import http from '../../services/http';
import { COMMENT_ENDPOINTS, PRODUCT_ENDPOINTS, RATING_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import { formatDate, getCatalogImageUrl } from '../../utils/helpers';
import { localizeProduct } from '../../utils/localizedContent';
import { normalizeLanguageCode } from '../../i18n/constants';
import { tUi } from '../../i18n/uiText';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import StarRating from '../../components/StarRating';
import { useConfirm } from '../../hooks/useConfirm';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminComments.css';

const SENTIMENT_LABEL_KEYS = {
  positive: 'ui.pages.admin.adminComments.sentimentPositive_70da220f7a',
  neutral: 'ui.pages.admin.adminComments.sentimentNeutral_1adf64fbd4',
  negative: 'ui.pages.admin.adminComments.sentimentNegative_78ec8a0d98',
};

const AdminComments = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [comments, setComments] = useState([]);
  const [filteredComments, setFilteredComments] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(productId ? parseInt(productId, 10) : null);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [approving, setApproving] = useState(null);
  const [pageView, setPageView] = useState('catalog');
  const [reportedComments, setReportedComments] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const confirm = useConfirm();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const commentsBasePath = user?.role === 'support_manager' ? '/support/comments' : '/admin/comments';

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    fetchReportedComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      fetchComments();
      fetchRatingSummary(selectedProductId);
    } else {
      setComments([]);
      setFilteredComments([]);
      setRatingSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  useEffect(() => {
    filterComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentimentFilter, comments]);

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const productsEndpoint =
        user?.role === 'support_manager' ? PRODUCT_ENDPOINTS.ALL : PRODUCT_ENDPOINTS.ALL_ADMIN;
      const response = await http.get(productsEndpoint, {
        params: { catalog_only: true },
      });
      setProducts(response.data || []);

      if (productId) {
        setSelectedProductId(parseInt(productId, 10));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(tUi('ui.pages.admin.adminComments.failedToFetchProducts_91dffdab28'));
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!selectedProductId) return;

    setCommentsLoading(true);
    try {
      const response = await http.get(
        buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: selectedProductId }),
        { params: { skip: 0, limit: 1000 } }
      );
      setComments(response.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error(tUi('ui.pages.admin.adminComments.failedToFetchComments_a09ce4627e'));
    } finally {
      setCommentsLoading(false);
    }
  };

  const fetchRatingSummary = async (nextProductId) => {
    try {
      const response = await http.get(
        buildUrl(RATING_ENDPOINTS.GET_PRODUCT, { product_id: nextProductId })
      );
      setRatingSummary(response.data || null);
    } catch (error) {
      console.error('Error fetching rating summary:', error);
      setRatingSummary(null);
    }
  };

  const handleProductSelect = (nextProductId) => {
    setSelectedProductId(nextProductId);
    setSentimentFilter('all');
    navigate(`${commentsBasePath}/product/${nextProductId}`, { replace: true });
  };

  const handleClearProduct = () => {
    setSelectedProductId(null);
    setSentimentFilter('all');
    navigate(commentsBasePath, { replace: true });
  };

  const filterComments = () => {
    if (sentimentFilter === 'all') {
      setFilteredComments(comments);
    } else {
      setFilteredComments(comments.filter((comment) => comment.sentiment === sentimentFilter));
    }
  };

  const fetchReportedComments = async () => {
    setReportsLoading(true);
    try {
      const response = await http.get(COMMENT_ENDPOINTS.ALL, {
        params: { skip: 0, limit: 200, is_reported: true },
      });
      setReportedComments(response.data || []);
    } catch (error) {
      console.error('Error fetching reported comments:', error);
      toast.error(tUi('ui.pages.admin.adminComments.failedToFetchComments_a09ce4627e'));
      setReportedComments([]);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleApprove = async (commentId) => {
    setApproving(commentId);
    try {
      await http.patch(buildUrl(COMMENT_ENDPOINTS.APPROVE, { comment_id: commentId }));
      toast.success(tUi('ui.pages.support_manager.comments.approveSuccess'));
      await fetchReportedComments();
    } catch (error) {
      toast.error(tUi('ui.pages.support_manager.comments.approveFailed'));
    } finally {
      setApproving(null);
    }
  };

  const handleDelete = async (commentId) => {
    const confirmed = await confirm({
      title: tUi('ui.pages.admin.adminComments.deleteComment_d6666490e7'),
      message: tUi('ui.pages.admin.adminComments.areYouSureYouWant_b3d0559f52'),
      confirmText: tUi('ui.pages.admin.adminComments.delete_66f5dde37d'),
      cancelText: tUi('ui.pages.admin.adminComments.cancel_117ba1126e'),
    });
    if (!confirmed) {
      return;
    }

    setDeleting(commentId);
    try {
      await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
      toast.success(tUi('ui.pages.admin.adminComments.commentDeletedSuccessfully_a8f689dd50'));
      if (selectedProductId) {
        await fetchComments();
        await fetchRatingSummary(selectedProductId);
        await fetchProducts();
      }
      if (pageView === 'reports') {
        await fetchReportedComments();
      }
    } catch (error) {
      toast.error(tUi('ui.pages.admin.adminComments.failedToDeleteComment_1a364f7e19'));
    } finally {
      setDeleting(null);
    }
  };

  const getSentimentBadge = (sentiment) => {
    if (!sentiment) return null;
    const normalized = sentiment.toLowerCase();

    const getSentimentLabel = (value) => {
      const key = SENTIMENT_LABEL_KEYS[value];
      if (key) return tUi(key);
      return value;
    };

    const badges = {
      positive: { text: getSentimentLabel('positive'), class: 'sentiment-badge-positive', icon: '👍' },
      neutral: { text: getSentimentLabel('neutral'), class: 'sentiment-badge-neutral', icon: '😐' },
      negative: { text: getSentimentLabel('negative'), class: 'sentiment-badge-negative', icon: '👎' },
    };

    const badge = badges[normalized];
    if (!badge) return null;

    return (
      <span className={`sentiment-badge ${badge.class}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const getSentimentCounts = () => ({
    all: comments.length,
    positive: comments.filter((c) => c.sentiment === 'positive').length,
    neutral: comments.filter((c) => c.sentiment === 'neutral').length,
    negative: comments.filter((c) => c.sentiment === 'negative').length,
  });

  const renderStars = (rating) => {
    const safeRating = Number(rating) || 0;
    return [1, 2, 3, 4, 5].map((value) => (
      <FaStar
        key={value}
        className={value <= safeRating ? 'review-star filled' : 'review-star'}
      />
    ));
  };

  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage || (typeof profileImage === 'string' && profileImage.trim() === '')) {
      return defaultProfileImage;
    }

    if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
      return profileImage;
    }

    const normalizedPath = profileImage.startsWith('/') ? profileImage.slice(1) : profileImage;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category_name).filter(Boolean))].sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const localized = localizeProduct(product, languageCode);
      const matchesSearch =
        !query ||
        localized.localized_name.toLowerCase().includes(query) ||
        localized.localized_category_name.toLowerCase().includes(query);
      const matchesCategory = !categoryFilter || product.category_name === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, productSearch, categoryFilter, languageCode]);

  const getCategoryLabel = (categoryValue) => {
    const matched = products.find((product) => product.category_name === categoryValue);
    if (!matched) return categoryValue;
    return localizeProduct(matched, languageCode).localized_category_name;
  };

  const counts = getSentimentCounts();
  const getSentimentLabel = (value) => {
    const key = SENTIMENT_LABEL_KEYS[value];
    if (key) return tUi(key);
    return value;
  };

  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedLocalizedProduct = selectedProduct
    ? localizeProduct(selectedProduct, languageCode)
    : null;
  const selectedAverageRating = Number(
    ratingSummary?.average_rating ?? selectedProduct?.average_rating ?? 0
  );
  const selectedTotalRatings = Number(
    ratingSummary?.total_ratings ?? selectedProduct?.total_ratings ?? 0
  );

  const manageReviewsTitle = tUi('ui.pages.admin.adminComments.manageReviews_9e45000031');

  const renderProductCard = (product, index, options = {}) => {
    const { readonly = false } = options;
    const localized = localizeProduct(product, languageCode);
    const imageSrc =
      product.images && product.images.length > 0
        ? getCatalogImageUrl(product.images[0])
        : getCatalogImageUrl('/images/placeholder.jpg');
    const isSelected = selectedProductId === product.id;
    const cardClassName = `adm-reviews-card ${isSelected ? 'is-selected' : ''} ${
      readonly ? 'is-readonly' : ''
    }`.trim();

    const cardInner = (
      <>
        <div className="adm-reviews-card-media">
          <span className="adm-reviews-card-category">{localized.localized_category_name}</span>
          <img
            src={imageSrc}
            alt={localized.localized_name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = getCatalogImageUrl('/images/placeholder.jpg');
            }}
          />
        </div>
        <div className="adm-reviews-card-body">
          <h3 className="adm-reviews-card-title">{localized.localized_name}</h3>
          {product.id && (
            <div className="adm-reviews-card-rating">
              <StarRating
                productId={product.id}
                showLabel={false}
                interactive={false}
                size="small"
                initialAverageRating={product.average_rating}
                initialTotalRatings={product.total_ratings}
                fetchOnMount={false}
              />
            </div>
          )}
          <div className="adm-reviews-card-footer">
            {product.discount_enabled ? (
              <div className="adm-reviews-card-pricing">
                <span className="adm-reviews-card-price adm-reviews-card-price-sale">
                  {formatCurrency(product.discounted_price ?? product.price)}
                </span>
                <span className="adm-reviews-card-price-before">{formatCurrency(product.price)}</span>
              </div>
            ) : (
              <span className="adm-reviews-card-price">{formatCurrency(product.price)}</span>
            )}
          </div>
        </div>
      </>
    );

    return (
      <div
        key={product.id}
        className="adm-reviews-card-wrapper"
      >
        {readonly ? (
          <div className={cardClassName} aria-current={isSelected ? 'true' : undefined}>
            {cardInner}
          </div>
        ) : (
          <button
            type="button"
            className={cardClassName}
            onClick={() => handleProductSelect(product.id)}
            aria-pressed={isSelected}
          >
            {cardInner}
          </button>
        )}
      </div>
    );
  };

  const renderReportedCommentCard = (comment, index) => (
    <motion.div
      key={comment.id}
      className="comment-card is-reported"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="comment-header">
        <div className="comment-user">
          {comment.user?.profile_image ? (
            <img
              src={getProfileImageUrl(comment.user.profile_image)}
              alt={comment.user.first_name}
              className="user-avatar"
              onError={(event) => {
                if (event.target.src !== defaultProfileImage) {
                  event.target.src = defaultProfileImage;
                }
              }}
            />
          ) : (
            <div className="user-avatar-placeholder">
              {comment.user?.first_name?.[0] || 'U'}
            </div>
          )}
          <div className="user-info">
            <p className="user-name">
              {comment.user?.first_name} {comment.user?.last_name}
            </p>
            <p className="comment-date">{formatDate(comment.created_at)}</p>
          </div>
        </div>
        <div className="comment-actions">
          <span className="adm-reviews-report-badge">
            <FiFlag aria-hidden />
            {tUi('ui.pages.support_manager.comments.reported')}
          </span>
          {comment.rating ? (
            <span className="review-rating-badge">
              <span className="review-rating-stars">{renderStars(comment.rating)}</span>
              <strong>{comment.rating}/5</strong>
            </span>
          ) : null}
        </div>
      </div>
      <div className="comment-content">
        <p>{comment.content}</p>
        {comment.product_id ? (
          <p className="adm-reviews-report-product">
            {tUi('ui.pages.admin.adminComments.reportedForProduct_a7b8c9d0e1', {
              value0: comment.product_id,
            })}
          </p>
        ) : null}
      </div>
      <div className="adm-reviews-report-actions">
        <button
          type="button"
          className="adm-btn-secondary adm-reviews-approve-btn"
          onClick={() => handleApprove(comment.id)}
          disabled={approving === comment.id}
        >
          {approving === comment.id ? (
            <LoadingSpinner size="small" />
          ) : (
            <>
              <FiCheck aria-hidden />
              {tUi('ui.pages.support_manager.comments.approve')}
            </>
          )}
        </button>
        <button
          type="button"
          className="delete-comment-btn adm-reviews-delete-btn"
          onClick={() => handleDelete(comment.id)}
          disabled={deleting === comment.id}
        >
          {deleting === comment.id ? (
            <LoadingSpinner size="small" />
          ) : (
            tUi('ui.pages.admin.adminComments.delete_66f5dde37d')
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderReportsPanel = () => (
    <section className="adm-reviews-reports-panel">
      <div className="adm-reviews-detail-header">
        <div>
          <span className="adm-reviews-detail-kicker">
            {tUi('ui.pages.support_manager.comments.tab.reports')}
          </span>
          <h2 className="adm-reviews-detail-title">
            {tUi('ui.pages.admin.adminComments.reportedReviewsTitle_f2g3h4i5j6')}
          </h2>
        </div>
        <p className="adm-reviews-count" aria-live="polite">
          {reportedComments.length}{' '}
          {reportedComments.length === 1
            ? tUi('ui.pages.support_manager.comments.commentSingular')
            : tUi('ui.pages.support_manager.comments.commentPlural')}
        </p>
      </div>

      {reportsLoading ? (
        <div className="page-loading loading-container">
          <LoadingSpinner />
        </div>
      ) : reportedComments.length === 0 ? (
        <div className="no-comments">
          <p>{tUi('ui.pages.admin.adminComments.noReportedReviews_k7l8m9n0o1')}</p>
        </div>
      ) : (
        <div className="comments-list">
          {reportedComments.map((comment, index) => renderReportedCommentCard(comment, index))}
        </div>
      )}
    </section>
  );

  const renderReviewsPanel = () => (
    <>
      <div className="adm-reviews-detail-header">
        <div>
          <span className="adm-reviews-detail-kicker">
            {tUi('ui.pages.admin.adminComments.reviewsSection_g6h7i8j9k0')}
          </span>
          <h2 className="adm-reviews-detail-title">{selectedLocalizedProduct?.localized_name}</h2>
        </div>
      </div>

      <div className="adm-reviews-summary-bar">
        <div className="adm-reviews-summary-rating">
          <span className="rating-summary-label">
            {tUi('ui.pages.admin.adminComments.productAverageRating_85b4f2b45a')}
          </span>
          <div className="adm-reviews-summary-rating-row">
            <strong className="rating-summary-value">{selectedAverageRating.toFixed(1)}</strong>
            <span className="rating-summary-count">
              ({selectedTotalRatings}{' '}
              {selectedTotalRatings === 1
                ? tUi('ui.components.starRating.rating_5bd901ae20')
                : tUi('ui.components.starRating.ratings_8aa35770e7')}
              )
            </span>
            <div
              className="rating-summary-stars"
              aria-label={tUi('ui.components.commentSection.ratingOutOfFive_302e4cfd67', {
                value0: selectedAverageRating.toFixed(1),
              })}
            >
              {renderStars(Math.round(selectedAverageRating))}
            </div>
          </div>
        </div>

        <div className="adm-reviews-summary-filters">
          <span className="adm-reviews-sentiment-label">
            {tUi('ui.pages.admin.adminComments.filterBySentiment_c7d8e9f0a1')}
          </span>
          <div className="sentiment-filters">
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('all')}
            >
              {tUi('ui.pages.admin.adminComments.all_a69a334f44')}
              {counts.all})
            </button>
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'positive' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('positive')}
            >
              {tUi('ui.pages.admin.adminComments.positive_4bd9e10f4f')}
              {counts.positive})
            </button>
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'neutral' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('neutral')}
            >
              {tUi('ui.pages.admin.adminComments.neutral_415b26d261')}
              {counts.neutral})
            </button>
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'negative' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('negative')}
            >
              {tUi('ui.pages.admin.adminComments.negative_5bd4ee87d5')}
              {counts.negative})
            </button>
          </div>
        </div>
      </div>

      {commentsLoading ? (
        <div className="page-loading loading-container">
          <LoadingSpinner />
        </div>
      ) : filteredComments.length === 0 ? (
        <div className="no-comments">
          <p>
            {selectedProduct
              ? tUi('ui.pages.admin.adminComments.noReviewsFoundForValue_43ab341080', {
                  value0: selectedLocalizedProduct?.localized_name,
                })
              : tUi('ui.pages.admin.adminComments.noReviewsFound_6ae1b83edd')}
            {sentimentFilter !== 'all'
              ? tUi('ui.pages.admin.adminComments.withValueSentiment_41ae6e47d3', {
                  value0: getSentimentLabel(sentimentFilter),
                })
              : ''}
            .
          </p>
        </div>
      ) : (
        <div className="comments-list">
          {filteredComments.map((comment, index) => (
            <motion.div
              key={comment.id}
              className={`comment-card ${comment.sentiment === 'negative' ? 'negative-review' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="comment-header">
                <div className="comment-user">
                  {comment.user?.profile_image ? (
                    <img
                      src={getProfileImageUrl(comment.user.profile_image)}
                      alt={comment.user.first_name}
                      className="user-avatar"
                      onError={(event) => {
                        if (event.target.src !== defaultProfileImage) {
                          event.target.src = defaultProfileImage;
                        }
                      }}
                    />
                  ) : (
                    <div className="user-avatar-placeholder">
                      {comment.user?.first_name?.[0] || 'U'}
                    </div>
                  )}
                  <div className="user-info">
                    <p className="user-name">
                      {comment.user?.first_name} {comment.user?.last_name}
                    </p>
                    <p className="comment-date">{formatDate(comment.created_at)}</p>
                  </div>
                </div>
                <div className="comment-actions">
                  {comment.rating ? (
                    <span
                      className="review-rating-badge"
                      aria-label={tUi('ui.components.commentSection.ratingOutOfFive_302e4cfd67', {
                        value0: comment.rating,
                      })}
                    >
                      <span className="review-rating-stars">{renderStars(comment.rating)}</span>
                      <strong>{comment.rating}/5</strong>
                    </span>
                  ) : (
                    <span className="review-rating-badge review-rating-badge-empty">
                      {tUi('ui.pages.admin.adminComments.noRating_2de474f2ce')}
                    </span>
                  )}
                  {getSentimentBadge(comment.sentiment)}
                  <button
                    type="button"
                    className="delete-comment-btn"
                    onClick={() => handleDelete(comment.id)}
                    disabled={deleting === comment.id}
                  >
                    {deleting === comment.id ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      tUi('ui.pages.admin.adminComments.delete_66f5dde37d')
                    )}
                  </button>
                </div>
              </div>
              <div className="comment-content">
                <p>{comment.content}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="admin-page-shell adm-reviews-page">
      <PageHeader
        kicker={manageReviewsTitle}
        title={manageReviewsTitle}
        subtitle={tUi('ui.pages.admin.adminComments.subtitle_b4e8c1d2f3')}
        actions={
          <div className="adm-reviews-header-actions">
            <div className="adm-reviews-view-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`adm-reviews-view-tab${pageView === 'catalog' ? ' is-active' : ''}`}
                aria-selected={pageView === 'catalog'}
                onClick={() => setPageView('catalog')}
              >
                {tUi('ui.pages.admin.adminComments.productCatalog_a2b3c4d5e6')}
              </button>
              <button
                type="button"
                role="tab"
                className={`adm-reviews-view-tab${pageView === 'reports' ? ' is-active' : ''}`}
                aria-selected={pageView === 'reports'}
                onClick={() => {
                  setPageView('reports');
                  handleClearProduct();
                }}
              >
                {tUi('ui.pages.support_manager.comments.tab.reports')}
                {reportedComments.length > 0 ? ` (${reportedComments.length})` : ''}
              </button>
            </div>
            {pageView === 'catalog' ? (
              <div className="adm-reviews-header-filters">
                <div className="adm-reviews-header-filter">
                  <label htmlFor="adm-reviews-search">
                    {tUi('ui.pages.admin.adminComments.searchProduct_e0487af2dc')}
                  </label>
                  <input
                    id="adm-reviews-search"
                    type="text"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder={tUi('ui.pages.admin.adminComments.searchByProductName_7e4227491a')}
                  />
                </div>
                <div className="adm-reviews-header-filter">
                  <label htmlFor="adm-reviews-category">
                    {tUi('ui.pages.products.category_a6c5fd855e')}
                  </label>
                  <select
                    id="adm-reviews-category"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="">{tUi('ui.pages.products.allCategories_9fd1de45e8')}</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {getCategoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </div>
        }
      />

      <main className="adm-reviews-main">
        {pageView === 'reports' ? (
          renderReportsPanel()
        ) : selectedProduct ? (
          <div className="adm-reviews-split">
            <aside className="adm-reviews-product-panel" aria-label={selectedLocalizedProduct?.localized_name}>
              <div className="adm-reviews-selected-slot">
                {renderProductCard(selectedProduct, 0, { readonly: true })}
              </div>
              <button type="button" className="clear-product-btn adm-reviews-back-btn" onClick={handleClearProduct}>
                {tUi('ui.pages.admin.adminComments.clearProduct_e4db72bc41')}
              </button>
            </aside>

            <section className="adm-reviews-reviews-panel">
              {renderReviewsPanel()}
            </section>
          </div>
        ) : (
          <>
            <section className="adm-reviews-catalog">
              <div className="adm-reviews-catalog-header">
                <div>
                  <span className="adm-reviews-catalog-kicker">
                    {tUi('ui.pages.admin.adminComments.productCatalog_a2b3c4d5e6')}
                  </span>
                  <h2 className="adm-reviews-catalog-title">
                    {tUi('ui.pages.admin.adminComments.productCatalog_a2b3c4d5e6')}
                  </h2>
                </div>
                <p className="adm-reviews-count">
                  {filteredProducts.length}
                  {tUi('ui.pages.products.product_5919708d8b')}
                  {filteredProducts.length !== 1 ? 's' : ''}
                  {tUi('ui.pages.products.found_1816a1653a')}
                </p>
              </div>

              {productsLoading ? (
                <div className="page-loading loading-container">
                  <LoadingSpinner />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="no-comments">
                  <p>{tUi('ui.pages.admin.adminComments.noProductsMatch_f1e2d3c4b5')}</p>
                </div>
              ) : (
                <div className="adm-reviews-grid">
                  {filteredProducts.map((product, index) => renderProductCard(product, index))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminComments;
