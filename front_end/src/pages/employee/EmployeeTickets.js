import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/employee/EmployeeTickets.css';

const EmployeeTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [requestingDelete, setRequestingDelete] = useState(null);
  const confirm = useConfirm();

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
      toast.error(tUi("ui.pages.employee.employeeTickets.failedToFetchTickets_bd5457c4b4"));
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
      toast.success(tUi("ui.pages.employee.employeeTickets.ticketStatusUpdated_d066e0335b"));
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
      toast.error(tUi("ui.pages.employee.employeeTickets.pleaseEnterAMessage_1ce84d1798"));
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage });
      toast.success(tUi("ui.pages.employee.employeeTickets.responseAddedSuccessfully_cc736ef86a"));
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
    const confirmed = await confirm({
      title: tUi("ui.pages.employee.employeeTickets.requestTicketDeletion_846f6f9e50"),
      message: tUi("ui.pages.employee.employeeTickets.areYouSureYouWant_6779ce9fc7"),
      confirmText: tUi("ui.pages.employee.employeeTickets.requestDelete_2653b0b8d5"),
      cancelText: tUi("ui.pages.employee.employeeTickets.cancel_3786084ae4")
    });
    if (!confirmed) {
      return;
    }

    setRequestingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.REQUEST_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success(tUi("ui.pages.employee.employeeTickets.deleteRequestSubmittedWaitingFor_a6b63a282c"));
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
      </div>);

  }

  return (
    <div className="employee-tickets-page">
      <h1>{tUi("ui.pages.employee.employeeTickets.assignedTickets_1cd3b7a8a1")}</h1>

      {tickets.length === 0 ?
      <div className="empty-tickets">
          <p>{tUi("ui.pages.employee.employeeTickets.youDonTHaveAny_178d30ce0d")}</p>
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
                    <p className="ticket-meta">{tUi("ui.pages.employee.employeeTickets.customer_e8c953034b")}
                    {ticket.customer.first_name} {ticket.customer.last_name} ({ticket.customer.email}{tUi("ui.pages.employee.employeeTickets.created_182602e694")}
                    {formatDate(ticket.created_at)}
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

                {isExpanded &&
              <div className="ticket-details">
                    <div className="ticket-description">
                      <h4>{tUi("ui.pages.employee.employeeTickets.description_97f8368ed2")}</h4>
                      <p>{ticket.description}</p>
                    </div>

                    <div className="ticket-actions">
                      <div className="action-group">
                        <label>{tUi("ui.pages.employee.employeeTickets.updateStatus_77aa83ea21")}</label>
                        <select
                      value={ticket.status}
                      onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                      disabled={updatingStatus === ticket.id}>
                      
                          <option value="In Progress">{tUi("ui.pages.employee.employeeTickets.inProgress_490d0301a8")}</option>
                          <option value="Resolved">{tUi("ui.pages.employee.employeeTickets.resolved_3de5b02f98")}</option>
                          <option value="Closed">{tUi("ui.pages.employee.employeeTickets.closed_6430ba3304")}</option>
                        </select>
                      </div>
                    </div>

                    {/* Delivery Info (if ticket has related order delivery data) */}
                    {ticket.order_delivery &&
                <div className="ticket-delivery-info">
                        <h4>{tUi("ui.pages.employee.employeeTickets.deliveryInformation_a9b114e013")}</h4>
                        <div className="delivery-info-grid">
                          <div className="delivery-info-item">
                            <span className="delivery-info-label">{tUi("ui.pages.employee.employeeTickets.status_60e7fc540a")}</span>
                            <span className={`status-badge status-${ticket.order_delivery.status}`}>
                              {ticket.order_delivery.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {ticket.order_delivery.driver_name &&
                    <div className="delivery-info-item">
                              <span className="delivery-info-label">{tUi("ui.pages.employee.employeeTickets.driver_f9c1288fd2")}</span>
                              <span>{ticket.order_delivery.driver_name}</span>
                            </div>
                    }
                          {ticket.order_delivery.delivery_address &&
                    <div className="delivery-info-item">
                              <span className="delivery-info-label">{tUi("ui.pages.employee.employeeTickets.deliveryAddress_1643a9193e")}</span>
                              <span>{ticket.order_delivery.delivery_address}</span>
                            </div>
                    }
                        </div>
                        {ticket.order_delivery.issue_type &&
                  <div className="delivery-issue-alert">
                            <strong>{tUi("ui.pages.employee.employeeTickets.driverIssue_956e13688e")}</strong> {ticket.order_delivery.issue_type.replace(/_/g, ' ')}
                            {ticket.order_delivery.issue_description &&
                    <p>{ticket.order_delivery.issue_description}</p>
                    }
                          </div>
                  }
                      </div>
                }

                    <div className="ticket-responses">
                      <h4>{tUi("ui.pages.employee.employeeTickets.responses_a968a5d270")}{ticket.responses?.length || 0})</h4>
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

                  <p className="no-responses">{tUi("ui.pages.employee.employeeTickets.noResponsesYet_53f9543b02")}</p>
                  }
                    </div>

                    {ticket.status !== "Closed" &&
                <div className="add-response">
                        <h4>{tUi("ui.pages.employee.employeeTickets.addResponse_b32ceede19")}</h4>
                        <textarea
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder={tUi("ui.pages.employee.employeeTickets.typeYourResponse_d948fd64a0")}
                    rows="3" />
                  
                        <button
                    className="submit-response-btn"
                    onClick={() => handleAddResponse(ticket.id)}
                    disabled={respondingTicketId === ticket.id || !responseMessage.trim()}>
                    
                          {respondingTicketId === ticket.id ? tUi("ui.pages.employee.employeeTickets.sending_5850ee6d23") : tUi("ui.pages.employee.employeeTickets.sendResponse_bc411e0b13")}
                        </button>
                      </div>
                }

                    <div className="ticket-delete-section">
                      {ticket.pending_delete ?
                  <div className="delete-pending">
                          <p>{tUi("ui.pages.employee.employeeTickets.deleteRequestPendingAdminApproval_41491b306c")}</p>
                        </div> :

                  <button
                    className="delete-ticket-btn"
                    onClick={() => handleRequestDelete(ticket.id)}
                    disabled={requestingDelete === ticket.id}>
                    
                          {requestingDelete === ticket.id ? tUi("ui.pages.employee.employeeTickets.requesting_406aca964f") : tUi("ui.pages.employee.employeeTickets.requestDelete_eb9ed10efc")}
                        </button>
                  }
                    </div>
                  </div>
              }
              </div>);

        })}
        </div>
      }
    </div>);

};

export default EmployeeTickets;
