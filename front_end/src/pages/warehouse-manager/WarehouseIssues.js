import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { formatDateTime } from '../../utils/helpers';
import '../../styles/pages/warehouse-manager/WarehousePanel.css';
import '../../styles/pages/warehouse-manager/WarehouseIssues.css';

const WarehouseIssues = () => {
  const { t } = useTranslation();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
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

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const filtered = issues.filter(i => activeTab === 'all' ? true : i.status === activeTab);
  const openCount = issues.filter(i => i.status === 'open').length;
  const resolvedCount = issues.filter(i => i.status === 'resolved').length;

  const getIssueTypeLabel = (type) => t(`ui.pages.warehouse.warehouseIssues.type.${type}`, { defaultValue: type });
  const getStatusLabel = (status) => t(`ui.pages.warehouse.warehouseIssues.status.${status}`, { defaultValue: status });

  const handleResolve = async (issueId) => {
    const note = resolveNotes[issueId]?.trim();
    if (!note) { toast.error(t('ui.pages.warehouse.warehouseIssues.toast.missingNote')); return; }
    setResolvingId(issueId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.RESOLVE_ISSUE, { issue_id: issueId }), { resolution_note: note });
      toast.success(t('ui.pages.warehouse.warehouseIssues.toast.resolved'));
      setResolveNotes(prev => { const n = { ...prev }; delete n[issueId]; return n; });
      fetchIssues();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('ui.pages.warehouse.warehouseIssues.toast.failedToResolve'));
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) return <div className="page-loading wm-page-loading"><LoadingSpinner size="large" /></div>;

  const tabButtons = [
    { key: 'open', label: t('ui.pages.warehouse.warehouseIssues.tab.open'), count: openCount },
    { key: 'resolved', label: t('ui.pages.warehouse.warehouseIssues.tab.resolved'), count: resolvedCount },
    { key: 'all', label: t('ui.pages.warehouse.warehouseIssues.tab.all'), count: 0 },
  ];

  return (
    <div className="admin-page-shell wm-page wm-issues">
      <PageHeader
        kicker={t('ui.sidebar.panel.warehouse')}
        title={t('ui.pages.warehouse.warehouseIssues.title')}
        subtitle={t('ui.pages.warehouse.warehouseIssues.subtitle')}
        actions={
          <div className="wm-pill-tabs">
            {tabButtons.map(tab => (
              <button key={tab.key} type="button" className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
                {tab.count > 0 && <span className="wm-pill-tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>
        }
      />

      <section className="wm-section">
        {filtered.length === 0 ? (
          <div className="wm-empty">
            <div className="wm-empty-icon">{activeTab === 'open' ? '✅' : '📋'}</div>
            <p>{activeTab === 'open' ? t('ui.pages.warehouse.warehouseIssues.empty.open') : t('ui.pages.warehouse.warehouseIssues.empty.all')}</p>
          </div>
        ) : (
          <div className="wm-issues-list">
            {filtered.map((issue, i) => (
              <motion.div
                key={issue.id}
                className="wm-issue-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="wm-issue-card-header">
                  <span className={`wm-issue-type ${issue.issue_type}`}>{getIssueTypeLabel(issue.issue_type)}</span>
                  <span className={`wm-issue-status ${issue.status}`}>{getStatusLabel(issue.status)}</span>
                </div>
                <div className="wm-issue-order">
                  <strong>{t('ui.pages.warehouse.warehouseIssues.orderId', { id: issue.order_id })}</strong>
                  {issue.order_item_id && <span> • {t('ui.pages.warehouse.warehouseIssues.itemId', { id: issue.order_item_id })}</span>}
                </div>
                <div className="wm-issue-desc">{issue.description}</div>

                {issue.status === 'resolved' && issue.resolution_note && (
                  <div className="wm-issue-resolution">
                    <strong>{t('ui.pages.warehouse.warehouseIssues.resolution')}</strong> {issue.resolution_note}
                  </div>
                )}

                <div className="wm-issue-date">
                  {t('ui.pages.warehouse.warehouseIssues.reported', { date: formatDateTime(issue.created_at) })}
                  {issue.resolved_at && ` • ${t('ui.pages.warehouse.warehouseIssues.resolvedAt', { date: formatDateTime(issue.resolved_at) })}`}
                </div>

                {issue.status === 'open' && (
                  <div className="wm-resolve-form">
                    <textarea
                      placeholder={t('ui.pages.warehouse.warehouseIssues.placeholder.note')}
                      value={resolveNotes[issue.id] || ''}
                      onChange={e => setResolveNotes(prev => ({ ...prev, [issue.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="wm-btn-primary wm-btn-primary--success"
                      onClick={() => handleResolve(issue.id)}
                      disabled={resolvingId === issue.id || !resolveNotes[issue.id]?.trim()}
                    >
                      {resolvingId === issue.id ? '...' : t('ui.pages.warehouse.warehouseIssues.button.resolve')}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default WarehouseIssues;
