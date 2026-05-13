import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { COMMENT_ENDPOINTS, PRODUCT_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
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
  const [comments, setComments] = useState([]);
  const [filteredComments, setFilteredComments] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(productId ? parseInt(productId) : null);
  const [productSearch, setProductSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState('all'); // 'all', 'positive', 'neutral', 'negative'
  const [deleting, setDeleting] = useState(null);
  const confirm = useConfirm();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const commentsBasePath = user?.role === 'support_manager' ? '/support/comments' : '/admin/comments';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedProductId) {
      fetchComments();
    } else {
      setLoading(false);
      setComments([]);
      setFilteredComments([]);
    }
  }, [selectedProductId]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterComments();
  }, [sentimentFilter, comments]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProducts = async () => {
    try {
      const productsEndpoint =
      user?.role === 'support_manager' ? PRODUCT_ENDPOINTS.ALL : PRODUCT_ENDPOINTS.ALL_ADMIN;
      const response = await http.get(productsEndpoint);
      setProducts(response.data || []);

      // If productId from URL, set it as selected
      if (productId) {
        setSelectedProductId(parseInt(productId));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(tUi("ui.pages.admin.adminComments.failedToFetchProducts_91dffdab28"));
    }
  };

  const fetchComments = async () => {
    if (!selectedProductId) return;

    setLoading(true);
    try {
      const response = await http.get(
        buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: selectedProductId }),
        { params: { skip: 0, limit: 1000 } }
      );
      setComments(response.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error(tUi("ui.pages.admin.adminComments.failedToFetchComments_a09ce4627e"));
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productId) => {
    setSelectedProductId(productId);
    navigate(`${commentsBasePath}/product/${productId}`, { replace: true });
  };

  const filterComments = () => {
    if (sentimentFilter === 'all') {
      setFilteredComments(comments);
    } else {
      setFilteredComments(
        comments.filter((comment) => comment.sentiment === sentimentFilter)
      );
    }
  };

  const handleDelete = async (commentId) => {
    const confirmed = await confirm({
      title: tUi("ui.pages.admin.adminComments.deleteComment_d6666490e7"),
      message: tUi("ui.pages.admin.adminComments.areYouSureYouWant_b3d0559f52"),
      confirmText: tUi("ui.pages.admin.adminComments.delete_66f5dde37d"),
      cancelText: tUi("ui.pages.admin.adminComments.cancel_117ba1126e")
    });
    if (!confirmed) {
      return;
    }

    setDeleting(commentId);
    try {
      await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
      toast.success(tUi("ui.pages.admin.adminComments.commentDeletedSuccessfully_a8f689dd50"));
      if (selectedProductId) {
        await fetchComments();
      }
    } catch (error) {
      toast.error(tUi("ui.pages.admin.adminComments.failedToDeleteComment_1a364f7e19"));
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
      </span>);

  };

  const getSentimentCounts = () => {
    const counts = {
      all: comments.length,
      positive: comments.filter((c) => c.sentiment === 'positive').length,
      neutral: comments.filter((c) => c.sentiment === 'neutral').length,
      negative: comments.filter((c) => c.sentiment === 'negative').length
    };
    return counts;
  };

  // Default profile image
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

  const getProfileImageUrl = (profileImage) => {
    // Return default if profile image is null, undefined, or empty string
    if (!profileImage || (typeof profileImage === 'string' && profileImage.trim() === '')) {
      return defaultProfileImage;
    }

    // Check if it's already a full URL (e.g., Google profile image)
    if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
      return profileImage;
    }

    // Normalize path - remove leading slash if present to avoid double slashes
    const normalizedPath = profileImage.startsWith('/') ? profileImage.slice(1) : profileImage;
    // Construct full URL for uploaded images
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  const getProductImageUrl = (product) => {
    const firstImage = product?.images?.[0];
    if (!firstImage || typeof firstImage !== 'string') {
      return null;
    }
    if (firstImage.startsWith('http://') || firstImage.startsWith('https://')) {
      return firstImage;
    }
    const normalizedPath = firstImage.startsWith('/') ? firstImage.slice(1) : firstImage;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

  const counts = getSentimentCounts();
  const getSentimentLabel = (value) => {
    const key = SENTIMENT_LABEL_KEYS[value];
    if (key) return tUi(key);
    return value;
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const filteredProducts = products.filter((product) =>
  product.name.toLowerCase().includes(productSearch.toLowerCase())
  );
  const visibleProducts = selectedProductId ?
  products.filter((product) => product.id === selectedProductId) :
  filteredProducts;

  return (
    <div className="admin-comments">
      <div className="admin-comments-header">
        <h1>{tUi("ui.pages.admin.adminComments.manageReviews_9e45000031")}</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="product-selector">
            <label htmlFor="product-search">{tUi("ui.pages.admin.adminComments.searchProduct_e0487af2dc")}</label>
            <input
              id="product-search"
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="product-search-input"
              placeholder={tUi("ui.pages.admin.adminComments.searchByProductName_7e4227491a")} />
            
          </div>
          {selectedProductId &&
          <button
            className="clear-product-btn"
            onClick={() => {
              setSelectedProductId(null);
              navigate(commentsBasePath, { replace: true });
            }}>{tUi("ui.pages.admin.adminComments.clearProduct_e4db72bc41")}


          </button>
          }
          {selectedProductId &&
          <div className="sentiment-filters">
              <button
              className={`filter-btn ${sentimentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSentimentFilter("all")}>{tUi("ui.pages.admin.adminComments.all_a69a334f44")}

              {counts.all})
              </button>
              <button
              className={`filter-btn ${sentimentFilter === 'positive' ? 'active' : ''}`}
              onClick={() => setSentimentFilter("positive")}>{tUi("ui.pages.admin.adminComments.positive_4bd9e10f4f")}

              {counts.positive})
              </button>
              <button
              className={`filter-btn ${sentimentFilter === 'neutral' ? 'active' : ''}`}
              onClick={() => setSentimentFilter("neutral")}>{tUi("ui.pages.admin.adminComments.neutral_415b26d261")}

              {counts.neutral})
              </button>
              <button
              className={`filter-btn ${sentimentFilter === 'negative' ? 'active' : ''}`}
              onClick={() => setSentimentFilter("negative")}>{tUi("ui.pages.admin.adminComments.negative_5bd4ee87d5")}

              {counts.negative})
              </button>
            </div>
          }
        </div>
      </div>

      <div className="products-grid">
        {visibleProducts.map((product) =>
        <button
          key={product.id}
          className={`product-card-btn ${selectedProductId === product.id ? 'selected' : ''}`}
          onClick={() => handleProductSelect(product.id)}>
          
            <div className="product-card-image-wrap">
              {getProductImageUrl(product) ?
            <img
              src={getProductImageUrl(product)}
              alt={product.name}
              className="product-card-image" /> :


            <div className="product-card-image-placeholder">{tUi("ui.pages.admin.adminComments.noImage_8d9d7be0cc")}</div>
            }
            </div>
            <div className="product-card-title">{product.name}</div>
            <div className="product-card-meta">
              {formatCurrency(product.price || 0)}
            </div>
          </button>
        )}
      </div>

      {loading ?
      <div className="loading-container">
          <LoadingSpinner />
        </div> :
      !selectedProductId ?
      <div className="no-comments">
          <p>{tUi("ui.pages.admin.adminComments.pleaseSelectAProductTo_d3bc28ed58")}</p>
        </div> :
      filteredComments.length === 0 ?
      <div className="no-comments">
          <p>
            {selectedProduct ? tUi("ui.pages.admin.adminComments.noReviewsFoundForValue_43ab341080", { value0: selectedProduct.name }) : tUi("ui.pages.admin.adminComments.noReviewsFound_6ae1b83edd")}
            {sentimentFilter !== "all" ? tUi("ui.pages.admin.adminComments.withValueSentiment_41ae6e47d3", { value0: getSentimentLabel(sentimentFilter) }) : ''}.
          </p>
        </div> :

      <div className="comments-list">
          {filteredComments.map((comment, index) =>
        <motion.div
          key={comment.id}
          className={`comment-card ${comment.sentiment === 'negative' ? 'negative-review' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}>
          
              <div className="comment-header">
                <div className="comment-user">
                  {comment.user?.profile_image ?
              <img
                src={getProfileImageUrl(comment.user.profile_image)}
                alt={comment.user.first_name}
                className="user-avatar"
                onError={(e) => {
                  if (e.target.src !== defaultProfileImage) {
                    e.target.src = defaultProfileImage;
                  }
                }} /> :


              <div className="user-avatar-placeholder">
                      {comment.user?.first_name?.[0] || 'U'}
                    </div>
              }
                  <div className="user-info">
                    <p className="user-name">
                      {comment.user?.first_name} {comment.user?.last_name}
                    </p>
                    <p className="comment-date">{formatDate(comment.created_at)}</p>
                  </div>
                </div>
                <div className="comment-actions">
                  {getSentimentBadge(comment.sentiment)}
                  <button
                className="delete-comment-btn"
                onClick={() => handleDelete(comment.id)}
                disabled={deleting === comment.id}>
                
                    {deleting === comment.id ? <LoadingSpinner size="small" /> : tUi("ui.pages.admin.adminComments.delete_66f5dde37d")}
                  </button>
                </div>
              </div>
              <div className="comment-content">
                <p>{comment.content}</p>
                {selectedProduct &&
            <p className="product-info" style={{
              marginTop: '0.5rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}>{tUi("ui.pages.admin.adminComments.product_7793c81682")}
              {selectedProduct.name}
                  </p>
            }
              </div>
            </motion.div>
        )}
        </div>
      }
    </div>);

};

export default AdminComments;
