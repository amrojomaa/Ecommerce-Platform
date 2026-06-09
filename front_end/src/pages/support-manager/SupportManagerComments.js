import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { FiCheck, FiFlag, FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../../services/http';
import { COMMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import { tUi } from '../../i18n/uiText';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import TicketUserAvatar from '../../components/TicketUserAvatar';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/support-manager/SupportPanel.css';
import '../../styles/pages/support-manager/SupportManagerComments.css';

const SENTIMENT_LABEL_KEYS = {
  positive: 'ui.pages.admin.adminComments.sentimentPositive_70da220f7a',
  neutral: 'ui.pages.admin.adminComments.sentimentNeutral_1adf64fbd4',
  negative: 'ui.pages.admin.adminComments.sentimentNegative_78ec8a0d98',
};

const SupportManagerComments = () => {
  const { t } = useTranslation();
  const panelKicker = t('ui.sidebar.panel.support');
  const [activeTab, setActiveTab] = useState('reported');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [approving, setApproving] = useState(null);
  const confirm = useConfirm();

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        skip: 0,
        limit: 100,
        is_reported: activeTab === 'reported' ? true : undefined,
      };
      const response = await http.get(COMMENT_ENDPOINTS.ALL, { params });
      setComments(response.data || []);
    } catch (error) {
      toast.error(t('ui.pages.support_manager.comments.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, t]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleDelete = async (commentId) => {
    const isConfirmed = await confirm({
      title: t('ui.pages.support_manager.comments.confirmDeleteTitle'),
      message: t('ui.pages.support_manager.comments.confirmDeleteMessage'),
      confirmText: t('ui.pages.support_manager.comments.delete'),
      cancelText: t('ui.pages.admin.adminComments.cancel_117ba1126e'),
    });
    if (!isConfirmed) return;

    setDeleting(commentId);
    try {
      await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
      toast.success(t('ui.pages.support_manager.comments.deleteSuccess'));
      fetchComments();
    } catch (error) {
      toast.error(t('ui.pages.support_manager.comments.deleteFailed'));
    } finally {
      setDeleting(null);
    }
  };

  const handleApprove = async (commentId) => {
    setApproving(commentId);
    try {
      const url = buildUrl(COMMENT_ENDPOINTS.APPROVE, { comment_id: commentId });
      await http.patch(url);
      toast.success(t('ui.pages.support_manager.comments.approveSuccess'));
      fetchComments();
    } catch (error) {
      toast.error(t('ui.pages.support_manager.comments.approveFailed'));
    } finally {
      setApproving(null);
    }
  };

  const getSentimentLabel = (sentiment) => {
    if (!sentiment) return null;
    const key = SENTIMENT_LABEL_KEYS[sentiment.toLowerCase()];
    return key ? tUi(key) : sentiment;
  };

  const tabButtons = [
    { id: 'reported', label: t('ui.pages.support_manager.comments.tab.reports') },
    { id: 'all', label: t('ui.pages.support_manager.comments.tab.all') },
  ];

  return (
    <div className="admin-page-shell adm-page spm-page spm-comments-page">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.support_manager.comments.title')}
        subtitle={t('ui.pages.support_manager.comments.subtitle')}
        actions={
          <div className="spm-pill-tabs" role="tablist" aria-label={t('ui.pages.support_manager.comments.title')}>
            {tabButtons.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`spm-pill-tab${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="spm-pill-tab-count">({comments.length})</span>
                )}
              </button>
            ))}
          </div>
        }
      />

      {activeTab === 'all' && (
        <section className="spm-cmt-section">
          <div className="spm-toolbar">
            <p className="spm-cmt-count" aria-live="polite">
              <strong>{comments.length}</strong>{' '}
              {comments.length === 1
                ? t('ui.pages.support_manager.comments.commentSingular')
                : t('ui.pages.support_manager.comments.commentPlural')}
            </p>
          </div>
        </section>
      )}

      <section className="spm-cmt-section">
        {loading ? (
          <div className="page-loading adm-page-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : comments.length === 0 ? (
          <div className="spm-page-empty">
            <FiMessageSquare size={48} aria-hidden />
            <p>{t('ui.pages.support_manager.comments.empty')}</p>
          </div>
        ) : (
          <div className="spm-cmt-grid">
            <AnimatePresence mode="popLayout">
              {comments.map((comment, index) => (
                <motion.article
                  key={comment.id}
                  className={`spm-cmt-card${comment.is_reported ? ' is-reported' : ''}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                >
                  <div className="spm-cmt-card-header">
                    <div className="spm-cmt-user">
                      <TicketUserAvatar user={comment.user} size={44} className="spm-cmt-avatar" />
                      <div className="spm-cmt-user-copy">
                        <strong>
                          {comment.user?.first_name} {comment.user?.last_name}
                        </strong>
                        <span>{formatDate(comment.created_at)}</span>
                      </div>
                    </div>
                    {comment.sentiment && (
                      <span className={`spm-cmt-sentiment spm-cmt-sentiment--${comment.sentiment}`}>
                        {getSentimentLabel(comment.sentiment)}
                      </span>
                    )}
                  </div>

                  <div className="spm-cmt-body">
                    <p>{comment.content}</p>
                    {comment.is_reported && (
                      <span className="spm-cmt-report-badge">
                        <FiFlag aria-hidden />
                        {t('ui.pages.support_manager.comments.reported')}
                      </span>
                    )}
                  </div>

                  <div className="spm-cmt-actions">
                    <button
                      type="button"
                      className="adm-btn-secondary spm-cmt-btn"
                      onClick={() => handleApprove(comment.id)}
                      disabled={approving === comment.id}
                    >
                      {approving === comment.id ? (
                        <LoadingSpinner size="small" />
                      ) : (
                        <>
                          <FiCheck aria-hidden />
                          {t('ui.pages.support_manager.comments.approve')}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="spm-cmt-btn spm-cmt-btn--delete"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deleting === comment.id}
                    >
                      {deleting === comment.id ? (
                        <LoadingSpinner size="small" />
                      ) : (
                        <>
                          <FiTrash2 aria-hidden />
                          {t('ui.pages.support_manager.comments.delete')}
                        </>
                      )}
                    </button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
};

export default SupportManagerComments;
