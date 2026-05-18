import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiTarget, FiLayers, FiZap, FiTag, FiMessageSquare, FiCheckCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { TICKET_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/helpers';
import '../../styles/pages/support-agent/SupportAgentDashboard.css';

const SupportAgentDashboard = () => {
  const [stats, setStats] = useState({
    managerAssigned: 0,
    selfClaimed: 0,
    available: 0,
    inProgress: 0,
    resolved: 0
  });
  const [activeTickets, setActiveTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [assignedRes, unassignedRes] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ASSIGNED),
        http.get(TICKET_ENDPOINTS.UNASSIGNED)
      ]);
      
      const assigned = assignedRes.data || [];
      const unassigned = unassignedRes.data || [];
      const allTickets = [...assigned, ...unassigned];
      
      const counts = allTickets.reduce((acc, t) => {
        if (!t.employee_id) {
          acc.available++;
        } else {
          const isActive = t.status !== 'Resolved' && t.status !== 'Closed';

          if (isActive) {
            // If assigned_by is manager/admin
            if (t.assigned_by_user && (t.assigned_by_user.role === 'support_manager' || t.assigned_by_user.role === 'admin')) {
              acc.managerAssigned++;
            } 
            // If assigned_by is the agent themselves (claimed)
            else if (t.assigned_by === t.employee_id) {
              acc.selfClaimed++;
            }
            // Default to manager assigned if no assigned_by info (fallback for old/auto tickets)
            else {
              acc.managerAssigned++;
            }
          }

          if (t.status === 'In Progress') acc.inProgress++;
          else if (t.status === 'Resolved' || t.status === 'Closed') acc.resolved++;
        }
        return acc;
      }, { managerAssigned: 0, selfClaimed: 0, available: 0, inProgress: 0, resolved: 0 });
      
      setStats(counts);
      setActiveTickets(assigned.filter(t => t.status !== 'Closed' && t.status !== 'Resolved').slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading"><LoadingSpinner size="large" /></div>;

  return (
    <div className="support-agent-dashboard">
      <header className="dashboard-header">
        <h1>Support Agent Dashboard</h1>
        <p>Track your workload and assist customers effectively.</p>
      </header>

      <div className="stats-grid">
        <motion.div className="stat-card manager" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <FiBriefcase className="icon" />
          <div className="info">
            <h3>{stats.managerAssigned}</h3>
            <span>Assigned by Manager</span>
          </div>
        </motion.div>

        <motion.div className="stat-card self" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <FiTarget className="icon" />
          <div className="info">
            <h3>{stats.selfClaimed}</h3>
            <span>Self-Claimed Tickets</span>
          </div>
        </motion.div>

        <motion.div className="stat-card available" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <FiLayers className="icon" />
          <div className="info">
            <h3>{stats.available}</h3>
            <span>Available to Claim</span>
          </div>
        </motion.div>

        <motion.div className="stat-card progress" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
          <FiZap className="icon" />
          <div className="info">
            <h3>{stats.inProgress}</h3>
            <span>Active Conversations</span>
          </div>
        </motion.div>

        <motion.div className="stat-card resolved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
          <FiCheckCircle className="icon" style={{ color: '#10b981' }} />
          <div className="info">
            <h3>{stats.resolved}</h3>
            <span>Resolved Tickets</span>
          </div>
        </motion.div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-actions">
          <h2>Quick Actions</h2>
          <div className="action-grid">
            <Link to="/support-agent/tickets" className="action-card">
              <FiTag />
              <h3>View All Tickets</h3>
              <p>Go to your ticket list to manage all assignments.</p>
            </Link>
            <Link to="/support-agent/chats" className="action-card">
              <FiMessageSquare />
              <h3>Active Chats</h3>
              <p>Real-time chat with customers assigned to you.</p>
            </Link>
          </div>
        </div>

        <div className="active-tickets-section">
          <h2>Active Tickets</h2>
          <div className="tickets-list">
            {activeTickets.length > 0 ? (
              activeTickets.map(ticket => (
                <Link key={ticket.id} to="/support-agent/tickets" className="ticket-item">
                  <div className="ticket-info">
                    <h4>{ticket.title}</h4>
                    <span>{ticket.customer?.email}</span>
                  </div>
                  <div className="ticket-meta">
                    <span className={`status-badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span>
                    <span className="date">{formatDate(ticket.created_at)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="no-tickets">No active tickets at the moment.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportAgentDashboard;
