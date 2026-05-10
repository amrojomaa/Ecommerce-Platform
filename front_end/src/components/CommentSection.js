import { tUi } from "../i18n/uiText";import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import http from '../services/http';
import { COMMENT_ENDPOINTS, buildUrl } from '../config/api';
import API_BASE_URL from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useConfirm } from '../hooks/useConfirm';
import { formatDate as formatLocalizedDate, getCurrentLocale } from '../utils/helpers';
import '../styles/components/CommentSection.css';

const CommentSection = ({ productId }) => {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const confirm = useConfirm();

  const INITIAL_COMMENTS_COUNT = 3;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (productId) {
      fetchComments();
    }
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        setComments((prev) => [...prev, ...fetchedComments]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error(tUi("ui.components.commentSection.failedToLoadComments_816bd3130a"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim()) {
      toast.error(tUi("ui.components.commentSection.pleaseEnterAComment_11b45d3326"));
      return;
    }

    if (!isAuthenticated) {
      toast.info(tUi("ui.components.commentSection.pleaseLoginToPostA_8830e57513"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await http.post(
        buildUrl(COMMENT_ENDPOINTS.CREATE, { product_id: productId }),
        {
          content: newComment.trim(),
          product_id: productId
        }
      );

      // Add new comment at the beginning (newest first) - appears at the top of all comments
      // The new comment will be the first item in the array, so it displays above all others
      setComments((prev) => [response.data, ...prev]);
      setNewComment('');
      // Ensure the new comment is visible by showing initial view
      setShowAll(false);
      // Scroll to top of comments section to show the new comment
      const commentsSection = document.querySelector('.comments-list');
      if (commentsSection) {
        commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      toast.success(tUi("ui.components.commentSection.commentPostedSuccessfully_3f27a9bad9"));
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmed = await confirm({
      title: tUi("ui.components.commentSection.deleteComment_dc055a305c"),
      message: tUi("ui.components.commentSection.areYouSureYouWant_78aafd2355"),
      confirmText: tUi("ui.components.commentSection.delete_dfed091c84"),
      cancelText: tUi("ui.components.commentSection.cancel_9d88d47afa")
    });
    if (!confirmed) {
      return;
    }

    try {
      await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      toast.success(tUi("ui.components.commentSection.commentDeletedSuccessfully_95b2007ac1"));
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete comment');
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
        toast.error(tUi("ui.components.commentSection.failedToLoadAllComments_b29d889862"));
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
    const rtf = new Intl.RelativeTimeFormat(getCurrentLocale(), { numeric: 'auto' });

    if (diffDays === 1) {
      return rtf.format(-1, 'day');
    } else if (diffDays < 7) {
      return rtf.format(-diffDays, 'day');
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return rtf.format(-weeks, 'week');
    } else {
      return formatLocalizedDate(dateString, {
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

  // When showAll is true, display all comments; otherwise show only first 3
  const displayedComments = showAll ?
  comments // Show all comments when "View All" is clicked
  : comments.slice(0, INITIAL_COMMENTS_COUNT); // Show only first 3 initially
  const canDelete = (comment) => {
    if (!isAuthenticated || !user) return false;
    return comment.user.id === user.id || (user.role && user.role === 'admin');
  };

  return (
    <div className="comment-section">
      <h3 className="comment-section-title">{tUi("ui.components.commentSection.commentsReviews_bf6e183a81")}</h3>
      
      {/* Comments List */}
      <div className="comments-list">
        {loading ?
        <div className="comments-loading">{tUi("ui.components.commentSection.loadingComments_fa4809b65b")}</div> :
        displayedComments.length === 0 ?
        <div className="comments-empty">
            <p>{tUi("ui.components.commentSection.noCommentsYetBeThe_a622f1d50e")}</p>
          </div> :

        <>
            {displayedComments.map((comment, index) =>
          <motion.div
            key={comment.id}
            className="comment-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}>
            
                <div className="comment-header">
                  <div className="comment-user-info">
                    <img
                  key={`${comment.user.id}-${comment.user.profile_image || 'default'}`}
                  src={getProfileImageUrl(comment.user.profile_image)}
                  alt={tUi("ui.components.commentSection.valueValue_1bf4891f92", { value0: comment.user.first_name, value1: comment.user.last_name })}
                  className="comment-avatar"
                  onError={(e) => {
                    // Always fallback to default image on error
                    if (e.target.src !== defaultProfileImage) {
                      e.target.src = defaultProfileImage;
                    }
                  }} />
                
                    <div className="comment-user-details">
                      <span className="comment-username">
                        {comment.user.first_name} {comment.user.last_name}
                      </span>
                      <span className="comment-date">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                  </div>
                  {canDelete(comment) &&
              <button
                className="comment-delete-btn"
                onClick={() => handleDeleteComment(comment.id)}
                title={tUi("ui.components.commentSection.deleteComment_dc055a305c")}>
                
                      <FaTrash />
                    </button>
              }
                </div>
                <div className="comment-content">
                  {comment.content}
                </div>
              </motion.div>
          )}
            
            {/* View All / Show Less Button */}
            {(hasMore || showAll) &&
          <div className="comment-view-all-container">
                <button
              className="comment-view-all-btn"
              onClick={handleViewAll}>
              
                  {showAll ? tUi("ui.components.commentSection.showLess_57e2cdd106") : tUi("ui.components.commentSection.viewAllCommentsValue_b826e10818", { value0: comments.length })}
                </button>
              </div>
          }
          </>
        }
      </div>

      {/* Comment Form - Only for authenticated users - Positioned below all comments */}
      {isAuthenticated && user &&
      <motion.form
        className="comment-form"
        onSubmit={handleSubmitComment}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}>
        
          <div className="comment-form-header">
            <div className="comment-form-user">
              <img
              key={`${user.id}-${user.profile_image || 'default'}`}
              src={getProfileImageUrl(user.profile_image)}
              alt={tUi("ui.components.commentSection.valueValue_1bf4891f92", { value0: user.first_name || '', value1: user.last_name || '' })}
              className="comment-user-avatar"
              onError={(e) => {
                // Always fallback to default image on error
                if (e.target.src !== defaultProfileImage) {
                  e.target.src = defaultProfileImage;
                }
              }} />
            
              <span className="comment-form-username">
                {user.first_name || ''} {user.last_name || ''}
              </span>
            </div>
          </div>
          <textarea
          className="comment-input"
          placeholder={tUi("ui.components.commentSection.writeYourCommentOrReview_63598171e4")}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={4}
          maxLength={500} />
        
          <div className="comment-form-footer">
            <span className="comment-char-count">
              {newComment.length}/500
            </span>
            <button
            type="submit"
            className="comment-submit-btn"
            disabled={submitting || !newComment.trim()}>
            
              {submitting ? tUi("ui.components.commentSection.posting_98e8cf4a51") : tUi("ui.components.commentSection.postComment_f0058919df")}
            </button>
          </div>
        </motion.form>
      }
    </div>);

};

export default CommentSection;
