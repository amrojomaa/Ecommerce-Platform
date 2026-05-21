import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiStar, FiMessageSquare, FiTrendingUp } from 'react-icons/fi';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { FEEDBACK_ENDPOINTS } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/support-manager/SupportManagerFeedback.css';

const SupportManagerFeedback = () => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState('all');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = { skip: 0, limit: 100 };
      if (ratingFilter !== 'all') params.rating = ratingFilter;
      const response = await http.get(FEEDBACK_ENDPOINTS.ALL, { params });
      setFeedback(response.data || []);
    } catch (error) {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [ratingFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const calculateStats = () => {
    if (feedback.length === 0) return { avg: 0, total: 0 };
    const sum = feedback.reduce((acc, f) => acc + f.rating, 0);
    return {
      avg: (sum / feedback.length).toFixed(1),
      total: feedback.length
    };
  };

  const stats = calculateStats();

  return (
    <div className="support-manager-feedback">
      <header className="feedback-header">
        <h1>Customer Feedback</h1>
        <div className="feedback-summary">
          <div className="summary-card">
            <FiTrendingUp color="#4CAF50" />
            <div className="info">
              <h3>{stats.avg} / 5</h3>
              <span>Average Rating</span>
            </div>
          </div>
          <div className="summary-card">
            <FiMessageSquare color="#2196F3" />
            <div className="info">
              <h3>{stats.total}</h3>
              <span>Total Reviews</span>
            </div>
          </div>
        </div>
      </header>

      <div className="feedback-controls">
        <div className="rating-filters">
          {['all', 5, 4, 3, 2, 1].map((r) => (
            <button 
              key={r} 
              className={ratingFilter === r ? 'active' : ''}
              onClick={() => setRatingFilter(r)}
            >
              {r === 'all' ? 'All Ratings' : `${r} Stars`}
            </button>
          ))}
        </div>
      </div>

      <div className="feedback-content">
        {loading ? (
          <div className="loading-state"><LoadingSpinner size="large" /></div>
        ) : feedback.length > 0 ? (
          <div className="feedback-list">
            {feedback.map((item, index) => (
              <motion.div 
                key={item.id} 
                className="feedback-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="card-top">
                  <div className="user-info">
                    <strong>{item.user?.first_name} {item.user?.last_name}</strong>
                    <span>{item.user?.email}</span>
                  </div>
                  <div className="rating-stars">
                    {[...Array(5)].map((_, i) => (
                      <FiStar 
                        key={i} 
                        fill={i < item.rating ? "#FFC107" : "none"} 
                        color="#FFC107" 
                      />
                    ))}
                  </div>
                </div>
                <p className="comment">{item.comment || "No comment provided."}</p>
                <div className="card-bottom">
                  <span className="date">{formatDate(item.created_at)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FiMessageSquare size="48" />
            <p>No feedback found for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportManagerFeedback;
