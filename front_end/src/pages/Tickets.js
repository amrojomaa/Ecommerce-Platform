import { tUi } from "../i18n/uiText";
import React, { useState, useEffect } from 'react';
import { FiPlus, FiX, FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';
import http from '../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import { useConfirm } from '../hooks/useConfirm';
import SupportTicketChatModal from '../components/SupportTicketChatModal';
import { useAuth } from '../hooks/useAuth';
import '../styles/pages/Tickets.css';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '' });
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [activeChatTicketId, setActiveChatTicketId] = useState(null);
  const [deletingTicketId, setDeletingTicketId] = useState(null);
  const { markAsViewed } = useUnreadTickets();
  const confirm = useConfirm();
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchTickets();
    // Mark tickets as viewed when page loads
    markAsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.MY);
      setTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error(tUi("ui.pages.tickets.failedToFetchTickets_550b44f85c"));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      toast.error(tUi("ui.pages.tickets.pleaseFillInAllFields_4471417b8d"));
      return;
    }

    setCreating(true);
    try {
      await http.post(TICKET_ENDPOINTS.CREATE, newTicket);
      toast.success(tUi("ui.pages.tickets.ticketCreatedSuccessfully_160b1ad7b1"));
      setNewTicket({ title: '', description: '' });
      setShowCreateForm(false);
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleAddResponse = async (ticketId) => {
    if (!responseMessage.trim()) {
      toast.error(tUi("ui.pages.tickets.pleaseEnterAMessage_2ac42d2101"));
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage });
      toast.success(tUi("ui.pages.tickets.responseAddedSuccessfully_4454e51342"));
      setResponseMessage('');
      fetchTickets();
    } catch (error) {
      console.error('Error adding response:', error);
      toast.error(error.response?.data?.detail || 'Failed to add response');
    } finally {
      setRespondingTicketId(null);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    const confirmed = await confirm({
      title: "Delete Ticket",
      message: "Are you sure you want to delete this ticket? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (!confirmed) {
      return;
    }
    setDeletingTicketId(ticketId);
    try {
      await http.delete(`${TICKET_ENDPOINTS.MY.replace('/my', '')}/${ticketId}`);
      toast.success("Ticket deleted successfully");
      fetchTickets();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete ticket');
    } finally {
      setDeletingTicketId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress':
        return 'status-in-progress';
      case 'Resolved':
        return 'status-resolved';
      case 'Closed':
        return 'status-closed';
      default:
        return 'status-default';
    }
  };

  if (loading) {
    return (
      <div className="tickets-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  return (
    <div className="tickets-page">
      <div className="tickets-layout">
        <div className="tickets-main">
          <div className="tickets-header">
            <div>
              <h1>{tUi("ui.pages.tickets.myTickets_7b2e55ccc1")}</h1>
              <p className="subtitle">View and manage your support requests</p>
            </div>
            <button
              className={`create-ticket-btn ${showCreateForm ? 'cancel' : ''}`}
              onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? (
                <><FiX /> {tUi("ui.pages.tickets.cancel_320b7f4df0")}</>
              ) : (
                <><FiPlus /> {tUi("ui.pages.tickets.createNewTicket_b216e424fe")}</>
              )}
            </button>
          </div>

          {showCreateForm && (
            <div className="create-ticket-form">
              <h2>{tUi("ui.pages.tickets.createNewTicket_0662914296")}</h2>
              <form onSubmit={handleCreateTicket}>
                <div className="form-group">
                  <label htmlFor="title">{tUi("ui.pages.tickets.title_1ae4d1369f")}</label>
                  <input
                    type="text"
                    id="title"
                    value={newTicket.title}
                    onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                    placeholder={tUi("ui.pages.tickets.enterTicketTitle_97d186e8ee")}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="description">{tUi("ui.pages.tickets.description_5df2b50e3c")}</label>
                  <textarea
                    id="description"
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    placeholder={tUi("ui.pages.tickets.describeYourIssueOrQuestion_ed3fd64aae")}
                    rows="5"
                    required
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={creating} className="submit-btn">
                    {creating ? (
                      tUi("ui.pages.tickets.creating_5f1a5f7f04")
                    ) : (
                      <><FiSend /> {tUi("ui.pages.tickets.createTicket_6a6e8488fc")}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {tickets.length === 0 ? (
            <div className="empty-tickets">
              <div className="empty-icon">🎫</div>
              <p>{tUi("ui.pages.tickets.youHavenTCreatedAny_d33bce3131")}</p>
              {!showCreateForm && (
                <button
                  className="create-ticket-btn"
                  onClick={() => setShowCreateForm(true)}>
                  {tUi("ui.pages.tickets.createYourFirstTicket_a2720076a8")}
                </button>
              )}
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map((ticket) => {
                const isExpanded = expandedTicketId === ticket.id;
                return (
                  <div key={ticket.id} className={`ticket-card ${isExpanded ? 'expanded' : ''}`}>
                    <div
                      className="ticket-header clickable"
                      onClick={() => {
                        setExpandedTicketId(isExpanded ? null : ticket.id);
                        if (!isExpanded) markAsViewed(); // Mark as viewed when expanding
                      }}
                    >
                      <div className="ticket-title-group">
                        <div className="status-indicator" style={{ background: ticket.status === 'In Progress' ? '#eab308' : ticket.status === 'Resolved' ? '#22c55e' : '#64748b' }}></div>
                        <div>
                          <h3>{ticket.title}</h3>
                          <p className="ticket-date">{tUi("ui.pages.tickets.created_caf8e8fb6f")} {formatDate(ticket.created_at)}</p>
                        </div>
                      </div>
                      <div className="ticket-header-right">
                        <span className={`status-badge ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                        <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="ticket-details">
                        <div className="ticket-content-grid">
                          <div className="ticket-info-section">
                            <div className="ticket-description">
                              <h4>{tUi("ui.pages.tickets.description_5df2b50e3c")}</h4>
                              <p>{ticket.description}</p>
                            </div>

                            <div className="ticket-responses">
                              <h4>{tUi("ui.pages.tickets.responses_71bbaea046")} ({ticket.responses?.filter(r => !r.is_chat).length || 0})</h4>
                              {ticket.responses && ticket.responses.filter(r => !r.is_chat).length > 0 ? (
                                <div className="responses-list">
                                  {ticket.responses.filter(r => !r.is_chat).map((response) => (
                                    <div key={response.id} className={`response-item ${response.user.role !== 'customer' ? 'agent-response' : ''}`}>
                                      <div className="response-header">
                                        <span className="response-author">
                                          {response.user.first_name} {response.user.last_name}
                                          {response.user.role !== 'customer' && <span className="agent-tag">Support Agent</span>}
                                        </span>
                                        <span className="response-date">{formatDate(response.created_at)}</span>
                                      </div>
                                      <p className="response-message">{response.message}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="no-responses">{tUi("ui.pages.tickets.noResponsesYet_c19fb28b39")}</p>
                              )}
                            </div>
                          </div>

                          {ticket.status !== "Closed" && ticket.status !== "Resolved" && (
                            <div className="ticket-actions-section">
                              <div className="chat-integration-card">
                                <h5>Live Support</h5>
                                <p>Chat directly with an agent for faster resolution.</p>
                                <button 
                                  className={`live-chat-launch-btn ${!ticket.employee ? 'disabled' : ''}`}
                                  onClick={() => ticket.employee && setActiveChatTicketId(ticket.id)}
                                  disabled={!ticket.employee}
                                  title={!ticket.employee ? "Waiting for an agent to be assigned" : ""}
                                >
                                  💬 {!ticket.employee ? 'Waiting for Agent...' : 'Start Live Chat'}
                                </button>
                                {ticket.employee ? (
                                  <div className="assigned-agent-info">
                                    <div className="agent-avatar">
                                      {ticket.employee.first_name[0]}{ticket.employee.last_name[0]}
                                    </div>
                                    <div className="agent-details">
                                      <span className="label">Assigned Agent</span>
                                      <span className="name">{ticket.employee.first_name} {ticket.employee.last_name}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="pending-assignment-info">
                                    <p className="status-note">Our team will assign an agent soon. You can chat once an agent is active on your ticket.</p>
                                  </div>
                                )}
                              </div>

                              <div className="quick-response">
                                <h5>Add Quick Note</h5>
                                <textarea
                                  value={responseMessage}
                                  onChange={(e) => setResponseMessage(e.target.value)}
                                  placeholder={!ticket.employee ? "Responses available once an agent is assigned" : tUi("ui.pages.tickets.typeYourResponse_2fc5ce1286")}
                                  rows="3"
                                  disabled={!ticket.employee}
                                />
                                <button
                                  className="submit-response-btn"
                                  onClick={() => handleAddResponse(ticket.id)}
                                  disabled={!ticket.employee || respondingTicketId === ticket.id || !responseMessage.trim()}
                                >
                                  {respondingTicketId === ticket.id ? tUi("ui.pages.tickets.sending_feee595abe") : tUi("ui.pages.tickets.sendResponse_9963e23826")}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id)}
                            disabled={deletingTicketId === ticket.id}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                          >
                            {deletingTicketId === ticket.id ? "Deleting..." : "Delete Ticket"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="tickets-sidebar">

          <div className="sidebar-card support-info">
            <h4>Support Hours</h4>
            <p>Mon - Fri: 9:00 AM - 6:00 PM</p>
            <p>Sat - Sun: 10:00 AM - 4:00 PM</p>
            <hr />
            <h4>Common Questions</h4>
            <ul className="faq-links">
              <li><a href="/faq">Shipping Policy</a></li>
              <li><a href="/faq">Refunds & Returns</a></li>
              <li><a href="/faq">Account Settings</a></li>
            </ul>
          </div>
        </div>
      </div>

      <SupportTicketChatModal 
        isOpen={!!activeChatTicketId}
        onClose={() => setActiveChatTicketId(null)}
        ticketId={activeChatTicketId}
        currentUserId={currentUser?.id}
        userName={currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : ''}
        ticketStatus={tickets.find(t => t.id === activeChatTicketId)?.status}
      />
    </div>
  );
};

export default Tickets;
