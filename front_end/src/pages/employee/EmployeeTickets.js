import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { useDialog } from '../../hooks/useDialog';
import API_BASE_URL from '../../config/api';
import '../../styles/pages/employee/EmployeeTickets.css';

const EmployeeTickets = () => {
  const { t } = useLanguage();
  const { showConfirm } = useDialog();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [requestingDelete, setRequestingDelete] = useState(null);
  const [editingResponseId, setEditingResponseId] = useState(null);
  const [editingMessage, setEditingMessage] = useState('');
  const [deletingResponseId, setDeletingResponseId] = useState(null);

  const { markAsViewed } = useUnreadTickets();
  const { user } = useAuth();

  // Default profile image
  const defaultProfileImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iMzUiIHI9IjE1IiBmaWxsPSIjOUI5QkE1Ii8+CjxwYXRoIGQ9Ik0yMCA3NUMxNSA3NSAxMCA4MCAxMCA4NVY5MEg5MEw5MCA4NUM5MCA4MCA4NSA3NSA4MCA3NUgyMFoiIGZpbGw9IiM5QjlCQTUiLz4KPC9zdmc+';

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage || (typeof profileImage === 'string' && profileImage.trim() === '')) {
      return defaultProfileImage;
    }
    if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
      return profileImage;
    }
    const normalizedPath = profileImage.startsWith('/') ? profileImage.slice(1) : profileImage;
    return `${API_BASE_URL}/${normalizedPath}`;
  };

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

  const handleEditResponse = (response) => {
    setEditingResponseId(response.id);
    setEditingMessage(response.message);
  };

  const handleCancelEdit = () => {
    setEditingResponseId(null);
    setEditingMessage('');
  };

  const handleUpdateResponse = async (ticketId, responseId) => {
    if (!editingMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      const url = buildUrl(TICKET_ENDPOINTS.UPDATE_RESPONSE, { ticket_id: ticketId, response_id: responseId });
      await http.patch(url, { message: editingMessage });
      toast.success('Response updated successfully');
      setEditingResponseId(null);
      setEditingMessage('');
      fetchTickets();
    } catch (error) {
      console.error('Error updating response:', error);
      toast.error(error.response?.data?.detail || 'Failed to update response');
    }
  };

  const handleDeleteResponse = async (ticketId, responseId) => {
    const confirmed = await showConfirm({
      message: 'Are you sure you want to delete this response?',
      confirmText: t('ok', 'OK'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) {
      return;
    }

    setDeletingResponseId(responseId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.DELETE_RESPONSE, { ticket_id: ticketId, response_id: responseId });
      await http.delete(url);
      toast.success('Response deleted successfully');
      fetchTickets();
    } catch (error) {
      console.error('Error deleting response:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete response');
    } finally {
      setDeletingResponseId(null);
    }
  };

  const handleRequestDelete = async (ticketId) => {
    const confirmed = await showConfirm({
      message: 'Are you sure you want to request deletion of this ticket? This requires admin approval.',
      confirmText: t('ok', 'OK'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) {
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
                        <label>{t('updateStatus', 'Update Status')}:</label>
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

                    <div className="ticket-responses">
                      <h4>{t('responses', 'Responses')} ({ticket.responses?.length || 0})</h4>
                      {ticket.responses && ticket.responses.length > 0 ? (
                        <div className="responses-list">
                          {ticket.responses.map((response) => {
                            const isOwnResponse = user && response.user.id === user.id;
                            const isEditing = editingResponseId === response.id;
                            return (
                              <div key={response.id} className="response-item">
                                <div className="response-header">
                                  <div className="response-author-info">
                                    <img
                                      src={getProfileImageUrl(response.user.profile_image)}
                                      alt={`${response.user.first_name} ${response.user.last_name}`}
                                      className="response-avatar"
                                      onError={(e) => {
                                        if (e.target.src !== defaultProfileImage) {
                                          e.target.src = defaultProfileImage;
                                        }
                                      }}
                                    />
                                    <span className="response-author">
                                      {response.user.first_name} {response.user.last_name}
                                    </span>
                                  </div>
                                  <div className="response-header-right">
                                    <span className="response-date">
                                      {formatDate(response.created_at)}
                                    </span>
                                    {isOwnResponse && !isEditing && (
                                      <div className="response-actions">
                                        <button
                                          className="edit-response-btn"
                                          onClick={() => handleEditResponse(response)}
                                          disabled={deletingResponseId === response.id}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          className="delete-response-btn"
                                          onClick={() => handleDeleteResponse(ticket.id, response.id)}
                                          disabled={deletingResponseId === response.id}
                                        >
                                          {deletingResponseId === response.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isEditing ? (
                                  <div className="edit-response-form">
                                    <textarea
                                      value={editingMessage}
                                      onChange={(e) => setEditingMessage(e.target.value)}
                                      rows="3"
                                    />
                                    <div className="edit-response-actions">
                                      <button
                                        className="save-edit-btn"
                                        onClick={() => handleUpdateResponse(ticket.id, response.id)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        className="cancel-edit-btn"
                                        onClick={handleCancelEdit}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="response-message">{response.message}</p>
                                )}
                              </div>
                            );
                          })}
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
