import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../services/http';
import { COMMENT_ENDPOINTS, RATING_ENDPOINTS, buildUrl } from '../config/api';
import API_BASE_URL from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { useDialog } from '../hooks/useDialog';
import { useLanguage } from '../hooks/useLanguage';
import { FaEdit, FaStar, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import '../styles/components/CommentSection.css';

const CommentSection = ({ productId, productName }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const { showConfirm } = useDialog();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sortOrder, setSortOrder] = useState('latest');
  const [ratingsByUser, setRatingsByUser] = useState({});
  
  const INITIAL_COMMENTS_COUNT = 3;

  useEffect(() => {
    if (productId) {
      fetchComments();
      fetchProductRatings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const fetchComments = async (skip = 0, limit = INITIAL_COMMENTS_COUNT) => {
    try {
      setLoading(true);
      const response = await http.get(
        buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: productId }),
        { params: { skip, limit: limit + 1 } } // Fetch one extra to check if there are more
      );
      
      const fetchedComments = response.data;
      
      // Check if there are more comments
      if (fetchedComments.length > limit) {
        setHasMore(true);
        fetchedComments.pop(); // Remove the extra comment
      } else {
        setHasMore(false);
      }
      
      if (skip === 0) {
        setComments(fetchedComments);
      } else {
        setComments(prev => [...prev, ...fetchedComments]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');       
    } finally {
      setLoading(false);
    }
  };

  const handleAddCommentClick = () => {
    if (!isAuthenticated) {
      toast.info('Please login to add a comment');
      navigate('/login');
      return;
    }
    navigate(`/products/${encodeURIComponent(productName)}/add-comment`);
  };

  const handleDeleteComment = async (commentId) => {
    const confirmed = await showConfirm({
      message: 'Are you sure you want to delete this comment?',
      confirmText: 'OK',
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) {
      return;
    }

    try {
      await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete comment');
    }
  };

  const fetchProductRatings = async () => {
    try {
      const response = await http.get(
        buildUrl(RATING_ENDPOINTS.GET_PRODUCT_RATINGS, { product_id: productId }),
        { params: { skip: 0, limit: 500 } }
      );

      const ratingsMap = {};
      (response.data || []).forEach((ratingItem) => {
        if (ratingItem?.user?.id) {
          ratingsMap[ratingItem.user.id] = ratingItem.rating;
        }
      });
      setRatingsByUser(ratingsMap);
    } catch (error) {
      console.error('Error fetching ratings by user:', error);
      setRatingsByUser({});
    }
  };

  const handleViewAll = async () => {
    if (showAll) {
      // Reset to initial view
      await fetchComments(0, INITIAL_COMMENTS_COUNT);
      setShowAll(false);
    } else {
      // Load all comments - fetch in batches to get all comments
      try {
        setLoading(true);
        let allComments = [];
        let skip = 0;
        const batchSize = 100;
        let hasMoreComments = true;
        
        // Fetch all comments in batches
        while (hasMoreComments) {
          const response = await http.get(
            buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: productId }),
            { params: { skip, limit: batchSize } }
          );
          
          const batchComments = response.data || [];
          allComments = [...allComments, ...batchComments];
          
          // If we got fewer comments than requested, we've reached the end
          if (batchComments.length < batchSize) {
            hasMoreComments = false;
          } else {
            skip += batchSize;
          }
        }
        
        // Set all comments and mark as showing all
        setComments(allComments);
        setHasMore(false); // No more comments to load
        setShowAll(true);
      } catch (error) {
        console.error('Error fetching all comments:', error);
        toast.error('Failed to load all comments');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Default profile image (same as Navbar and Profile)
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

  const sortedComments = [...comments].sort((a, b) => {
    const aDate = new Date(a.created_at).getTime();
    const bDate = new Date(b.created_at).getTime();
    return sortOrder === 'latest' ? bDate - aDate : aDate - bDate;
  });

  // When showAll is true, display all comments; otherwise show only first 3
  const displayedComments = showAll
    ? sortedComments
    : sortedComments.slice(0, INITIAL_COMMENTS_COUNT);

  const canDelete = (comment) => {
    if (!isAuthenticated || !user) return false;
    return comment.user.id === user.id || (user.role && user.role === 'admin');
  };

  const canEdit = (comment) => {
    if (!isAuthenticated || !user) return false;
    return comment.user.id === user.id;
  };

  const renderUserRating = (commentUserId) => {
    const userRating = ratingsByUser[commentUserId];
    if (!userRating) return null;

    return (
      <div className="comment-user-rating" aria-label={`User rating: ${userRating} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar
            key={`rating-${commentUserId}-${star}`}
            className={star <= userRating ? 'rating-star filled' : 'rating-star'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="comment-section">
      <div className="comment-section-header">
        <h3 className="comment-section-title">{t('commentsAndReviews', 'Comments & Reviews')}</h3>
        <button
          type="button"
          className="comment-add-btn"
          onClick={handleAddCommentClick}
        >
          {t('addComment', 'Add a Comment')}
        </button>
      </div>

      <div className="comment-filter-row">
        <label htmlFor="comment-sort">{t('sort', 'Sort:')}</label>
        <select
          id="comment-sort"
          className="comment-sort-select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="latest">{t('latest', 'Latest')}</option>
          <option value="oldest">{t('oldest', 'Oldest')}</option>
        </select>
      </div>
      
      {/* Comments List */}
      <div className="comments-list">
        {loading ? (
          <div className="comments-loading">{t('loadingComments', 'Loading comments...')}</div>
        ) : displayedComments.length === 0 ? (
          <div className="comments-empty">
            <p>{t('noCommentsYet', 'No comments yet. Be the first to comment!')}</p>
          </div>
        ) : (
          <>
            {displayedComments.map((comment, index) => (
              <motion.div
                key={comment.id}
                className="comment-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
              >
                <div className="comment-header">
                  <div className="comment-user-info">
                    <img
                      key={`${comment.user.id}-${comment.user.profile_image || 'default'}`}
                      src={getProfileImageUrl(comment.user.profile_image)}
                      alt={`${comment.user.first_name} ${comment.user.last_name}`}
                      className="comment-avatar"
                      onError={(e) => {
                        // Always fallback to default image on error
                        if (e.target.src !== defaultProfileImage) {
                          e.target.src = defaultProfileImage;
                        }
                      }}
                    />
                    <div className="comment-user-details">
                      <span className="comment-username">
                        {comment.user.first_name} {comment.user.last_name}
                      </span>
                      {renderUserRating(comment.user.id)}
                      <span className="comment-date">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="comment-actions">
                    {canEdit(comment) && (
                      <button
                        className="comment-edit-btn"
                        onClick={() => navigate(`/products/${encodeURIComponent(productName)}/add-comment`)}
                        title={t('editCommentAndRating', 'Edit comment and rating')}
                      >
                        <FaEdit />
                      </button>
                    )}
                    {canDelete(comment) && (
                      <button
                        className="comment-delete-btn"
                        onClick={() => handleDeleteComment(comment.id)}
                        title={t('deleteComment', 'Delete comment')}
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </div>
                <div className="comment-content">
                  {comment.content}
                </div>
              </motion.div>
            ))}
            
            {/* View All / Show Less Button */}
            {(hasMore || showAll) && (
              <div className="comment-view-all-container">
                <button
                  className="comment-view-all-btn"
                  onClick={handleViewAll}
                >
                  {showAll ? t('showLess', 'Show Less') : t('viewAllComments', 'View All Comments')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
