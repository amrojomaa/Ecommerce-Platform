import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { COMMENT_ENDPOINTS, PRODUCT_ENDPOINTS, buildUrl } from '../../config/api';
import API_BASE_URL from '../../config/api';
import { formatDate, formatPrice } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/admin/AdminComments.css';

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

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      fetchComments();
    } else {
      setLoading(false);
      setComments([]);
      setFilteredComments([]);
    }
  }, [selectedProductId]);

  useEffect(() => {
    filterComments();
  }, [sentimentFilter, comments]);

  const fetchProducts = async () => {
    try {
      const response = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      setProducts(response.data || []);
      
      // If productId from URL, set it as selected
      if (productId) {
        setSelectedProductId(parseInt(productId));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
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
      toast.error('Failed to fetch comments');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productId) => {
    setSelectedProductId(productId);
    navigate(`/admin/comments/product/${productId}`, { replace: true });
  };

  const filterComments = () => {
    if (sentimentFilter === 'all') {
      setFilteredComments(comments);
    } else {
      setFilteredComments(
        comments.filter(comment => comment.sentiment === sentimentFilter)
      );
    }
  };

  const handleDelete = async (commentId) => {
    const confirmed = await confirm({
      title: 'Delete comment',
      message: 'Are you sure you want to delete this comment?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }

    setDeleting(commentId);
    try {
      await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
      toast.success('Comment deleted successfully');
      if (selectedProductId) {
        await fetchComments();
      }
    } catch (error) {
      toast.error('Failed to delete comment');
    } finally {
      setDeleting(null);
    }
  };

  const getSentimentBadge = (sentiment) => {
    if (!sentiment) return null;
    
    const badges = {
      positive: { text: 'Positive', class: 'sentiment-badge-positive', icon: '👍' },
      neutral: { text: 'Neutral', class: 'sentiment-badge-neutral', icon: '😐' },
      negative: { text: 'Negative', class: 'sentiment-badge-negative', icon: '👎' }
    };

    const badge = badges[sentiment.toLowerCase()];
    if (!badge) return null;

    return (
      <span className={`sentiment-badge ${badge.class}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const getSentimentCounts = () => {
    const counts = {
      all: comments.length,
      positive: comments.filter(c => c.sentiment === 'positive').length,
      neutral: comments.filter(c => c.sentiment === 'neutral').length,
      negative: comments.filter(c => c.sentiment === 'negative').length
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

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  );
  const visibleProducts = selectedProductId
    ? products.filter((product) => product.id === selectedProductId)
    : filteredProducts;

  return (
    <div className="admin-comments">
      <div className="admin-comments-header">
        <h1>Manage Reviews</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="product-selector">
            <label htmlFor="product-search">Search Product:</label>
            <input
              id="product-search"
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="product-search-input"
              placeholder="Search by product name..."
            />
          </div>
          {selectedProductId && (
            <button
              className="clear-product-btn"
              onClick={() => {
                setSelectedProductId(null);
                navigate('/admin/comments', { replace: true });
              }}
            >
              Clear Product
            </button>
          )}
          {selectedProductId && (
            <div className="sentiment-filters">
              <button
                className={`filter-btn ${sentimentFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSentimentFilter('all')}
              >
                All ({counts.all})
              </button>
              <button
                className={`filter-btn ${sentimentFilter === 'positive' ? 'active' : ''}`}
                onClick={() => setSentimentFilter('positive')}
              >
                Positive ({counts.positive})
              </button>
              <button
                className={`filter-btn ${sentimentFilter === 'neutral' ? 'active' : ''}`}
                onClick={() => setSentimentFilter('neutral')}
              >
                Neutral ({counts.neutral})
              </button>
              <button
                className={`filter-btn ${sentimentFilter === 'negative' ? 'active' : ''}`}
                onClick={() => setSentimentFilter('negative')}
              >
                Negative ({counts.negative})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="products-grid">
        {visibleProducts.map((product) => (
          <button
            key={product.id}
            className={`product-card-btn ${selectedProductId === product.id ? 'selected' : ''}`}
            onClick={() => handleProductSelect(product.id)}
          >
            <div className="product-card-image-wrap">
              {getProductImageUrl(product) ? (
                <img
                  src={getProductImageUrl(product)}
                  alt={product.name}
                  className="product-card-image"
                />
              ) : (
                <div className="product-card-image-placeholder">No Image</div>
              )}
            </div>
            <div className="product-card-title">{product.name}</div>
            <div className="product-card-meta">
              {formatPrice(product.price || 0)}
            </div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container">
          <LoadingSpinner />
        </div>
      ) : !selectedProductId ? (
        <div className="no-comments">
          <p>Please select a product to view its reviews.</p>
        </div>
      ) : filteredComments.length === 0 ? (
        <div className="no-comments">
          <p>
            {selectedProduct ? `No reviews found for "${selectedProduct.name}"` : 'No reviews found'}
            {sentimentFilter !== 'all' ? ` with ${sentimentFilter} sentiment` : ''}.
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
                      onError={(e) => {
                        if (e.target.src !== defaultProfileImage) {
                          e.target.src = defaultProfileImage;
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
                  {getSentimentBadge(comment.sentiment)}
                  <button
                    className="delete-comment-btn"
                    onClick={() => handleDelete(comment.id)}
                    disabled={deleting === comment.id}
                  >
                    {deleting === comment.id ? <LoadingSpinner size="small" /> : 'Delete'}
                  </button>
                </div>
              </div>
              <div className="comment-content">
                <p>{comment.content}</p>
                {selectedProduct && (
                  <p className="product-info" style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.85rem', 
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                  }}>
                    Product: {selectedProduct.name}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminComments;
