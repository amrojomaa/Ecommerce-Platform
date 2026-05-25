import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { FEEDBACK_ENDPOINTS } from '../../config/api';
import { formatDate, formatMonthYear } from '../../utils/helpers';
import { tUi } from '../../i18n/uiText';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import TicketUserAvatar from '../../components/TicketUserAvatar';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminFeedback.css';
import '../../styles/pages/support-manager/SupportPanel.css';

const SENTIMENT_LABEL_KEYS = {
  positive: 'ui.pages.admin.adminComments.sentimentPositive_70da220f7a',
  neutral: 'ui.pages.admin.adminComments.sentimentNeutral_1adf64fbd4',
  negative: 'ui.pages.admin.adminComments.sentimentNegative_78ec8a0d98',
};

const RATING_FILTERS = ['all', 5, 4, 3, 2, 1];

const renderStars = (rating) => {
  const safeRating = Number(rating) || 0;
  return '★'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
};

const AdminFeedback = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSupportManagerPanel = user?.role === 'support_manager';
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const response = await http.get(FEEDBACK_ENDPOINTS.ALL, { params: { skip: 0, limit: 1000 } });
      setFeedbackRows(response.data || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error(tUi('ui.pages.admin.adminFeedback.failedToLoadCustomerFeedback_8a3ede622c'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const groupedFeedback = useMemo(() => {
    const groupsMap = new Map();

    feedbackRows.forEach((entry) => {
      const dateSource = entry.created_at || entry.updated_at;
      const entryDate = new Date(dateSource);
      const groupKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

      if (!groupsMap.has(groupKey)) {
        const [year, month] = groupKey.split('-');
        groupsMap.set(groupKey, {
          key: groupKey,
          label: formatMonthYear(new Date(Number(year), Number(month) - 1, 1)),
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
  }, [feedbackRows]);

  const selectedGroup = useMemo(
    () => groupedFeedback.find((group) => group.key === selectedMonthKey) || null,
    [groupedFeedback, selectedMonthKey]
  );

  const ratingCounts = useMemo(() => {
    if (!selectedGroup) {
      return { all: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    }
    return {
      all: selectedGroup.entries.length,
      5: selectedGroup.entries.filter((entry) => Number(entry.rating) === 5).length,
      4: selectedGroup.entries.filter((entry) => Number(entry.rating) === 4).length,
      3: selectedGroup.entries.filter((entry) => Number(entry.rating) === 3).length,
      2: selectedGroup.entries.filter((entry) => Number(entry.rating) === 2).length,
      1: selectedGroup.entries.filter((entry) => Number(entry.rating) === 1).length,
    };
  }, [selectedGroup]);

  const ratingFilteredEntries = useMemo(() => {
    if (!selectedGroup) return [];
    if (ratingFilter === 'all') return selectedGroup.entries;
    return selectedGroup.entries.filter((entry) => Number(entry.rating) === ratingFilter);
  }, [selectedGroup, ratingFilter]);

  const sentimentCounts = useMemo(() => {
    if (!selectedGroup) {
      return { all: 0, positive: 0, neutral: 0, negative: 0 };
    }
    return {
      all: ratingFilteredEntries.length,
      positive: ratingFilteredEntries.filter((entry) => entry.sentiment === 'positive').length,
      neutral: ratingFilteredEntries.filter((entry) => entry.sentiment === 'neutral').length,
      negative: ratingFilteredEntries.filter((entry) => entry.sentiment === 'negative').length,
    };
  }, [selectedGroup, ratingFilteredEntries]);

  const filteredMonthEntries = useMemo(() => {
    if (sentimentFilter === 'all') return ratingFilteredEntries;
    return ratingFilteredEntries.filter((entry) => entry.sentiment === sentimentFilter);
  }, [ratingFilteredEntries, sentimentFilter]);

  const getSentimentLabel = (value) => {
    const key = SENTIMENT_LABEL_KEYS[value];
    if (key) return tUi(key);
    return value;
  };

  const getSentimentBadge = (sentiment) => {
    if (!sentiment) return null;
    const normalized = sentiment.toLowerCase();

    const badges = {
      positive: { text: getSentimentLabel('positive'), class: 'adm-fb-sentiment-badge-positive', icon: '👍' },
      neutral: { text: getSentimentLabel('neutral'), class: 'adm-fb-sentiment-badge-neutral', icon: '😐' },
      negative: { text: getSentimentLabel('negative'), class: 'adm-fb-sentiment-badge-negative', icon: '👎' },
    };

    const badge = badges[normalized];
    if (!badge) return null;

    return (
      <span className={`adm-fb-sentiment-badge ${badge.class}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const handleMonthSelect = (monthKey) => {
    setSelectedMonthKey(monthKey);
    setSentimentFilter('all');
    setRatingFilter('all');
  };

  const handleClearMonth = () => {
    setSelectedMonthKey(null);
    setSentimentFilter('all');
    setRatingFilter('all');
  };

  const customerFeedbackTitle = tUi('ui.pages.admin.adminFeedback.customerFeedback_4fd4bfed76');
  const panelKicker = isSupportManagerPanel
    ? t('ui.sidebar.panel.support')
    : customerFeedbackTitle;

  const renderMonthCard = (group, index, options = {}) => {
    const { readonly = false } = options;
    const isSelected = selectedMonthKey === group.key;
    const cardClassName = `adm-fb-month-card ${isSelected ? 'is-selected' : ''} ${
      readonly ? 'is-readonly' : ''
    }`.trim();

    const cardInner = (
      <>
        <div className="adm-fb-month-card-badge">
          {tUi('ui.pages.admin.adminFeedback.monthCatalog_e3f4a5b6c7')}
        </div>
        <h3 className="adm-fb-month-card-title">{group.label}</h3>
        <div className="adm-fb-month-card-stars" aria-label={group.averageRating.toFixed(1)}>
          {renderStars(Math.round(group.averageRating))}
        </div>
        <p className="adm-fb-month-card-avg">
          {tUi('ui.pages.admin.adminFeedback.avg_88b67561cc')} {group.averageRating.toFixed(1)}
        </p>
        <div className="adm-fb-month-card-meta">
          <span>
            {group.entries.length}{' '}
            {group.entries.length === 1
              ? tUi('ui.pages.admin.adminFeedback.rating_f79d1f1958')
              : tUi('ui.pages.admin.adminFeedback.ratings_1c705eb178')}
          </span>
          <span>
            {group.commentCount}{' '}
            {group.commentCount === 1
              ? tUi('ui.pages.admin.adminFeedback.comment_9e8582da81')
              : tUi('ui.pages.admin.adminFeedback.comments_2c5add3272')}
          </span>
        </div>
      </>
    );

    return (
      <motion.div
        key={group.key}
        className="adm-fb-month-card-wrapper"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.35 }}
      >
        {readonly ? (
          <div className={cardClassName} aria-current={isSelected ? 'true' : undefined}>
            {cardInner}
          </div>
        ) : (
          <button
            type="button"
            className={cardClassName}
            onClick={() => handleMonthSelect(group.key)}
            aria-pressed={isSelected}
          >
            {cardInner}
          </button>
        )}
      </motion.div>
    );
  };

  const renderFeedbackDetailPanel = () => {
    if (!selectedGroup) return null;

    return (
      <>
        <div className="adm-fb-detail-header">
          <div>
            <span className="adm-fb-detail-kicker">
              {tUi('ui.pages.admin.adminFeedback.feedbackDetail_h6i7j8k9l0')}
            </span>
            <h2 className="adm-fb-detail-title">{selectedGroup.label}</h2>
          </div>
        </div>

        <div className="adm-fb-summary-bar">
          <span className="rating-summary-label adm-fb-summary-rating-label">
            {tUi('ui.pages.admin.adminFeedback.monthAverageRating_i7j8k9l0m1')}
          </span>
          <span className="adm-fb-sentiment-label adm-fb-summary-sentiment-label">
            {tUi('ui.pages.admin.adminComments.filterBySentiment_c7d8e9f0a1')}
          </span>

          <div className="adm-fb-summary-rating-row">
            <strong className="rating-summary-value">{selectedGroup.averageRating.toFixed(1)}</strong>
            <span className="rating-summary-count">
              ({selectedGroup.entries.length}{' '}
              {selectedGroup.entries.length === 1
                ? tUi('ui.pages.admin.adminFeedback.rating_f79d1f1958')
                : tUi('ui.pages.admin.adminFeedback.ratings_1c705eb178')}
              )
            </span>
            <span className="rating-summary-stars">{renderStars(Math.round(selectedGroup.averageRating))}</span>
          </div>

          <div className="sentiment-filters adm-fb-summary-sentiment-filters">
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('all')}
              aria-pressed={sentimentFilter === 'all'}
            >
              {tUi('ui.pages.admin.adminComments.all_a69a334f44')}
              {sentimentCounts.all})
            </button>
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'positive' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('positive')}
              aria-pressed={sentimentFilter === 'positive'}
            >
              {tUi('ui.pages.admin.adminComments.positive_4bd9e10f4f')}
              {sentimentCounts.positive})
            </button>
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'neutral' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('neutral')}
              aria-pressed={sentimentFilter === 'neutral'}
            >
              {tUi('ui.pages.admin.adminComments.neutral_415b26d261')}
              {sentimentCounts.neutral})
            </button>
            <button
              type="button"
              className={`filter-btn ${sentimentFilter === 'negative' ? 'active' : ''}`}
              onClick={() => setSentimentFilter('negative')}
              aria-pressed={sentimentFilter === 'negative'}
            >
              {tUi('ui.pages.admin.adminComments.negative_5bd4ee87d5')}
              {sentimentCounts.negative})
            </button>
          </div>

          <div className="adm-fb-summary-rating-filters">
            <span className="adm-fb-rating-filter-label">
              {tUi('ui.pages.admin.adminFeedback.filterByRating_d2e3f4a5b6')}
            </span>
            <div className="adm-fb-rating-filters">
              {RATING_FILTERS.map((filterValue) => (
                <button
                  key={filterValue}
                  type="button"
                  className={`adm-fb-rating-filter-btn ${ratingFilter === filterValue ? 'is-active' : ''} ${
                    filterValue === 'all' ? 'is-all' : 'is-stars'
                  }`}
                  onClick={() => setRatingFilter(filterValue)}
                  aria-pressed={ratingFilter === filterValue}
                >
                  {filterValue === 'all'
                    ? `${tUi('ui.pages.admin.adminFeedback.allRatings_839197b0a4')} (${ratingCounts.all})`
                    : `${tUi('ui.pages.admin.adminFeedback.valueStars_91b0a7fe89', { value0: filterValue })} (${
                        ratingCounts[filterValue]
                      })`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredMonthEntries.length === 0 ? (
          <div className="admin-feedback-empty">
            <p>
              {tUi('ui.pages.admin.adminFeedback.noCustomerFeedbackFoundFor_97a65aec8e')}
              {sentimentFilter !== 'all'
                ? ` ${tUi('ui.pages.admin.adminComments.withValueSentiment_41ae6e47d3', {
                    value0: getSentimentLabel(sentimentFilter),
                  })}`
                : ''}
              {ratingFilter !== 'all'
                ? ` ${tUi('ui.pages.admin.adminFeedback.withValueRating_l0m1n2o3p4', {
                    value0: ratingFilter,
                  })}`
                : ''}
            </p>
          </div>
        ) : (
          <div className="admin-feedback-list">
            {filteredMonthEntries.map((entry, index) => (
              <motion.article
                key={entry.id}
                className={`admin-feedback-card ${
                  entry.sentiment === 'negative' ? 'admin-feedback-card-negative' : ''
                }`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <div className="admin-feedback-card-header">
                  <div className="adm-fb-user">
                    <TicketUserAvatar user={entry.user} size={44} className="adm-fb-user-avatar" />
                    <div className="adm-fb-user-info">
                      <h3>
                        {entry.user?.first_name} {entry.user?.last_name}
                      </h3>
                      <p className="adm-fb-user-date">{formatDate(entry.created_at)}</p>
                    </div>
                  </div>
                  <div className="adm-fb-card-actions">
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
                    {getSentimentBadge(entry.sentiment)}
                  </div>
                </div>

                <p className="admin-feedback-comment">
                  {entry.comment || tUi('ui.pages.admin.adminFeedback.noCommentProvided_041e34567f')}
                </p>
              </motion.article>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className={`admin-page-shell admin-feedback adm-page${
        isSupportManagerPanel ? ' spm-page spm-fb-page' : ''
      }`}
    >
      <PageHeader
        kicker={panelKicker}
        title={customerFeedbackTitle}
        subtitle={tUi('ui.pages.admin.adminFeedback.ratingsAndComments_9672ebdf0c')}
      />

      <main className="adm-fb-main">
        {loading ? (
          <div className="page-loading admin-feedback-loading">
            <LoadingSpinner />
          </div>
        ) : selectedGroup ? (
          <div className="adm-fb-split">
            <aside className="adm-fb-month-panel" aria-label={selectedGroup.label}>
              <div className="adm-fb-selected-slot">{renderMonthCard(selectedGroup, 0, { readonly: true })}</div>
              <button type="button" className="adm-fb-clear-btn" onClick={handleClearMonth}>
                {tUi('ui.pages.admin.adminFeedback.clearMonth_f4a5b6c7d8')}
              </button>
            </aside>

            <section className="adm-fb-detail-panel">{renderFeedbackDetailPanel()}</section>
          </div>
        ) : groupedFeedback.length === 0 ? (
          <div className="admin-feedback-empty">
            <p>{tUi('ui.pages.admin.adminFeedback.noCustomerFeedbackFoundFor_97a65aec8e')}</p>
          </div>
        ) : (
          <section className="adm-fb-catalog">
            <div className="adm-fb-catalog-header">
              <div>
                <span className="adm-fb-catalog-kicker">
                  {tUi('ui.pages.admin.adminFeedback.monthCatalog_e3f4a5b6c7')}
                </span>
                <h2 className="adm-fb-catalog-title">
                  {tUi('ui.pages.admin.adminFeedback.monthCatalog_e3f4a5b6c7')}
                </h2>
              </div>
              <p className="adm-fb-count">
                {groupedFeedback.length}{' '}
                {groupedFeedback.length === 1
                  ? tUi('ui.pages.admin.adminFeedback.monthSingular_j8k9l0m1n2')
                  : tUi('ui.pages.admin.adminFeedback.monthPlural_k9l0m1n2o3')}
              </p>
            </div>

            <div className="adm-fb-month-grid">
              {groupedFeedback.map((group, index) => renderMonthCard(group, index))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminFeedback;
