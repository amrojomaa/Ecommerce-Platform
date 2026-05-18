import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiSearch, FiUserPlus } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import SupportTicketChatModal from '../../components/SupportTicketChatModal';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/pages/support-manager/SupportManagerTickets.css';

const SupportManagerTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [assigningTo, setAssigningTo] = useState('');
  const [responseMsg, setResponseMsg] = useState('');
  const [activeChatTicketId, setActiveChatTicketId] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, agentsRes] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ALL),
        http.get(USER_ENDPOINTS.ALL, { params: { role: 'support_agent' } })
      ]);
      setTickets(ticketsRes.data || []);
      setAgents(agentsRes.data || []);
    } catch (error) {
      toast.error('Failed to load tickets or agents');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (ticketId) => {
    if (!assigningTo) {
      toast.warning('Please select an agent');
      return;
    }

    try {
      const url = buildUrl(TICKET_ENDPOINTS.ASSIGN, { ticket_id: ticketId });
      await http.patch(url, { agent_id: parseInt(assigningTo) });
      toast.success('Ticket assigned successfully');
      setSelectedTicket(null);
      setAssigningTo('');
      fetchData();
    } catch (error) {
      toast.error('Failed to assign ticket');
    }
  };

  const handleAddResponse = async (ticketId) => {
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMsg });
      toast.success('Response sent');
      setResponseMsg('');
      fetchData();
      // Optionally update the viewingTicket responses locally
      const updatedRes = await http.get(TICKET_ENDPOINTS.ALL);
      const newTicket = (updatedRes.data || []).find(t => t.id === ticketId);
      if (newTicket) setViewingTicket(newTicket);
    } catch (error) {
      toast.error('Failed to send response');
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.customer?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="loading-container"><LoadingSpinner size="large" /></div>;

  return (
    <div className="support-manager-tickets">
      <header className="tickets-header">
        <h1>Ticket Management</h1>
        <div className="header-actions">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Search by title or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="tickets-layout">
        <aside className="tickets-sidebar">
          <ul className="status-list">
            <li className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>
              All Tickets <span>{tickets.length}</span>
            </li>
            <li className={statusFilter === 'Open' ? 'active' : ''} onClick={() => setStatusFilter('Open')}>
              Open <span>{tickets.filter(t => t.status === 'Open').length}</span>
            </li>
            <li className={statusFilter === 'In Progress' ? 'active' : ''} onClick={() => setStatusFilter('In Progress')}>
              In Progress <span>{tickets.filter(t => t.status === 'In Progress').length}</span>
            </li>
            <li className={statusFilter === 'Resolved' ? 'active' : ''} onClick={() => setStatusFilter('Resolved')}>
              Resolved <span>{tickets.filter(t => t.status === 'Resolved').length}</span>
            </li>
            <li className={statusFilter === 'Closed' ? 'active' : ''} onClick={() => setStatusFilter('Closed')}>
              Closed <span>{tickets.filter(t => t.status === 'Closed').length}</span>
            </li>
          </ul>
        </aside>

        <main className="tickets-main-content">
          <div className="tickets-grid">
        {filteredTickets.map((ticket, index) => (
          <motion.div 
            key={ticket.id} 
            className="ticket-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="ticket-badge" data-status={ticket.status}>{ticket.status}</div>
            <div className="card-body">
              <h3>{ticket.title}</h3>
              <p className="customer">From: {ticket.customer?.email}</p>
              <p className="description">{ticket.description.substring(0, 100)}...</p>
              <div className="agent-info">
                <FiUserPlus />
                <span>{ticket.assigned_to_user ? `Assigned to: ${ticket.assigned_to_user.first_name}` : 'Unassigned'}</span>
              </div>
            </div>
            <div className="card-footer">
              <span className="date">{formatDate(ticket.created_at)}</span>
              {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                <button className="assign-btn" onClick={() => setSelectedTicket(ticket)}>
                  {ticket.assigned_to_user ? 'Reassign' : 'Assign'}
                </button>
              )}
              <button className="view-btn" onClick={() => setViewingTicket(ticket)}>
                View Details
              </button>
            </div>
          </motion.div>
        ))}
      </div>
        </main>
      </div>

      <AnimatePresence>
        {viewingTicket && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingTicket(null)}
          >
            <motion.div 
              className="modal-content wide"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{viewingTicket.title}</h2>
                <button className="close-x" onClick={() => setViewingTicket(null)}>&times;</button>
              </div>
              
              <div className="ticket-detail-body">
                <div className="meta-row">
                  <span className={`status-badge ${viewingTicket.status.toLowerCase().replace(' ', '-')}`}>{viewingTicket.status}</span>
                  <span className="customer-email">From: {viewingTicket.customer?.email}</span>
                </div>
                
                <div className="description-section">
                  <h4>Description</h4>
                  <p>{viewingTicket.description}</p>
                </div>

                <div className="responses-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0 }}>Conversation</h4>
                    {viewingTicket.status !== 'Resolved' && viewingTicket.status !== 'Closed' && (
                      <button 
                        className="btn-primary-action" 
                        style={{ backgroundColor: '#4f46e5', color: '#fff', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}
                        onClick={() => setActiveChatTicketId(viewingTicket.id)}
                      >
                        💬 Join Live Chat
                      </button>
                    )}
                  </div>
                  <div className="responses-list">
                    {viewingTicket.responses?.length > 0 ? (
                      viewingTicket.responses.map(res => (
                        <div key={res.id} className={`response-msg ${res.user.role === 'customer' ? 'customer' : 'staff'}`}>
                          <div className="msg-header">
                            <strong>{res.user.first_name} {res.user.last_name}</strong>
                            <span>{formatDate(res.created_at)}</span>
                          </div>
                          <p>{res.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="no-msgs">No messages yet.</p>
                    )}
                  </div>
                </div>

                {viewingTicket.status !== 'Resolved' && viewingTicket.status !== 'Closed' && (
                  <div className="add-msg-section">
                    <textarea 
                      placeholder="Type a response..." 
                      value={responseMsg}
                      onChange={(e) => setResponseMsg(e.target.value)}
                    />
                    <button 
                      className="send-btn" 
                      onClick={() => handleAddResponse(viewingTicket.id)}
                      disabled={!responseMsg.trim()}
                    >
                      Send Response
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTicket && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTicket(null)}
          >
            <motion.div 
              className="modal-content"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Assign Ticket: {selectedTicket.title}</h2>
              <div className="assign-form">
                <label>Select Support Agent</label>
                <select value={assigningTo} onChange={(e) => setAssigningTo(e.target.value)}>
                  <option value="">-- Choose Agent --</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name} ({agent.email})
                    </option>
                  ))}
                </select>
                <div className="modal-actions">
                  <button className="cancel-btn" onClick={() => setSelectedTicket(null)}>Cancel</button>
                  <button className="confirm-btn" onClick={() => handleAssign(selectedTicket.id)}>Confirm Assignment</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <SupportTicketChatModal 
        isOpen={!!activeChatTicketId}
        onClose={() => setActiveChatTicketId(null)}
        ticketId={activeChatTicketId}
        currentUserId={currentUser?.id}
        userName={currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : ''}
      />
    </div>
  );
};

export default SupportManagerTickets;
