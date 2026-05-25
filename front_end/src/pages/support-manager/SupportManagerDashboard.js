import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import { FiHeadphones, FiMessageSquare, FiStar, FiTag } from 'react-icons/fi';
import http from '../../services/http';
import { TICKET_ENDPOINTS, FEEDBACK_ENDPOINTS, COMMENT_ENDPOINTS, USER_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/support-manager/SupportPanel.css';
import '../../styles/pages/support-manager/SupportManagerDashboard.css';

const SupportManagerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelKicker = t('ui.sidebar.panel.support');

  const [stats, setStats] = useState({
    openTickets: 0,
    reportedComments: 0,
    avgRating: 0,
    activeAgents: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, commentsRes, feedbackRes, usersRes] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ALL).catch(() => ({ data: [] })),
        http.get(COMMENT_ENDPOINTS.ALL, { params: { is_reported: true } }).catch(() => ({ data: [] })),
        http.get(FEEDBACK_ENDPOINTS.ALL, { params: { limit: 100 } }).catch(() => ({ data: [] })),
        http.get(USER_ENDPOINTS.ALL).catch(() => ({ data: [] })),
      ]);

      const tickets = ticketsRes.data || [];
      const reported = commentsRes.data || [];
      const feedback = feedbackRes.data || [];
      const users = usersRes.data || [];

      const avg =
        feedback.length > 0
          ? (feedback.reduce((acc, item) => acc + item.rating, 0) / feedback.length).toFixed(1)
          : 0;

      setStats({
        openTickets: tickets.filter((ticket) => ticket.status === 'Open').length,
        reportedComments: reported.length,
        avgRating: avg,
        activeAgents: users.filter((user) => user.role === 'support_agent').length,
      });
    } catch (error) {
      console.error('Error fetching support dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const statCards = [
    {
      key: 'openTickets',
      title: t('ui.pages.support_manager.dashboard.openTickets'),
      value: stats.openTickets,
      icon: FiTag,
      iconClass: 'adm-stat-icon--orders',
      path: '/support/tickets',
    },
    {
      key: 'reportedComments',
      title: t('ui.pages.support_manager.dashboard.reportedComments'),
      value: stats.reportedComments,
      icon: FiMessageSquare,
      iconClass: 'adm-stat-icon--low',
      path: '/support/comments',
    },
    {
      key: 'avgRating',
      title: t('ui.pages.support_manager.dashboard.avgRating'),
      value: stats.avgRating,
      icon: FiStar,
      iconClass: 'adm-stat-icon--revenue',
      path: '/support/feedback',
    },
    {
      key: 'activeAgents',
      title: t('ui.pages.support_manager.dashboard.activeAgents'),
      value: stats.activeAgents,
      icon: FiHeadphones,
      iconClass: 'adm-stat-icon--deliveries',
      path: '/support/tickets',
    },
  ];

  const actionCards = [
    {
      path: '/support/tickets',
      icon: FiTag,
      iconClass: 'adm-action-card-icon--orders',
      title: t('ui.pages.support_manager.dashboard.assignTickets'),
      desc: t('ui.pages.support_manager.dashboard.assignTicketsDesc'),
    },
    {
      path: '/support/comments',
      icon: FiMessageSquare,
      iconClass: 'adm-action-card-icon--categories',
      title: t('ui.pages.support_manager.dashboard.moderateComments'),
      desc: t('ui.pages.support_manager.dashboard.moderateCommentsDesc'),
    },
    {
      path: '/support/feedback',
      icon: FiStar,
      iconClass: 'adm-action-card-icon--pos',
      title: t('ui.pages.support_manager.dashboard.analyzeFeedback'),
      desc: t('ui.pages.support_manager.dashboard.analyzeFeedbackDesc'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page spm-page spm-dashboard adm-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.support_manager.dashboard.title')}
        subtitle={t('ui.pages.support_manager.dashboard.subtitle')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.support_manager.dashboard.section.overview')}</h2>
        </div>
        <div className="adm-stats-grid">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.key}
                className="adm-stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => navigate(stat.path)}
              >
                <div className="stat-top">
                  <div className="stat-main">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.title}</div>
                  </div>
                  <div className={`stat-icon ${stat.iconClass}`}>
                    <Icon aria-hidden />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.support_manager.dashboard.section.quickActions')}</h2>
          <p>{t('ui.pages.support_manager.dashboard.section.quickActionsDesc')}</p>
        </div>
        <div className="adm-actions-grid">
          {actionCards.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.path}
                className="adm-action-card-wrap"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.08 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Link to={action.path} className="adm-action-card">
                  <div className={`adm-action-card-icon ${action.iconClass}`.trim()}>
                    <Icon aria-hidden />
                  </div>
                  <div className="adm-action-card-body">
                    <h3>{action.title}</h3>
                    <p>{action.desc}</p>
                  </div>
                  <FaArrowRight className="adm-action-card-arrow" aria-hidden />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default SupportManagerDashboard;
