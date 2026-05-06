import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import http from '../services/http';
import { RATING_ENDPOINTS, buildUrl } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { FaStar, FaStarHalfAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import '../styles/components/StarRating.css';

const StarRating = ({
  productId,
  showLabel = true,
  interactive = true,
  size = 'medium',
  initialAverageRating,
  initialTotalRatings,
  initialUserRating,
  fetchOnMount = true,
}) => {
  const { isAuthenticated } = useAuth();
  const hasPreloadedSummary = Number.isFinite(Number(initialAverageRating))
    && Number.isFinite(Number(initialTotalRatings));
  const [averageRating, setAverageRating] = useState(Number(initialAverageRating) || 0);
  const [totalRatings, setTotalRatings] = useState(Number(initialTotalRatings) || 0);
  const [userRating, setUserRating] = useState(initialUserRating ?? null);
  const [hoveredRating, setHoveredRating] = useState(null);
  const [loading, setLoading] = useState(!hasPreloadedSummary);
  const [submitting, setSubmitting] = useState(false);

  const fetchRating = useCallback(async () => {
    try {
      setLoading(true);
      const response = await http.get(buildUrl(RATING_ENDPOINTS.GET_PRODUCT, { product_id: productId }));
      setAverageRating(response.data.average_rating || 0);
      setTotalRatings(response.data.total_ratings || 0);
      setUserRating(response.data.user_rating || null);
    } catch (error) {
      console.error('Error fetching rating:', error);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    if (fetchOnMount || !hasPreloadedSummary) {
      fetchRating();
    } else {
      setLoading(false);
    }
  }, [productId, fetchOnMount, hasPreloadedSummary, fetchRating]);

  useEffect(() => {
    if (!hasPreloadedSummary) return;
    setAverageRating(Number(initialAverageRating) || 0);
    setTotalRatings(Number(initialTotalRatings) || 0);
    setUserRating(initialUserRating ?? null);
    setLoading(false);
  }, [hasPreloadedSummary, initialAverageRating, initialTotalRatings, initialUserRating]);

  const handleStarClick = async (rating) => {
    if (!interactive || !isAuthenticated || submitting) {
      if (!isAuthenticated) {
        toast.info('Please login to rate this product');
      }
      return;
    }

    setSubmitting(true);
    try {
      const response = await http.post(
        buildUrl(RATING_ENDPOINTS.CREATE_OR_UPDATE, { product_id: productId }),
        { rating }
      );
      
      // Refresh rating data
      await fetchRating();
      toast.success('Rating submitted successfully!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    const rating = hoveredRating !== null ? hoveredRating : averageRating;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    const stars = [];

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <motion.div
          key={`full-${i}`}
          className={`star star-filled ${interactive && isAuthenticated ? 'star-interactive' : ''}`}
          onClick={() => handleStarClick(i + 1)}
          onMouseEnter={() => interactive && isAuthenticated && setHoveredRating(i + 1)}
          whileHover={interactive && isAuthenticated ? { scale: 1.2 } : {}}
          whileTap={interactive && isAuthenticated ? { scale: 0.9 } : {}}
        >
          <FaStar />
        </motion.div>
      );
    }

    // Half star
    if (hasHalfStar) {
      stars.push(
        <motion.div
          key="half"
          className={`star star-half ${interactive && isAuthenticated ? 'star-interactive' : ''}`}
          onClick={() => handleStarClick(fullStars + 1)}
          onMouseEnter={() => interactive && isAuthenticated && setHoveredRating(fullStars + 1)}
          whileHover={interactive && isAuthenticated ? { scale: 1.2 } : {}}
          whileTap={interactive && isAuthenticated ? { scale: 0.9 } : {}}
        >
          <FaStarHalfAlt />
        </motion.div>
      );
    }

    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <motion.div
          key={`empty-${i}`}
          className={`star star-empty ${interactive && isAuthenticated ? 'star-interactive' : ''}`}
          onClick={() => handleStarClick(fullStars + (hasHalfStar ? 1 : 0) + i + 1)}
          onMouseEnter={() => interactive && isAuthenticated && setHoveredRating(fullStars + (hasHalfStar ? 1 : 0) + i + 1)}
          onMouseLeave={() => setHoveredRating(null)}
          whileHover={interactive && isAuthenticated ? { scale: 1.2 } : {}}
          whileTap={interactive && isAuthenticated ? { scale: 0.9 } : {}}
        >
          <FaStar />
        </motion.div>
      );
    }

    return stars;
  };

  if (loading) {
    return (
      <div className={`star-rating star-rating-${size}`}>
        <div className="stars-container">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="star star-loading">
              <FaStar />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`star-rating star-rating-${size}`}
      onMouseLeave={() => setHoveredRating(null)}
    >
      <div className="stars-container">
        {renderStars()}
      </div>
      {showLabel && (
        <div className="rating-info">
          <span className="rating-value">
            {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
          </span>
          {totalRatings > 0 && (
            <span className="rating-count">
              ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
            </span>
          )}
          {!totalRatings && (
            <span className="rating-count">No ratings yet</span>
          )}
        </div>
      )}
    </div>
  );
};

export default StarRating;
