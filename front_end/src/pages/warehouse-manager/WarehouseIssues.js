import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/warehouse-manager/WarehouseIssues.css';

const WarehouseIssues = () => {
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
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const filtered = issues.filter(i => activeTab === 'all' ? true : i.status === activeTab);
  const openCount = issues.filter(i => i.status === 'open').length;
  const resolvedCount = issues.filter(i => i.status === 'resolved').length;

  const handleResolve = async (issueId) => {
    const note = resolveNotes[issueId]?.trim();
    if (!note) { toast.error('Please add a resolution note'); return; }
    setResolvingId(issueId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.RESOLVE_ISSUE, { issue_id: issueId }), { resolution_note: note });
      toast.success('Issue resolved');
      setResolveNotes(prev => { const n = { ...prev }; delete n[issueId]; return n; });
      fetchIssues();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resolve');
    } finally {
      setResolvingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="wm-issues-loading"><LoadingSpinner size="large" /></div>;

  return (
    <div className="wm-issues">
      <h1>Warehouse Issues</h1>
      <div className="wm-issues-tabs">
        <button className={activeTab === 'open' ? 'active' : ''} onClick={() => setActiveTab('open')}>
          Open {openCount > 0 && <span className="wm-issues-tab-count">{openCount}</span>}
        </button>
        <button className={activeTab === 'resolved' ? 'active' : ''} onClick={() => setActiveTab('resolved')}>
          Resolved {resolvedCount > 0 && <span className="wm-issues-tab-count">{resolvedCount}</span>}
        </button>
        <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>All</button>
      </div>

      {filtered.length === 0 ? (
        <div className="wm-issues-empty">
          <div className="empty-icon">{activeTab === 'open' ? '✅' : '📋'}</div>
          <p>{activeTab === 'open' ? 'No open issues' : 'No issues found'}</p>
        </div>
      ) : (
        filtered.map((issue, i) => (
          <motion.div key={issue.id} className="wm-issue-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <div className="wm-issue-card-header">
              <span className={`wm-issue-type ${issue.issue_type}`}>{issue.issue_type}</span>
              <span className={`wm-issue-status ${issue.status}`}>{issue.status}</span>
            </div>
            <div className="wm-issue-order">
              <strong>Order #{issue.order_id}</strong>
              {issue.order_item_id && <span> • Item #{issue.order_item_id}</span>}
            </div>
            <div className="wm-issue-desc">{issue.description}</div>

            {issue.status === 'resolved' && issue.resolution_note && (
              <div className="wm-issue-resolution">
                <strong>Resolution:</strong> {issue.resolution_note}
              </div>
            )}

            <div className="wm-issue-date">Reported: {formatDate(issue.created_at)}{issue.resolved_at && ` • Resolved: ${formatDate(issue.resolved_at)}`}</div>

            {issue.status === 'open' && (
              <div className="wm-resolve-form">
                <textarea
                  placeholder="Resolution note..."
                  value={resolveNotes[issue.id] || ''}
                  onChange={e => setResolveNotes(prev => ({ ...prev, [issue.id]: e.target.value }))}
                />
                <button className="wm-resolve-btn" onClick={() => handleResolve(issue.id)} disabled={resolvingId === issue.id || !resolveNotes[issue.id]?.trim()}>
                  {resolvingId === issue.id ? '...' : 'Resolve'}
                </button>
              </div>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
};

export default WarehouseIssues;
