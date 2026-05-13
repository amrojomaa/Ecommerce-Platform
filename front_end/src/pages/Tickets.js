import { tUi } from "../i18n/uiText";import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import http from '../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
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
  const { markAsViewed } = useUnreadTickets();

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
      <div className="tickets-header">
        <h1>{tUi("ui.pages.tickets.myTickets_7b2e55ccc1")}</h1>
        <button
          className="create-ticket-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}>
          
          {showCreateForm ? tUi("ui.pages.tickets.cancel_320b7f4df0") : tUi("ui.pages.tickets.createNewTicket_b216e424fe")}
        </button>
      </div>

      {showCreateForm &&
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
              required />
            
            </div>
            <div className="form-group">
              <label htmlFor="description">{tUi("ui.pages.tickets.description_5df2b50e3c")}</label>
              <textarea
              id="description"
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              placeholder={tUi("ui.pages.tickets.describeYourIssueOrQuestion_ed3fd64aae")}
              rows="5"
              required />
            
            </div>
            <div className="form-actions">
              <button type="submit" disabled={creating} className="submit-btn">
                {creating ? tUi("ui.pages.tickets.creating_5f1a5f7f04") : tUi("ui.pages.tickets.createTicket_6a6e8488fc")}
              </button>
            </div>
          </form>
        </div>
      }

      {tickets.length === 0 ?
      <div className="empty-tickets">
          <p>{tUi("ui.pages.tickets.youHavenTCreatedAny_d33bce3131")}</p>
          {!showCreateForm &&
        <button
          className="create-ticket-btn"
          onClick={() => setShowCreateForm(true)}>{tUi("ui.pages.tickets.createYourFirstTicket_a2720076a8")}


        </button>
        }
        </div> :

      <div className="tickets-list">
          {tickets.map((ticket) => {
          const isExpanded = expandedTicketId === ticket.id;
          return (
            <div key={ticket.id} className="ticket-card">
                <div
                className="ticket-header clickable"
                onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}>
                
                  <div>
                    <h3>{ticket.title}</h3>
                    <p className="ticket-date">{tUi("ui.pages.tickets.created_caf8e8fb6f")}
                    {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <div className="ticket-header-right">
                    <span className={`status-badge ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    {ticket.employee &&
                  <span className="assigned-to">{tUi("ui.pages.tickets.assignedTo_cf846f0372")}
                    {ticket.employee.first_name} {ticket.employee.last_name}
                      </span>
                  }
                    <span className="expand-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {isExpanded &&
              <div className="ticket-details">
                    <div className="ticket-description">
                      <h4>{tUi("ui.pages.tickets.description_5df2b50e3c")}</h4>
                      <p>{ticket.description}</p>
                    </div>

                    <div className="ticket-responses">
                      <h4>{tUi("ui.pages.tickets.responses_71bbaea046")}{ticket.responses?.length || 0})</h4>
                      {ticket.responses && ticket.responses.length > 0 ?
                  <div className="responses-list">
                          {ticket.responses.map((response) =>
                    <div key={response.id} className="response-item">
                              <div className="response-header">
                                <span className="response-author">
                                  {response.user.first_name} {response.user.last_name}
                                </span>
                                <span className="response-date">
                                  {formatDate(response.created_at)}
                                </span>
                              </div>
                              <p className="response-message">{response.message}</p>
                            </div>
                    )}
                        </div> :

                  <p className="no-responses">{tUi("ui.pages.tickets.noResponsesYet_c19fb28b39")}</p>
                  }
                    </div>

                    {ticket.status !== "Closed" &&
                <div className="add-response">
                        <h4>{tUi("ui.pages.tickets.addResponse_5e8ea60abf")}</h4>
                        <textarea
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder={tUi("ui.pages.tickets.typeYourResponse_2fc5ce1286")}
                    rows="3" />
                  
                        <button
                    className="submit-response-btn"
                    onClick={() => handleAddResponse(ticket.id)}
                    disabled={respondingTicketId === ticket.id || !responseMessage.trim()}>
                    
                          {respondingTicketId === ticket.id ? tUi("ui.pages.tickets.sending_feee595abe") : tUi("ui.pages.tickets.sendResponse_9963e23826")}
                        </button>
                      </div>
                }
                  </div>
              }
              </div>);

        })}
        </div>
      }
    </div>);

};

export default Tickets;
