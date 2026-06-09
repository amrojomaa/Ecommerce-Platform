import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { FEEDBACK_ENDPOINTS } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import { tUi } from '../../i18n/uiText';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/pages/admin/AdminFeedback.css';
import '../../styles/pages/support-manager/SupportPanel.css';

const RATING_FILTERS = ['all', 5, 4, 3, 2, 1];

const renderStars = (rating) => {
  const safeRating = Math.min(5, Math.max(0, Number(rating) || 0));
  return '\u2605'.repeat(safeRating) + '\u2606'.repeat(5 - safeRating);
};

const AdminFeedback = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSupportManagerPanel = user?.role === 'support_manager';

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
      setFeedbackRows(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error(tUi('ui.pages.admin.adminFeedback.failedToLoadCustomerFeedback_8a3ede622c'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback(ratingFilter);
  }, [ratingFilter]);

  const visibleFeedback = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return feedbackRows;
    }

    return feedbackRows.filter((entry) => {
      const fullName = `${entry.user?.first_name || ''} ${entry.user?.last_name || ''}`.toLowerCase();
      const email = (entry.user?.email || '').toLowerCase();
      const comment = (entry.comment || '').toLowerCase();
      return fullName.includes(normalized) || email.includes(normalized) || comment.includes(normalized);
    });
  }, [feedbackRows, searchTerm]);

  const groupedFeedback = useMemo(() => {
    const groupsMap = new Map();

    visibleFeedback.forEach((entry) => {
      const dateSource = entry.created_at || entry.updated_at;
      if (!dateSource) return;

      const entryDate = new Date(dateSource);
      if (Number.isNaN(entryDate.getTime())) return;

      const groupKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      const groupLabel = formatDate(entryDate.toISOString(), { month: 'long', year: 'numeric' });

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
          (a, b) =>
            new Date(b.created_at || b.updated_at).getTime() -
            new Date(a.created_at || a.updated_at).getTime()
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

  const customerFeedbackTitle = tUi('ui.pages.admin.adminFeedback.customerFeedback_4fd4bfed76');
  const panelKicker = isSupportManagerPanel ? t('ui.sidebar.panel.support') : customerFeedbackTitle;

  return (
    <div
      className={`admin-page-shell admin-feedback${
        isSupportManagerPanel ? ' spm-page spm-fb-page' : ''
      }`}
    >
      <PageHeader
        kicker={panelKicker}
        title={customerFeedbackTitle}
        subtitle={tUi('ui.pages.admin.adminFeedback.ratingsAndComments_9672ebdf0c')}
      />

      <div className="admin-feedback-toolbar">
        <input
          type="search"
          className="admin-feedback-search"
          placeholder={tUi('ui.pages.admin.adminFeedback.searchByNameEmailOr_a135b39828')}
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
              aria-pressed={ratingFilter === filterValue}
            >
              {filterValue === 'all'
                ? tUi('ui.pages.admin.adminFeedback.allRatings_839197b0a4')
                : tUi('ui.pages.admin.adminFeedback.valueStars_91b0a7fe89', { value0: filterValue })}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="page-loading admin-feedback-loading">
          <LoadingSpinner />
        </div>
      ) : groupedFeedback.length === 0 ? (
        <div className="admin-feedback-empty">
          <p>{tUi('ui.pages.admin.adminFeedback.noCustomerFeedbackFoundFor_97a65aec8e')}</p>
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
                  aria-expanded={isExpanded}
                >
                  <span className="admin-feedback-group-label">{group.label}</span>
                  <span className="admin-feedback-group-meta">
                    {group.commentCount}{' '}
                    {group.commentCount === 1
                      ? tUi('ui.pages.admin.adminFeedback.comment_9e8582da81')
                      : tUi('ui.pages.admin.adminFeedback.comments_2c5add3272')}
                    {tUi('ui.pages.admin.adminFeedback.avg_88b67561cc')} {group.averageRating.toFixed(1)} (
                    {group.entries.length}{' '}
                    {group.entries.length === 1
                      ? tUi('ui.pages.admin.adminFeedback.rating_f79d1f1958')
                      : tUi('ui.pages.admin.adminFeedback.ratings_1c705eb178')}
                    ) {isExpanded ? '\u25BE' : '\u25B8'}
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
                              <span
                                className="admin-feedback-stars"
                                aria-label={tUi('ui.pages.admin.adminFeedback.valueOutOf5_9ae6dcd335', {
                                  value0: entry.rating,
                                })}
                              >
                                {renderStars(entry.rating)}
                              </span>
                              <span className="admin-feedback-rating-text">{entry.rating}/5</span>
                            </div>
                          </div>

                          <p className="admin-feedback-comment">
                            {entry.comment || tUi('ui.pages.admin.adminFeedback.noCommentProvided_041e34567f')}
                          </p>

                          <p className="admin-feedback-meta">
                            {tUi('ui.pages.admin.adminFeedback.updated_675637bd9d')}
                            {formatDate(entry.updated_at)}
                            {tUi('ui.pages.admin.adminFeedback.submitted_43310e0039')}
                            {formatDate(entry.created_at)}
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
