import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiTag, FiUsers, FiMessageSquare, FiTrendingUp } from 'react-icons/fi';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { TICKET_ENDPOINTS, FEEDBACK_ENDPOINTS, COMMENT_ENDPOINTS, USER_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/pages/support-manager/SupportManagerDashboard.css';

const SupportManagerDashboard = () => {
  const [stats, setStats] = useState({
    openTickets: 0,
    reportedComments: 0,
    avgRating: 0,
    activeAgents: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, commentsRes, feedbackRes, usersRes] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ALL).catch(err => {
          console.error("Error fetching tickets:", err);
          return { data: [] };
        }),
        http.get(COMMENT_ENDPOINTS.ALL, { params: { is_reported: true } }).catch(err => {
          console.error("Error fetching comments:", err);
          return { data: [] };
        }),
        http.get(FEEDBACK_ENDPOINTS.ALL, { params: { limit: 100 } }).catch(err => {
          console.error("Error fetching feedback:", err);
          return { data: [] };
        }),
        http.get(USER_ENDPOINTS.ALL).catch(err => {
          console.error("Error fetching users:", err);
          return { data: [] };
        })
      ]);

      const tickets = ticketsRes.data || [];
      const reported = commentsRes.data || [];
      const feedback = feedbackRes.data || [];
      const users = usersRes.data || [];

      const avg = feedback.length > 0 
        ? (feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length).toFixed(1)
        : 0;

      const supportAgentsCount = users.filter(u => u.role === 'support_agent').length;

      setStats({
        openTickets: tickets.filter(t => t.status === 'Open').length,
        reportedComments: reported.length,
        avgRating: avg,
        activeAgents: supportAgentsCount
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-loading dashboard-loading"><LoadingSpinner size="large" /></div>;

  const smTitle = tUi("ui.pages.support_manager.dashboard.title");
  const smSubtitle = tUi("ui.pages.support_manager.dashboard.subtitle");

  return (
    <div className="admin-page-shell support-manager-dashboard">
      <PageHeader kicker={smTitle} title={smTitle} subtitle={smSubtitle} />

      <div className="stats-grid">
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="icon-box tickets"><FiTag /></div>
          <div className="stat-info">
            <h3>{stats.openTickets}</h3>
            <span>{tUi("ui.pages.support_manager.dashboard.openTickets")}</span>
          </div>
        </motion.div>

        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="icon-box reported"><FiMessageSquare /></div>
          <div className="stat-info">
            <h3>{stats.reportedComments}</h3>
            <span>{tUi("ui.pages.support_manager.dashboard.reportedComments")}</span>
          </div>
        </motion.div>

        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="icon-box rating"><FiTrendingUp /></div>
          <div className="stat-info">
            <h3>{stats.avgRating}</h3>
            <span>{tUi("ui.pages.support_manager.dashboard.avgRating")}</span>
          </div>
        </motion.div>

        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="icon-box agents"><FiUsers /></div>
          <div className="stat-info">
            <h3>{stats.activeAgents}</h3>
            <span>{tUi("ui.pages.support_manager.dashboard.activeAgents")}</span>
          </div>
        </motion.div>
      </div>

      <div className="management-sections">
        <div className="section-group">
          <h2>{tUi("ui.pages.support_manager.dashboard.managementActions")}</h2>
          <div className="action-grid">
            <Link to="/support/tickets" className="action-card">
              <FiTag />
              <div className="text">
                <h3>{tUi("ui.pages.support_manager.dashboard.assignTickets")}</h3>
                <p>{tUi("ui.pages.support_manager.dashboard.assignTicketsDesc")}</p>
              </div>
            </Link>
            <Link to="/support/comments" className="action-card">
              <FiMessageSquare />
              <div className="text">
                <h3>{tUi("ui.pages.support_manager.dashboard.moderateComments")}</h3>
                <p>{tUi("ui.pages.support_manager.dashboard.moderateCommentsDesc")}</p>
              </div>
            </Link>
            <Link to="/support/feedback" className="action-card">
              <FiTrendingUp />
              <div className="text">
                <h3>{tUi("ui.pages.support_manager.dashboard.analyzeFeedback")}</h3>
                <p>{tUi("ui.pages.support_manager.dashboard.analyzeFeedbackDesc")}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportManagerDashboard;
