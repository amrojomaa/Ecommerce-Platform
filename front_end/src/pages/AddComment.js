import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaStar } from 'react-icons/fa';
import { toast } from 'react-toastify';
import http from '../services/http';
import { PRODUCT_ENDPOINTS, COMMENT_ENDPOINTS, RATING_ENDPOINTS, buildUrl } from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import '../styles/pages/AddComment.css';

const AddComment = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [existingComment, setExistingComment] = useState(null);

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const decodedName = decodeURIComponent(name);
      const response = await http.get(PRODUCT_ENDPOINTS.BY_NAME, {
        params: { name: decodedName },
      });
      setProduct(response.data);
    } catch (error) {
      console.error('Error fetching product for comment:', error);
      toast.error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkExistingComment = async () => {
      if (!product?.id || !user?.id) return;

      try {
        const response = await http.get(
          buildUrl(COMMENT_ENDPOINTS.GET_PRODUCT, { product_id: product.id }),
          { params: { skip: 0, limit: 1000 } }
        );

        const myComment = (response.data || []).find((item) => item?.user?.id === user.id);
        setExistingComment(myComment || null);
        if (myComment?.content) {
          setComment(myComment.content);
        }

        const ratingResponse = await http.get(
          buildUrl(RATING_ENDPOINTS.GET_PRODUCT, { product_id: product.id })
        );
        if (ratingResponse?.data?.user_rating) {
          setRating(ratingResponse.data.user_rating);
        }
      } catch (error) {
        console.error('Error checking existing comment:', error);
      }
    };

    checkExistingComment();
  }, [product, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!comment.trim()) {
      toast.error('Please write a comment');
      return;
    }

    if (rating < 1 || rating > 5) {
      toast.error('Please select a star rating');
      return;
    }

    if (!product?.id) {
      toast.error('Product data is missing');
      return;
    }

    setSubmitting(true);
    try {
      await http.post(
        buildUrl(RATING_ENDPOINTS.CREATE_OR_UPDATE, { product_id: product.id }),
        { rating }
      );

      if (existingComment?.id) {
        await http.put(
          buildUrl(COMMENT_ENDPOINTS.UPDATE, { comment_id: existingComment.id }),
          { content: comment.trim() }
        );
        toast.success('Your comment and rating were updated successfully');
      } else {
        await http.post(
          buildUrl(COMMENT_ENDPOINTS.CREATE, { product_id: product.id }),
          {
            content: comment.trim(),
            product_id: product.id,
          }
        );
        toast.success('Your comment and rating were added successfully');
      }
      navigate(`/products/${encodeURIComponent(product.name)}`);
    } catch (error) {
      console.error('Error adding comment/rating:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit comment and rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="add-comment-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="add-comment-page">
      <div className="add-comment-card">
        <button
          type="button"
          className="add-comment-back-btn"
          onClick={() => navigate(`/products/${encodeURIComponent(product.name)}`)}
        >
          <FaArrowLeft />
          <span>{t('backToProduct', 'Back to Product')}</span>
        </button>

        <h1 className="add-comment-title">{t('addCommentTitle', 'Add a Comment')}</h1>
        <p className="add-comment-subtitle">{product.name}</p>
        {existingComment && (
          <p className="add-comment-existing-msg">
            {t('existingCommentNotice', 'You already added a comment for this product. You can edit your comment and rating.')}
          </p>
        )}

        <form className="add-comment-form" onSubmit={handleSubmit}>
          <div className="add-comment-field">
            <label htmlFor="rating">{t('starRating', 'Star Rating')}</label>
            <div
              id="rating"
              className="add-comment-stars"
              onMouseLeave={() => setHoveredRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`add-comment-star-btn ${(hoveredRating || rating) >= star ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredRating(star)}
                  onClick={() => setRating(star)}
                  aria-label={`Select ${star} star${star > 1 ? 's' : ''}`}
                >
                  <FaStar />
                </button>
              ))}
            </div>
          </div>

          <div className="add-comment-field">
            <label htmlFor="comment">{t('comment', 'Comment')}</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={6}
              placeholder={t('writeCommentOrReview', 'Write your comment or review...')}
            />
            <span className="add-comment-counter">{comment.length}/500</span>
          </div>

          <button
            type="submit"
            className="add-comment-submit-btn"
            disabled={submitting}
          >
            {submitting
              ? t('submitting', 'Submitting...')
              : existingComment
                ? t('updateComment', 'Update Comment')
                : t('submitComment', 'Submit Comment')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddComment;
