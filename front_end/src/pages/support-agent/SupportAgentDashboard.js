import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import { FiBriefcase, FiCheckCircle, FiLayers, FiMessageSquare, FiTag, FiTarget, FiZap } from 'react-icons/fi';
import http from '../../services/http';
import { TICKET_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { formatDate } from '../../utils/helpers';
import { tUi } from '../../i18n/uiText';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/support-manager/SupportPanel.css';
import '../../styles/pages/support-agent/SupportAgentPanel.css';
import '../../styles/pages/support-agent/SupportAgentDashboard.css';

const TICKET_STATUS_LABEL_KEYS = {
  open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  in_progress: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6',
  resolved: 'ui.pages.admin.adminTickets.resolved_696eb2f977',
  closed: 'ui.pages.admin.adminTickets.closed_5b72d42e4a',
};

const normalizeTicketStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const ticketsPath = (tab = 'assigned') =>
  tab === 'assigned' ? '/support-agent/tickets' : `/support-agent/tickets?tab=${tab}`;

const SupportAgentDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelKicker = t('ui.sidebar.panel.support_agent');

  const [stats, setStats] = useState({
    managerAssigned: 0,
    selfClaimed: 0,
    available: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [activeTickets, setActiveTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const getStatusLabel = (status) => {
    const normalized = normalizeTicketStatus(status);
    const key = TICKET_STATUS_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return status || normalized.replace(/_/g, ' ');
  };

  const getStatusClass = (status) => {
    const normalized = normalizeTicketStatus(status);
    if (['open', 'in_progress', 'resolved', 'closed'].includes(normalized)) {
      return `adm-tkt-status adm-tkt-status--${normalized}`;
    }
    return 'adm-tkt-status adm-tkt-status--default';
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [assignedRes, unassignedRes] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ASSIGNED),
        http.get(TICKET_ENDPOINTS.UNASSIGNED),
      ]);

      const assigned = assignedRes.data || [];
      const unassigned = unassignedRes.data || [];
      const allTickets = [...assigned, ...unassigned];

      const counts = allTickets.reduce(
        (acc, ticket) => {
          if (!ticket.employee_id) {
            acc.available += 1;
          } else {
            const isActive = ticket.status !== 'Resolved' && ticket.status !== 'Closed';

            if (isActive) {
              if (
                ticket.assigned_by_user &&
                (ticket.assigned_by_user.role === 'support_manager' || ticket.assigned_by_user.role === 'admin')
              ) {
                acc.managerAssigned += 1;
              } else if (ticket.assigned_by === ticket.employee_id) {
                acc.selfClaimed += 1;
              } else {
                acc.managerAssigned += 1;
              }
            }

            if (ticket.status === 'In Progress') acc.inProgress += 1;
            else if (ticket.status === 'Resolved' || ticket.status === 'Closed') acc.resolved += 1;
          }
          return acc;
        },
        { managerAssigned: 0, selfClaimed: 0, available: 0, inProgress: 0, resolved: 0 }
      );

      setStats(counts);
      setActiveTickets(
        assigned.filter((ticket) => ticket.status !== 'Closed' && ticket.status !== 'Resolved').slice(0, 5)
      );
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const statCards = [
    {
      key: 'managerAssigned',
      title: t('ui.pages.support_agent.dashboard.managerAssigned'),
      value: stats.managerAssigned,
      icon: FiBriefcase,
      iconClass: 'adm-stat-icon--deliveries',
      path: ticketsPath('assigned'),
    },
    {
      key: 'selfClaimed',
      title: t('ui.pages.support_agent.dashboard.selfClaimed'),
      value: stats.selfClaimed,
      icon: FiTarget,
      iconClass: 'adm-stat-icon--orders',
      path: ticketsPath('assigned'),
    },
    {
      key: 'available',
      title: t('ui.pages.support_agent.dashboard.available'),
      value: stats.available,
      icon: FiLayers,
      iconClass: 'adm-stat-icon--low',
      path: ticketsPath('unassigned'),
    },
    {
      key: 'inProgress',
      title: t('ui.pages.support_agent.dashboard.inProgress'),
      value: stats.inProgress,
      icon: FiZap,
      iconClass: 'adm-stat-icon--revenue',
      path: ticketsPath('assigned'),
    },
    {
      key: 'resolved',
      title: t('ui.pages.support_agent.dashboard.resolved'),
      value: stats.resolved,
      icon: FiCheckCircle,
      iconClass: 'adm-stat-icon--products',
      path: ticketsPath('completed'),
    },
  ];

  const actionCards = [
    {
      path: ticketsPath('assigned'),
      icon: FiTag,
      iconClass: 'adm-action-card-icon--orders',
      title: t('ui.pages.support_agent.dashboard.viewAllTickets'),
      desc: t('ui.pages.support_agent.dashboard.viewAllTicketsDesc'),
    },
    {
      path: '/support-agent/chats',
      icon: FiMessageSquare,
      iconClass: 'adm-action-card-icon--categories',
      title: t('ui.pages.support_agent.dashboard.activeChats'),
      desc: t('ui.pages.support_agent.dashboard.activeChatsDesc'),
    },
  ];

  return (
    <div className="admin-page-shell adm-page spa-page spa-dashboard adm-dashboard">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.support_agent.dashboard.title')}
        subtitle={t('ui.pages.support_agent.dashboard.subtitle')}
      />

      <section className="adm-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.support_agent.dashboard.section.overview')}</h2>
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
                transition={{ delay: index * 0.06 }}
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
          <h2>{t('ui.pages.support_agent.dashboard.section.quickActions')}</h2>
          <p>{t('ui.pages.support_agent.dashboard.section.quickActionsDesc')}</p>
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
                transition={{ delay: 0.15 + index * 0.08 }}
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

      <section className="adm-section spa-active-section">
        <div className="adm-section-header">
          <h2>{t('ui.pages.support_agent.dashboard.section.activeTickets')}</h2>
        </div>
        {activeTickets.length > 0 ? (
          <div className="spa-active-list">
            {activeTickets.map((ticket, index) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link to={ticketsPath('assigned')} className="spa-active-card">
                  <div className="spa-active-card-main">
                    <h3 className="spa-active-card-title">{ticket.title}</h3>
                    <p className="spa-active-card-meta">{ticket.customer?.email}</p>
                  </div>
                  <div className="spa-active-card-end">
                    <span className={getStatusClass(ticket.status)}>{getStatusLabel(ticket.status)}</span>
                    <span className="spa-active-card-date">{formatDate(ticket.created_at)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="spa-active-empty">
            <p>{t('ui.pages.support_agent.dashboard.noActiveTickets')}</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default SupportAgentDashboard;
