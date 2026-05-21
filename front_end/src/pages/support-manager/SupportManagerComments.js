import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiCheck, FiTrash2, FiFlag, FiFilter, FiMessageSquare } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../../services/http';
import { COMMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/support-manager/SupportManagerComments.css';

const SupportManagerComments = () => {
  const [activeTab, setActiveTab] = useState('reported'); // 'reported' or 'all'
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [approving, setApproving] = useState(null);
  const confirm = useConfirm();

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        skip: 0,
        limit: 100,
        is_reported: activeTab === 'reported' ? true : undefined
      };
      const response = await http.get(COMMENT_ENDPOINTS.ALL, { params });
      let data = response.data || [];
      
      if (sentimentFilter !== 'all' && activeTab === 'all') {
        data = data.filter(c => c.sentiment === sentimentFilter);
      }
      
      setComments(data);
    } catch (error) {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [activeTab, sentimentFilter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleDelete = async (commentId) => {
    const isConfirmed = await confirm({
      title: 'Delete Comment',
      message: 'Are you sure you want to permanently delete this comment?',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (isConfirmed) {
      setDeleting(commentId);
      try {
        await http.delete(buildUrl(COMMENT_ENDPOINTS.DELETE, { comment_id: commentId }));
        toast.success('Comment deleted');
        fetchComments();
      } catch (error) {
        toast.error('Deletion failed');
      } finally {
        setDeleting(null);
      }
    }
  };

  const handleApprove = async (commentId) => {
    setApproving(commentId);
    try {
      const url = buildUrl(COMMENT_ENDPOINTS.APPROVE, { comment_id: commentId });
      await http.patch(url);
      toast.success('Comment approved');
      fetchComments();
    } catch (error) {
      toast.error('Failed to approve comment');
    } finally {
      setApproving(null);
    }
  };

  const commentModerationTitle = 'Comment Moderation';

  return (
    <div className="admin-page-shell support-manager-comments">
      <header className="comments-header">
        <PageHeader
          kicker={commentModerationTitle}
          title={commentModerationTitle}
          actions={
        <div className="header-tabs">
          <button 
            className={activeTab === 'reported' ? 'active' : ''} 
            onClick={() => setActiveTab('reported')}
          >
            Reported {activeTab === 'reported' && `(${comments.length})`}
          </button>
          <button 
            className={activeTab === 'all' ? 'active' : ''} 
            onClick={() => setActiveTab('all')}
          >
            All Comments
          </button>
        </div>
          }
        />
      </header>

      <div className="moderation-controls">
        {activeTab === 'all' && (
          <div className="filter-row">
            <FiFilter />
            <select value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value)}>
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        )}
      </div>

      <div className="comments-container">
        {loading ? (
          <div className="page-loading loading-state"><LoadingSpinner size="large" /></div>
        ) : comments.length > 0 ? (
          <div className="comments-grid">
            <AnimatePresence mode="popLayout">
              {comments.map((comment) => (
                <motion.div 
                  key={comment.id} 
                  className={`comment-moderation-card ${comment.is_reported ? 'reported' : ''}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <div className="card-header">
                    <div className="user-meta">
                      <div className="avatar">{comment.user?.first_name[0]}</div>
                      <div className="info">
                        <strong>{comment.user?.first_name} {comment.user?.last_name}</strong>
                        <span>{formatDate(comment.created_at)}</span>
                      </div>
                    </div>
                    {comment.sentiment && (
                      <span className={`sentiment-tag ${comment.sentiment}`}>
                        {comment.sentiment}
                      </span>
                    )}
                  </div>
                  
                  <div className="card-body">
                    <p>{comment.content}</p>
                    {comment.is_reported && (
                      <div className="report-badge">
                        <FiFlag /> Reported
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <button 
                      className="approve-btn" 
                      onClick={() => handleApprove(comment.id)}
                      disabled={approving === comment.id}
                    >
                      {approving === comment.id ? <LoadingSpinner size="small" /> : <><FiCheck /> Approve</>}
                    </button>
                    <button 
                      className="delete-btn" 
                      onClick={() => handleDelete(comment.id)}
                      disabled={deleting === comment.id}
                    >
                      {deleting === comment.id ? <LoadingSpinner size="small" /> : <><FiTrash2 /> Delete</>}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="empty-state">
            <FiMessageSquare size="48" />
            <p>No {activeTab === 'reported' ? 'reported' : ''} comments found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportManagerComments;
