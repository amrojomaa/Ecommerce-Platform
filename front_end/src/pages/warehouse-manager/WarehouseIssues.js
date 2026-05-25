import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { formatDateTime } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminOrders.css';
import '../../styles/pages/warehouse-manager/WarehousePanel.css';
import '../../styles/pages/warehouse-manager/WarehouseIssues.css';

const ISSUE_FILTERS = ['open', 'resolved', 'all'];

const WarehouseIssues = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const panelKicker = t('ui.sidebar.panel.warehouse');

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = searchParams.get('filter');
    return ISSUE_FILTERS.includes(filter) ? filter : 'open';
  });
  const [resolveNotes, setResolveNotes] = useState({});
  const [resolvingId, setResolvingId] = useState(null);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await http.get(WAREHOUSE_ENDPOINTS.ALL_ISSUES);
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(t('ui.pages.warehouse.warehouseIssues.toast.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (ISSUE_FILTERS.includes(filter)) {
      setActiveTab(filter);
    } else if (!filter) {
      setActiveTab('open');
    }
  }, [searchParams]);

  const handleFilterChange = (value) => {
    setActiveTab(value);
    if (value === 'open') {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ filter: value }, { replace: true });
  };

  const filtered = issues.filter((issue) => (activeTab === 'all' ? true : issue.status === activeTab));

  const getIssueTypeLabel = (type) =>
    t(`ui.pages.warehouse.warehouseIssues.type.${type}`, { defaultValue: type });
  const getStatusLabel = (status) =>
    t(`ui.pages.warehouse.warehouseIssues.status.${status}`, { defaultValue: status });

  const formatFilterLabel = (value) => {
    if (value === 'resolved') return t('ui.pages.warehouse.warehouseIssues.tab.resolved');
    if (value === 'all') return t('ui.pages.warehouse.warehouseIssues.tab.all');
    return t('ui.pages.warehouse.warehouseIssues.tab.open');
  };

  const handleResolve = async (issueId) => {
    const note = resolveNotes[issueId]?.trim();
    if (!note) {
      toast.error(t('ui.pages.warehouse.warehouseIssues.toast.missingNote'));
      return;
    }
    setResolvingId(issueId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.RESOLVE_ISSUE, { issue_id: issueId }), {
        resolution_note: note,
      });
      toast.success(t('ui.pages.warehouse.warehouseIssues.toast.resolved'));
      setResolveNotes((prev) => {
        const next = { ...prev };
        delete next[issueId];
        return next;
      });
      fetchIssues();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('ui.pages.warehouse.warehouseIssues.toast.failedToResolve'));
    } finally {
      setResolvingId(null);
    }
  };

  const emptyMessage =
    activeTab === 'open'
      ? t('ui.pages.warehouse.warehouseIssues.empty.open')
      : t('ui.pages.warehouse.warehouseIssues.empty.all');

  const issueCountLabel =
    filtered.length === 1
      ? t('ui.pages.warehouse.warehouseIssues.issueCountOne')
      : t('ui.pages.warehouse.warehouseIssues.issueCountMany');

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-page-shell adm-page wm-page wm-issues-page">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.warehouse.warehouseIssues.title')}
        subtitle={t('ui.pages.warehouse.warehouseIssues.subtitle')}
        actions={
          <div className="adm-orders-header-filter wm-issues-header-filter">
            <div className="adm-orders-filter-row">
              <label className="adm-orders-filter-label" htmlFor="wm-issues-status-filter">
                {t('ui.pages.warehouse.warehouseIssues.filterByStatus')}
              </label>
              <select
                id="wm-issues-status-filter"
                className="adm-orders-select wm-issues-select"
                value={activeTab}
                onChange={(e) => handleFilterChange(e.target.value)}
              >
                {ISSUE_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {formatFilterLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-orders-header-meta" aria-live="polite">
              <strong>{filtered.length}</strong> {issueCountLabel}
            </p>
          </div>
        }
      />

      <section className="adm-section wm-issues-section">
        {filtered.length === 0 ? (
          <div className="adm-page-empty wm-page-empty">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="wm-data-panel wm-issues-data-panel">
            <div className="wm-issues-list">
              {filtered.map((issue, i) => (
                <motion.article
                  key={issue.id}
                  className="wm-issue-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="wm-issue-card-header">
                    <span className={`wm-issue-type ${issue.issue_type}`}>
                      {getIssueTypeLabel(issue.issue_type)}
                    </span>
                    <span className={`wm-issue-status ${issue.status}`}>{getStatusLabel(issue.status)}</span>
                  </div>
                  <div className="wm-issue-order">
                    <strong>{t('ui.pages.warehouse.warehouseIssues.orderId', { id: issue.order_id })}</strong>
                    {issue.order_item_id && (
                      <span>
                        {' '}
                        • {t('ui.pages.warehouse.warehouseIssues.itemId', { id: issue.order_item_id })}
                      </span>
                    )}
                  </div>
                  <div className="wm-issue-desc">{issue.description}</div>

                  {issue.status === 'resolved' && issue.resolution_note && (
                    <div className="wm-issue-resolution">
                      <strong>{t('ui.pages.warehouse.warehouseIssues.resolution')}</strong> {issue.resolution_note}
                    </div>
                  )}

                  <div className="wm-issue-date">
                    {t('ui.pages.warehouse.warehouseIssues.reported', { date: formatDateTime(issue.created_at) })}
                    {issue.resolved_at &&
                      ` • ${t('ui.pages.warehouse.warehouseIssues.resolvedAt', {
                        date: formatDateTime(issue.resolved_at),
                      })}`}
                  </div>

                  {issue.status === 'open' && (
                    <div className="wm-resolve-form">
                      <textarea
                        placeholder={t('ui.pages.warehouse.warehouseIssues.placeholder.note')}
                        value={resolveNotes[issue.id] || ''}
                        onChange={(e) =>
                          setResolveNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="adm-btn-primary wm-resolve-btn"
                        onClick={() => handleResolve(issue.id)}
                        disabled={resolvingId === issue.id || !resolveNotes[issue.id]?.trim()}
                      >
                        {resolvingId === issue.id
                          ? t('ui.pages.warehouse.warehouseIssues.resolving')
                          : t('ui.pages.warehouse.warehouseIssues.button.resolve')}
                      </button>
                    </div>
                  )}
                </motion.article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default WarehouseIssues;
