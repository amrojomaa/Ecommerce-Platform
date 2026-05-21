import { tUi } from "../i18n/uiText";
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import http from '../services/http';
import { COMMENT_ENDPOINTS, buildUrl } from '../config/api';
import API_BASE_URL from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { FaEdit, FaPen, FaRegCommentDots, FaStar, FaTimes, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useConfirm } from '../hooks/useConfirm';
import { formatDate as formatLocalizedDate, getCurrentLocale } from '../utils/helpers';
import '../styles/components/CommentSection.css';

const CommentSection = ({ productId, variant = 'default', onReviewsChanged }) => {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (productId) {
      fetchComments(sortOrder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, sortOrder]);

  const fetchComments = async (requestedSortOrder = sortOrder) => {
    try {
      setLoading(true);
      const response = await http.get(
        buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: productId }),
        {
          params: {
            skip: 0,
            limit: 1000,
            sort_order: requestedSortOrder
          }
        }
      );
      setComments(response.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error(tUi("ui.components.commentSection.failedToLoadComments_816bd3130a"));
    } finally {
      setLoading(false);
    }
  };

  const myComment = useMemo(() => {
    if (!isAuthenticated || !user) return null;
    return comments.find((comment) => comment.user.id === user.id) || null;
  }, [comments, isAuthenticated, user]);

  const canManageComment = (comment) => {
    if (!isAuthenticated || !user) return false;
    return comment.user.id === user.id || (user.role && ['admin', 'support_manager'].includes(user.role));
  };

  const openComposerForNew = () => {
    if (!isAuthenticated) {
      toast.info(tUi("ui.components.commentSection.pleaseLoginToPostA_8830e57513"));
      return;
    }

    if (myComment) {
      setEditingCommentId(myComment.id);
      setNewComment(myComment.content);
      setNewRating(myComment.rating || 0);
    } else {
      setEditingCommentId(null);
      setNewComment('');
      setNewRating(0);
    }
    setIsComposerOpen(true);
  };

  const handleStartEdit = (comment) => {
    setEditingCommentId(comment.id);
    setNewComment(comment.content);
    setNewRating(comment.rating || 0);
    setIsComposerOpen(true);
  };

  const handleCloseComposer = () => {
    setEditingCommentId(null);
    setNewComment('');
    setNewRating(0);
    setIsComposerOpen(false);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim()) {
      toast.error(tUi("ui.components.commentSection.pleaseEnterAComment_11b45d3326"));
      return;
    }

    if (newRating < 1 || newRating > 5) {
      toast.error(tUi("ui.components.commentSection.pleaseChooseARatingBetween_5a85d8f04d"));
      return;
    }

    if (!isAuthenticated) {
      toast.info(tUi("ui.components.commentSection.pleaseLoginToPostA_8830e57513"));
      return;
    }

    setSubmitting(true);
    try {
      if (editingCommentId) {
        await http.put(buildUrl(COMMENT_ENDPOINTS.UPDATE, { comment_id: editingCommentId }), {
          content: newComment.trim(),
          rating: newRating
        });
        toast.success(tUi("ui.components.commentSection.commentUpdatedSuccessfully_21e9f1a0c1"));
      } else {
        await http.post(
          buildUrl(COMMENT_ENDPOINTS.CREATE, { product_id: productId }),
          {
            content: newComment.trim(),
            rating: newRating,
            product_id: productId
          }
        );
        toast.success(tUi("ui.components.commentSection.commentPostedSuccessfully_3f27a9bad9"));
      }

      handleCloseComposer();
      await fetchComments(sortOrder);
      onReviewsChanged?.();
    } catch (error) {
      console.error('Error saving comment:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to save comment';
      toast.error(errorMessage);

      if (error.response?.status === 409) {
        await fetchComments(sortOrder);
      }
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
      if (editingCommentId === commentId) {
        handleCloseComposer();
      }
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      onReviewsChanged?.();
      toast.success(tUi("ui.components.commentSection.commentDeletedSuccessfully_95b2007ac1"));
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete comment');
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
    }
    return formatLocalizedDate(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  const renderRatingStars = (rating, onSelect = null) => {
    return (
      <div className={onSelect ? 'comment-rating-picker' : 'comment-rating-display'}>
        {[1, 2, 3, 4, 5].map((value) =>
          <button
            key={value}
            type="button"
            className={`comment-rating-star ${value <= rating ? 'is-filled' : ''}`}
            onClick={onSelect ? () => onSelect(value) : undefined}
            disabled={!onSelect}
            aria-label={tUi("ui.components.commentSection.selectStars_086c6d4ff1", { value0: value })}>
            <FaStar aria-hidden />
          </button>
        )}
      </div>
    );
  };

  const sectionClassName =
    'comment-section' +
    (variant === 'productDetails' ? ' comment-section--product-details' : '');

  return (
    <div className={sectionClassName}>
      <div className="comment-section-header">
        <div className="comment-section-heading">
          <h3 className="comment-section-title">{tUi("ui.components.commentSection.commentsReviews_bf6e183a81")}</h3>
          {!loading &&
          <span className="comment-review-count" aria-live="polite">
              {comments.length}
            </span>
          }
        </div>

        <div className="comment-section-controls">
          <div className="comment-sort-group">
            <label className="comment-sort-label" htmlFor="comment-sort-order">
              {tUi("ui.pages.installments.sort_54ae76991c")}
            </label>
            <select
              id="comment-sort-order"
              className="comment-sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              aria-label={tUi("ui.pages.installments.sort_54ae76991c")}>
              <option value="newest">{tUi("ui.pages.installments.newest_e25ae45f0d")}</option>
              <option value="oldest">{tUi("ui.pages.installments.oldest_803a161793")}</option>
            </select>
          </div>
          <button
            type="button"
            className={
              'comment-open-composer-btn' +
              (isComposerOpen ?
                ' comment-open-composer-btn--ghost' :
                myComment ?
                ' comment-open-composer-btn--edit' :
                ' comment-open-composer-btn--primary')
            }
            onClick={isComposerOpen ? handleCloseComposer : openComposerForNew}>
            {isComposerOpen ?
            <>
                <FaTimes className="comment-open-composer-btn__icon" aria-hidden />
                <span>{tUi("ui.components.commentSection.close_2bcc546846")}</span>
              </> :
            myComment ?
            <>
                <FaEdit className="comment-open-composer-btn__icon" aria-hidden />
                <span>{tUi("ui.components.commentSection.editYourComment_b8fffd9d7d")}</span>
              </> :
            <>
                <FaPen className="comment-open-composer-btn__icon" aria-hidden />
                <span>{tUi("ui.components.commentSection.writeAComment_ba8d4e9e56")}</span>
              </>
            }
          </button>
        </div>
      </div>

      {isAuthenticated && myComment && !isComposerOpen &&
      <p className="comment-single-note">
          {tUi("ui.components.commentSection.oneCommentPerProduct_16050a4ba2")}
        </p>
      }

      <div className="comments-list">
        {loading ?
        <div className="comments-loading" role="status" aria-live="polite">
            <div className="comment-loading-skeleton" aria-hidden>
              <div className="comment-loading-skeleton__line comment-loading-skeleton__line--wide" />
              <div className="comment-loading-skeleton__line comment-loading-skeleton__line--mid" />
              <div className="comment-loading-skeleton__line comment-loading-skeleton__line--short" />
            </div>
            <span className="comments-loading-text">
              {tUi("ui.components.commentSection.loadingComments_fa4809b65b")}
            </span>
          </div> :
        comments.length === 0 ?
        <div className="comments-empty">
            <FaRegCommentDots className="comments-empty-icon" aria-hidden />
            <p>{tUi("ui.components.commentSection.noCommentsYetBeThe_a622f1d50e")}</p>
          </div> :
        comments.map((comment, index) =>
        <motion.div
          key={comment.id}
          className="comment-item"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04, duration: 0.25 }}>
            <div className="comment-header">
              <div className="comment-user-info">
                <img
                key={`${comment.user.id}-${comment.user.profile_image || 'default'}`}
                src={getProfileImageUrl(comment.user.profile_image)}
                alt={tUi("ui.components.commentSection.valueValue_1bf4891f92", { value0: comment.user.first_name, value1: comment.user.last_name })}
                className="comment-avatar"
                onError={(e) => {
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
                  {comment.rating &&
                  <div className="comment-user-rating" aria-label={tUi("ui.components.commentSection.ratingOutOfFive_302e4cfd67", { value0: comment.rating })}>
                    {renderRatingStars(comment.rating)}
                    <span>{comment.rating}/5</span>
                  </div>
                  }
                </div>
                {isAuthenticated && user && comment.user.id === user.id &&
                <span className="comment-owner-badge">{tUi("ui.components.commentSection.yourReview_4f6098c3a9")}</span>
                }
              </div>

              {canManageComment(comment) &&
              <div className="comment-actions">
                  <button
                  className="comment-edit-btn"
                  onClick={() => handleStartEdit(comment)}
                  title={tUi("ui.components.commentSection.editComment_198a1f6826")}>
                    <FaEdit />
                  </button>
                  <button
                  className="comment-delete-btn"
                  onClick={() => handleDeleteComment(comment.id)}
                  title={tUi("ui.components.commentSection.deleteComment_dc055a305c")}>
                    <FaTrash />
                  </button>
                </div>
              }
            </div>
            <div className="comment-content">
              {comment.content}
            </div>
          </motion.div>
        )
        }
      </div>

      {isAuthenticated && user && isComposerOpen &&
      <motion.form
        className="comment-form"
        onSubmit={handleSubmitComment}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}>
          <div className="comment-form-header">
            <div className="comment-form-user">
              <img
              key={`${user.id}-${user.profile_image || 'default'}`}
              src={getProfileImageUrl(user.profile_image)}
              alt={tUi("ui.components.commentSection.valueValue_1bf4891f92", { value0: user.first_name || '', value1: user.last_name || '' })}
              className="comment-user-avatar"
              onError={(e) => {
                if (e.target.src !== defaultProfileImage) {
                  e.target.src = defaultProfileImage;
                }
              }} />

              <span className="comment-form-username">
                {user.first_name || ''} {user.last_name || ''}
              </span>
            </div>
            {editingCommentId && <span className="comment-editing-label">{tUi("ui.components.commentSection.editingComment_c7df7e5d35")}</span>}
          </div>
          <textarea
          className="comment-input"
          placeholder={tUi("ui.components.commentSection.writeYourCommentOrReview_63598171e4")}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={4}
          maxLength={500} />

          <div className="comment-rating-field">
            <span className="comment-rating-label">{tUi("ui.components.commentSection.yourRating_3f51e8b913")}</span>
            {renderRatingStars(newRating, setNewRating)}
            <button
              type="button"
              className="comment-clear-rating-btn"
              onClick={() => setNewRating(0)}
              disabled={newRating < 1}>
              {tUi("ui.components.commentSection.clearRating_d5f66e8daa")}
            </button>
          </div>

          <div className="comment-form-footer">
            <span className="comment-char-count">
              {newComment.length}/500
            </span>
            <button
            type="submit"
            className="comment-submit-btn"
            disabled={submitting || !newComment.trim() || newRating < 1}>
              {submitting ?
              tUi("ui.components.commentSection.posting_98e8cf4a51") :
              editingCommentId ? tUi("ui.components.commentSection.updateComment_6ba61b8776") : tUi("ui.components.commentSection.postComment_f0058919df")}
            </button>
          </div>
        </motion.form>
      }
    </div>
  );
};

export default CommentSection;
