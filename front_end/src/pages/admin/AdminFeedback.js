import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { FEEDBACK_ENDPOINTS } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminFeedback.css';

const RATING_FILTERS = ['all', 5, 4, 3, 2, 1];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

const renderStars = (rating) => {
  const safeRating = Number(rating) || 0;
  return '★'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
};

const AdminFeedback = () => {
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  const fetchFeedback = async (selectedRating = 'all') => {
    setLoading(true);
    try {
      const params = { skip: 0, limit: 1000 };
      if (selectedRating !== 'all') {
        params.rating = selectedRating;
      }
      const response = await http.get(FEEDBACK_ENDPOINTS.ALL, { params });
      setFeedbackRows(response.data || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Failed to load customer feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback(ratingFilter);
  }, [ratingFilter]);

  const visibleFeedback = useMemo(() => {
    if (!searchTerm.trim()) {
      return feedbackRows;
    }
    const normalized = searchTerm.toLowerCase();
    return feedbackRows.filter((entry) => {
      const fullName = `${entry.user?.first_name || ''} ${entry.user?.last_name || ''}`.toLowerCase();
      const email = (entry.user?.email || '').toLowerCase();
      const comment = (entry.comment || '').toLowerCase();
      return (
        fullName.includes(normalized) ||
        email.includes(normalized) ||
        comment.includes(normalized)
      );
    });
  }, [feedbackRows, searchTerm]);

  const groupedFeedback = useMemo(() => {
    const groupsMap = new Map();

    visibleFeedback.forEach((entry) => {
      const dateSource = entry.created_at || entry.updated_at;
      const entryDate = new Date(dateSource);
      const groupKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      const groupLabel = MONTH_FORMATTER.format(entryDate);

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          sortTs: entryDate.getTime(),
          entries: [],
        });
      }

      const group = groupsMap.get(groupKey);
      group.entries.push(entry);
      if (entryDate.getTime() > group.sortTs) {
        group.sortTs = entryDate.getTime();
      }
    });

    return Array.from(groupsMap.values())
      .sort((a, b) => b.sortTs - a.sortTs)
      .map((group) => ({
        ...group,
        commentCount: group.entries.filter((entry) => (entry.comment || '').trim().length > 0).length,
        averageRating:
          group.entries.length > 0
            ? group.entries.reduce((sum, entry) => sum + (Number(entry.rating) || 0), 0) / group.entries.length
            : 0,
        entries: group.entries.sort(
          (a, b) => new Date(b.created_at || b.updated_at).getTime() - new Date(a.created_at || a.updated_at).getTime()
        ),
      }));
  }, [visibleFeedback]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = {};
      groupedFeedback.forEach((group, idx) => {
        if (Object.prototype.hasOwnProperty.call(prev, group.key)) {
          next[group.key] = prev[group.key];
        } else {
          next[group.key] = idx === 0;
        }
      });
      return next;
    });
  }, [groupedFeedback]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  return (
    <div className="admin-feedback">
      <div className="admin-feedback-header">
        <h1>Customer Feedback</h1>
        <p>Ratings and comments.</p>
      </div>

      <div className="admin-feedback-toolbar">
        <input
          type="text"
          className="admin-feedback-search"
          placeholder="Search by name, email, or comment..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <div className="admin-feedback-filters">
          {RATING_FILTERS.map((filterValue) => (
            <button
              key={filterValue}
              type="button"
              className={`admin-feedback-filter-btn ${ratingFilter === filterValue ? 'active' : ''}`}
              onClick={() => setRatingFilter(filterValue)}
            >
              {filterValue === 'all' ? 'All Ratings' : `${filterValue} Stars`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="admin-feedback-loading">
          <LoadingSpinner />
        </div>
      ) : groupedFeedback.length === 0 ? (
        <div className="admin-feedback-empty">
          <p>No customer feedback found for the current filters.</p>
        </div>
      ) : (
        <div className="admin-feedback-grouped-list">
          {groupedFeedback.map((group) => {
            const isExpanded = expandedGroups[group.key];
            return (
              <section key={group.key} className="admin-feedback-group">
                <button
                  type="button"
                  className="admin-feedback-group-toggle"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className="admin-feedback-group-label">{group.label}</span>
                  <span className="admin-feedback-group-meta">
                    {group.commentCount} {group.commentCount === 1 ? 'comment' : 'comments'} • Avg {group.averageRating.toFixed(1)} ({group.entries.length}{' '}
                    {group.entries.length === 1 ? 'rating' : 'ratings'}) {isExpanded ? '▾' : '▸'}
                  </span>
                </button>

                <div className={`admin-feedback-group-body ${isExpanded ? 'expanded' : ''}`}>
                  {isExpanded && (
                    <div className="admin-feedback-list">
                      {group.entries.map((entry, index) => (
                        <motion.article
                          key={entry.id}
                          className="admin-feedback-card"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                        >
                          <div className="admin-feedback-card-header">
                            <div>
                              <h3>
                                {entry.user?.first_name} {entry.user?.last_name}
                              </h3>
                              <p>{entry.user?.email}</p>
                            </div>
                            <div className="admin-feedback-rating-wrap">
                              <span className="admin-feedback-stars" aria-label={`${entry.rating} out of 5`}>
                                {renderStars(entry.rating)}
                              </span>
                              <span className="admin-feedback-rating-text">{entry.rating}/5</span>
                            </div>
                          </div>

                          <p className="admin-feedback-comment">
                            {entry.comment || 'No comment provided.'}
                          </p>

                          <p className="admin-feedback-meta">
                            Updated: {formatDate(entry.updated_at)} | Submitted: {formatDate(entry.created_at)}
                          </p>
                        </motion.article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminFeedback;
