import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { useConfirm } from '../../hooks/useConfirm';
import SupportTicketChatModal from '../../components/SupportTicketChatModal';
import TicketUserAvatar from '../../components/TicketUserAvatar';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/pages/support-agent/SupportAgentTickets.css';

const SupportAgentTickets = () => {

  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [requestingDelete, setRequestingDelete] = useState(null);
  const [activeChatTicketId, setActiveChatTicketId] = useState(null);
  const confirm = useConfirm();

  const { markAsViewed } = useUnreadTickets();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('assigned');
  const [assignedTickets, setAssignedTickets] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [claimingTicketId, setClaimingTicketId] = useState(null);

  useEffect(() => {
    fetchAllTickets();
    // Mark tickets as viewed when page loads
    markAsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'assigned') {
      fetchTickets();
    } else {
      fetchUnassignedTickets();
    }
  }, [activeTab]);

  const fetchAllTickets = async () => {
    try {
      const [assigned, unassigned] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ASSIGNED),
        http.get(TICKET_ENDPOINTS.UNASSIGNED)
      ]);
      const assignedData = assigned.data || [];
      setAssignedTickets(assignedData.filter(t => t.status !== 'Resolved' && t.status !== 'Closed'));
      setCompletedTickets(assignedData.filter(t => t.status === 'Resolved' || t.status === 'Closed'));
      setUnassignedTickets(unassigned.data || []);
    } catch (error) {
      console.error('Error fetching all tickets:', error);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.ASSIGNED);
      const assignedData = response.data || [];
      setAssignedTickets(assignedData.filter(t => t.status !== 'Resolved' && t.status !== 'Closed'));
      setCompletedTickets(assignedData.filter(t => t.status === 'Resolved' || t.status === 'Closed'));
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error(tUi("ui.pages.support_agent.supportAgentTickets.failedToFetchTickets_bd5457c4b4"));
      setAssignedTickets([]);
      setCompletedTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedTickets = async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.UNASSIGNED);
      setUnassignedTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching unassigned tickets:', error);
      toast.error('Failed to fetch unassigned tickets');
      setUnassignedTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimTicket = async (ticketId) => {
    setClaimingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.CLAIM, { ticket_id: ticketId });
      await http.post(url);
      toast.success('Ticket claimed successfully!');
      fetchAllTickets();
    } catch (error) {
      console.error('Error claiming ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to claim ticket');
    } finally {
      setClaimingTicketId(null);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    setUpdatingStatus(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.UPDATE_STATUS, { ticket_id: ticketId });
      await http.patch(url, { status: newStatus });
      toast.success(tUi("ui.pages.support_agent.supportAgentTickets.ticketStatusUpdated_d066e0335b"));
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
      toast.error(tUi("ui.pages.support_agent.supportAgentTickets.pleaseEnterAMessage_1ce84d1798"));
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage, is_chat: false });
      toast.success(tUi("ui.pages.support_agent.supportAgentTickets.responseAddedSuccessfully_cc736ef86a"));
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
      title: "Delete Ticket",
      message: "Are you sure you want to delete this ticket? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (!confirmed) {
      return;
    }

    setRequestingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.REQUEST_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success("Ticket deleted successfully");
      fetchAllTickets();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete ticket');
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
      <div className="page-loading SupportAgent-tickets-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  const currentTickets = activeTab === 'assigned' 
    ? assignedTickets 
    : activeTab === 'completed' 
      ? completedTickets 
      : unassignedTickets;

  const supportTicketsTitle = 'Support Tickets';

  return (
    <div className="admin-page-shell SupportAgent-tickets-page">
      <PageHeader
        kicker={supportTicketsTitle}
        title={supportTicketsTitle}
        actions={
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
            onClick={() => setActiveTab('assigned')}
          >
            Active & Assigned ({assignedTickets.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'unassigned' ? 'active' : ''}`}
            onClick={() => setActiveTab('unassigned')}
          >
            Available for Claim ({unassignedTickets.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed History ({completedTickets.length})
          </button>
        </div>
        }
      />

      {currentTickets.length === 0 ?
      <div className="empty-tickets">
          <p>
            {activeTab === 'assigned' 
              ? tUi("ui.pages.support_agent.supportAgentTickets.youDonTHaveAny_178d30ce0d")
              : activeTab === 'completed'
                ? "No completed tickets yet."
                : "No unassigned tickets available."
            }
          </p>
        </div> :

      <div className="tickets-list">
          {currentTickets.map((ticket) => {
          const isExpanded = expandedTicketId === ticket.id;
          return (
            <div key={ticket.id} className="ticket-card">
                <div
                className="ticket-header clickable"
                onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}>
                
                  <div className="ticket-header-start">
                    <TicketUserAvatar user={ticket.customer} size={44} />
                    <div>
                      <h3>{ticket.title}</h3>
                      <p className="ticket-meta">{tUi("ui.pages.support_agent.supportAgentTickets.customer_e8c953034b")}
                      {ticket.customer.first_name} {ticket.customer.last_name} ({ticket.customer.email}{tUi("ui.pages.support_agent.supportAgentTickets.created_182602e694")}
                      {formatDate(ticket.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="ticket-header-right">
                    {activeTab === 'unassigned' && (
                      <button 
                        className="claim-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaimTicket(ticket.id);
                        }}
                        disabled={claimingTicketId === ticket.id}
                      >
                        {claimingTicketId === ticket.id ? 'Claiming...' : 'Claim Ticket'}
                      </button>
                    )}
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
                      <h4>{tUi("ui.pages.support_agent.supportAgentTickets.description_97f8368ed2")}</h4>
                      <p>{ticket.description}</p>
                    </div>

                    <div className="ticket-actions">
                      <div className="action-group">
                        <label>{tUi("ui.pages.support_agent.supportAgentTickets.updateStatus_77aa83ea21")}</label>
                        <select
                      value={ticket.status}
                      onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                      disabled={updatingStatus === ticket.id}>
                      
                          <option value="In Progress">{tUi("ui.pages.support_agent.supportAgentTickets.inProgress_490d0301a8")}</option>
                          <option value="Resolved">{tUi("ui.pages.support_agent.supportAgentTickets.resolved_3de5b02f98")}</option>
                          <option value="Closed">{tUi("ui.pages.support_agent.supportAgentTickets.closed_6430ba3304")}</option>
                        </select>
                      </div>
                    </div>

                    {/* Delivery Info (if ticket has related order delivery data) */}
                    {ticket.order_delivery &&
                <div className="ticket-delivery-info">
                        <h4>{tUi("ui.pages.support_agent.supportAgentTickets.deliveryInformation_a9b114e013")}</h4>
                        <div className="delivery-info-grid">
                          <div className="delivery-info-item">
                            <span className="delivery-info-label">{tUi("ui.pages.support_agent.supportAgentTickets.status_60e7fc540a")}</span>
                            <span className={`status-badge status-${ticket.order_delivery.status}`}>
                              {ticket.order_delivery.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {ticket.order_delivery.driver_name &&
                    <div className="delivery-info-item">
                              <span className="delivery-info-label">{tUi("ui.pages.support_agent.supportAgentTickets.driver_f9c1288fd2")}</span>
                              <span>{ticket.order_delivery.driver_name}</span>
                            </div>
                    }
                          {ticket.order_delivery.delivery_address &&
                    <div className="delivery-info-item">
                              <span className="delivery-info-label">{tUi("ui.pages.support_agent.supportAgentTickets.deliveryAddress_1643a9193e")}</span>
                              <span>{ticket.order_delivery.delivery_address}</span>
                            </div>
                    }
                        </div>
                        {ticket.order_delivery.issue_type &&
                  <div className="delivery-issue-alert">
                            <strong>{tUi("ui.pages.support_agent.supportAgentTickets.driverIssue_956e13688e")}</strong> {ticket.order_delivery.issue_type.replace(/_/g, ' ')}
                            {ticket.order_delivery.issue_description &&
                    <p>{ticket.order_delivery.issue_description}</p>
                    }
                          </div>
                  }
                      </div>
                }

                    <div className="ticket-responses">
                      <h4>{tUi("ui.pages.support_agent.supportAgentTickets.responses_a968a5d270")}{ticket.responses?.filter(r => !r.is_chat).length || 0})</h4>
                      {ticket.responses && ticket.responses.filter(r => !r.is_chat).length > 0 ?
                  <div className="responses-list">
                          {ticket.responses.filter(r => !r.is_chat).map((response) =>
                    <div key={response.id} className="response-item">
                              <TicketUserAvatar user={response.user} size={36} />
                              <div className="response-body">
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
                            </div>
                    )}
                        </div> :

                  <p className="no-responses">{tUi("ui.pages.support_agent.supportAgentTickets.noResponsesYet_53f9543b02")}</p>
                  }
                    </div>

                    {ticket.status !== "Closed" &&
                <div className="add-response">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0 }}>{tUi("ui.pages.support_agent.supportAgentTickets.addResponse_b32ceede19")}</h4>
                          <button 
                            className="btn-primary-action" 
                            style={{ backgroundColor: '#4f46e5', color: '#fff', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}
                            onClick={() => setActiveChatTicketId(ticket.id)}
                          >
                            💬 Open Live Chat
                          </button>
                        </div>
                        <textarea
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder={tUi("ui.pages.support_agent.supportAgentTickets.typeYourResponse_d948fd64a0")}
                    rows="3" />
                  
                        <button
                    className="submit-response-btn"
                    onClick={() => handleAddResponse(ticket.id)}
                    disabled={respondingTicketId === ticket.id || !responseMessage.trim()}>
                    
                          {respondingTicketId === ticket.id ? tUi("ui.pages.support_agent.supportAgentTickets.sending_5850ee6d23") : tUi("ui.pages.support_agent.supportAgentTickets.sendResponse_bc411e0b13")}
                        </button>
                      </div>
                }

                    {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                      <div className="ticket-delete-section">
                        <button
                          className="delete-ticket-btn"
                          onClick={() => handleRequestDelete(ticket.id)}
                          disabled={requestingDelete === ticket.id}>
                          {requestingDelete === ticket.id ? "Deleting..." : "Delete Ticket"}
                        </button>
                      </div>
                    )}
                  </div>
              }
              </div>);

        })}
        </div>
      }
      <SupportTicketChatModal
        isOpen={!!activeChatTicketId}
        onClose={() => setActiveChatTicketId(null)}
        ticketId={activeChatTicketId}
        currentUserId={currentUser?.id}
        userName={currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : ''}
        currentUserProfileImage={currentUser?.profile_image}
      />
    </div>);

};

export default SupportAgentTickets;
