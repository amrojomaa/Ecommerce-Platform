import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import '../../styles/pages/employee/EmployeeTickets.css';

const EmployeeTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [requestingDelete, setRequestingDelete] = useState(null);

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
      const response = await http.get(TICKET_ENDPOINTS.ASSIGNED);
      setTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    setUpdatingStatus(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.UPDATE_STATUS, { ticket_id: ticketId });
      await http.patch(url, { status: newStatus });
      toast.success('Ticket status updated');
      fetchTickets();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleAddResponse = async (ticketId) => {
    if (!responseMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage });
      toast.success('Response added successfully');
      setResponseMessage('');
      fetchTickets();
    } catch (error) {
      console.error('Error adding response:', error);
      toast.error(error.response?.data?.detail || 'Failed to add response');
    } finally {
      setRespondingTicketId(null);
    }
  };

  const handleRequestDelete = async (ticketId) => {
    if (!window.confirm('Are you sure you want to request deletion of this ticket? This requires admin approval.')) {
      return;
    }

    setRequestingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.REQUEST_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success('Delete request submitted. Waiting for admin approval.');
      fetchTickets();
    } catch (error) {
      console.error('Error requesting delete:', error);
      toast.error(error.response?.data?.detail || 'Failed to request deletion');
    } finally {
      setRequestingDelete(null);
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
      <div className="employee-tickets-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="employee-tickets-page">
      <h1>Assigned Tickets</h1>

      {tickets.length === 0 ? (
        <div className="empty-tickets">
          <p>You don't have any assigned tickets yet.</p>
        </div>
      ) : (
        <div className="tickets-list">
          {tickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket.id;
            return (
              <div key={ticket.id} className="ticket-card">
                <div
                  className="ticket-header clickable"
                  onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                >
                  <div>
                    <h3>{ticket.title}</h3>
                    <p className="ticket-meta">
                      Customer: {ticket.customer.first_name} {ticket.customer.last_name} ({ticket.customer.email}) | 
                      Created: {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <div className="ticket-header-right">
                    <span className={`status-badge ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className="expand-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ticket-details">
                    <div className="ticket-description">
                      <h4>Description</h4>
                      <p>{ticket.description}</p>
                    </div>

                    <div className="ticket-actions">
                      <div className="action-group">
                        <label>Update Status:</label>
                        <select
                          value={ticket.status}
                          onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                          disabled={updatingStatus === ticket.id}
                        >
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    {/* Delivery Info (if ticket has related order delivery data) */}
                    {ticket.order_delivery && (
                      <div className="ticket-delivery-info">
                        <h4>🚚 Delivery Information</h4>
                        <div className="delivery-info-grid">
                          <div className="delivery-info-item">
                            <span className="delivery-info-label">Status:</span>
                            <span className={`status-badge status-${ticket.order_delivery.status}`}>
                              {ticket.order_delivery.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {ticket.order_delivery.driver_name && (
                            <div className="delivery-info-item">
                              <span className="delivery-info-label">Driver:</span>
                              <span>{ticket.order_delivery.driver_name}</span>
                            </div>
                          )}
                          {ticket.order_delivery.delivery_address && (
                            <div className="delivery-info-item">
                              <span className="delivery-info-label">Delivery Address:</span>
                              <span>{ticket.order_delivery.delivery_address}</span>
                            </div>
                          )}
                        </div>
                        {ticket.order_delivery.issue_type && (
                          <div className="delivery-issue-alert">
                            <strong>⚠️ Driver Issue:</strong> {ticket.order_delivery.issue_type.replace(/_/g, ' ')}
                            {ticket.order_delivery.issue_description && (
                              <p>{ticket.order_delivery.issue_description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="ticket-responses">
                      <h4>Responses ({ticket.responses?.length || 0})</h4>
                      {ticket.responses && ticket.responses.length > 0 ? (
                        <div className="responses-list">
                          {ticket.responses.map((response) => (
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
                          ))}
                        </div>
                      ) : (
                        <p className="no-responses">No responses yet.</p>
                      )}
                    </div>

                    {ticket.status !== 'Closed' && (
                      <div className="add-response">
                        <h4>Add Response</h4>
                        <textarea
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="Type your response..."
                          rows="3"
                        />
                        <button
                          className="submit-response-btn"
                          onClick={() => handleAddResponse(ticket.id)}
                          disabled={respondingTicketId === ticket.id || !responseMessage.trim()}
                        >
                          {respondingTicketId === ticket.id ? 'Sending...' : 'Send Response'}
                        </button>
                      </div>
                    )}

                    <div className="ticket-delete-section">
                      {ticket.pending_delete ? (
                        <div className="delete-pending">
                          <p>🗑️ Delete request pending admin approval</p>
                        </div>
                      ) : (
                        <button
                          className="delete-ticket-btn"
                          onClick={() => handleRequestDelete(ticket.id)}
                          disabled={requestingDelete === ticket.id}
                        >
                          {requestingDelete === ticket.id ? 'Requesting...' : 'Request Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeTickets;
