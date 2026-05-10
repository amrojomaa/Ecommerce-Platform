import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { useConfirm } from '../../hooks/useConfirm';
import '../../styles/pages/admin/AdminTickets.css';

const TICKET_STATUS_LABEL_KEYS = {
  in_progress: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6',
  resolved: 'ui.pages.admin.adminTickets.resolved_696eb2f977',
  closed: 'ui.pages.admin.adminTickets.closed_5b72d42e4a',
};

const normalizeTicketStatus = (status) => String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const AdminTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedToFilter, setAssignedToFilter] = useState('all');
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [approvingDelete, setApprovingDelete] = useState(null);
  const [rejectingDelete, setRejectingDelete] = useState(null);
  const { markAsViewed } = useUnreadTickets();
  const confirm = useConfirm();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchTickets();
    fetchEmployees();
    fetchPendingDeletes();
    // Mark tickets as viewed when page loads
    markAsViewed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterTickets();
  }, [statusFilter, assignedToFilter, tickets]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.ALL);
      setTickets(response.data || []);
      setFilteredTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error(tUi("ui.pages.admin.adminTickets.failedToFetchTickets_bbd8cd3f96"));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await http.get(USER_ENDPOINTS.ALL, {
        params: { role: 'employee' }
      });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPendingDeletes = async () => {
    try {
      const response = await http.get(TICKET_ENDPOINTS.PENDING_DELETES);
      setPendingDeletes(response.data || []);
    } catch (error) {
      console.error('Error fetching pending deletes:', error);
    }
  };

  const filterTickets = () => {
    let filtered = tickets;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (ticket) => normalizeTicketStatus(ticket.status) === normalizeTicketStatus(statusFilter)
      );
    }

    // Filter by assigned employee
    if (assignedToFilter === 'unassigned') {
      filtered = filtered.filter((ticket) => {
        // Check both employee_id and employee.id
        const employeeId = ticket.employee_id || (ticket.employee && ticket.employee.id);
        return !employeeId || employeeId === null || employeeId === undefined;
      });
    } else if (assignedToFilter !== 'all' && assignedToFilter !== '') {
      const employeeId = parseInt(assignedToFilter, 10);
      if (!isNaN(employeeId)) {
        filtered = filtered.filter((ticket) => {
          // Get employee ID from either employee_id field or employee object
          const ticketEmployeeId = ticket.employee_id || (ticket.employee && ticket.employee.id);

          if (ticketEmployeeId === null || ticketEmployeeId === undefined) {
            return false;
          }
          // Convert both to numbers for comparison
          return Number(ticketEmployeeId) === employeeId;
        });
      }
    }
    // If assignedToFilter is 'all', no filtering is applied (show all tickets)

    setFilteredTickets(filtered);
  };

  const handleAssignTicket = (ticket) => {
    setSelectedTicket(ticket);
    setSelectedEmployeeId(ticket.employee_id || '');
    setShowAssignModal(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedTicket || !selectedEmployeeId) {
      toast.error(tUi("ui.pages.admin.adminTickets.pleaseSelectAnEmployee_6b43f647e4"));
      return;
    }

    setAssigning(true);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ASSIGN, { ticket_id: selectedTicket.id });
      await http.patch(url, { employee_id: parseInt(selectedEmployeeId) });
      toast.success(tUi("ui.pages.admin.adminTickets.ticketAssignedSuccessfully_e8f368d365"));
      setShowAssignModal(false);
      fetchTickets();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to assign ticket');
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    setUpdatingStatus(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.UPDATE_STATUS, { ticket_id: ticketId });
      await http.patch(url, { status: newStatus });
      toast.success(tUi("ui.pages.admin.adminTickets.ticketStatusUpdated_427b063fd8"));
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
      toast.error(tUi("ui.pages.admin.adminTickets.pleaseEnterAMessage_f6c65dd8c8"));
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage });
      toast.success(tUi("ui.pages.admin.adminTickets.responseAddedSuccessfully_5e9379f27d"));
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
      title: tUi("ui.pages.admin.adminTickets.deleteTicket_a55318815b"),
      message: tUi("ui.pages.admin.adminTickets.areYouSureYouWant_59d1414125"),
      confirmText: tUi("ui.pages.admin.adminTickets.delete_96591806d8"),
      cancelText: tUi("ui.pages.admin.adminTickets.cancel_b33ccf8e29")
    });
    if (!confirmed) {
      return;
    }

    setDeleting(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.DELETE, { ticket_id: ticketId });
      await http.delete(url);
      toast.success(tUi("ui.pages.admin.adminTickets.ticketDeletedSuccessfully_37475331df"));
      fetchTickets();
      fetchPendingDeletes();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete ticket');
    } finally {
      setDeleting(null);
    }
  };

  const handleApproveDelete = async (ticketId) => {
    const confirmed = await confirm({
      title: tUi("ui.pages.admin.adminTickets.approveDeleteRequest_b023259325"),
      message: tUi("ui.pages.admin.adminTickets.approveAndDeleteThisTicket_93b6b71614"),
      confirmText: tUi("ui.pages.admin.adminTickets.approveDelete_4efd775c5f"),
      cancelText: tUi("ui.pages.admin.adminTickets.cancel_b33ccf8e29")
    });
    if (!confirmed) {
      return;
    }

    setApprovingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.APPROVE_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success(tUi("ui.pages.admin.adminTickets.deleteRequestApprovedAndTicket_e02ef83db1"));
      fetchTickets();
      fetchPendingDeletes();
    } catch (error) {
      console.error('Error approving delete:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve delete');
    } finally {
      setApprovingDelete(null);
    }
  };

  const handleRejectDelete = async (ticketId) => {
    setRejectingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.REJECT_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success(tUi("ui.pages.admin.adminTickets.deleteRequestRejected_4224b23e53"));
      fetchTickets();
      fetchPendingDeletes();
    } catch (error) {
      console.error('Error rejecting delete:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject delete');
    } finally {
      setRejectingDelete(null);
    }
  };

  const getStatusColor = (status) => {
    switch (normalizeTicketStatus(status)) {
      case 'in_progress':
        return 'status-in-progress';
      case 'resolved':
        return 'status-resolved';
      case 'closed':
        return 'status-closed';
      default:
        return 'status-default';
    }
  };

  const getStatusLabel = (status) => {
    const normalized = normalizeTicketStatus(status);
    const key = TICKET_STATUS_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return status || normalized.replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="admin-tickets-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  return (
    <div className="admin-tickets-page">
      {pendingDeletes.length > 0 &&
      <div className="pending-deletes-section">
          <h2>{tUi("ui.pages.admin.adminTickets.pendingDeleteRequests_649a08b553")}{pendingDeletes.length})</h2>
          <div className="pending-deletes-list">
            {pendingDeletes.map((ticket) =>
          <div key={ticket.id} className="pending-delete-card">
                <div className="pending-delete-info">
                  <h4>{ticket.title}</h4>
                  <p>{tUi("ui.pages.admin.adminTickets.requestedBy_b55aa2d519")}
                {ticket.employee?.first_name} {ticket.employee?.last_name}{tUi("ui.pages.admin.adminTickets.requested_53af939820")}
                {formatDate(ticket.delete_requested_at)}
                  </p>
                  <p className="ticket-description-preview">{ticket.description.substring(0, 100)}...</p>
                </div>
                <div className="pending-delete-actions">
                  <button
                className="approve-delete-btn"
                onClick={() => handleApproveDelete(ticket.id)}
                disabled={approvingDelete === ticket.id}>
                
                    {approvingDelete === ticket.id ? tUi("ui.pages.admin.adminTickets.approving_a1f7bf53e2") : tUi("ui.pages.admin.adminTickets.approveDelete_4efd775c5f")}
                  </button>
                  <button
                className="reject-delete-btn"
                onClick={() => handleRejectDelete(ticket.id)}
                disabled={rejectingDelete === ticket.id}>
                
                    {rejectingDelete === ticket.id ? tUi("ui.pages.admin.adminTickets.rejecting_75790791ce") : tUi("ui.pages.admin.adminTickets.reject_6ed0dbd575")}
                  </button>
                </div>
              </div>
          )}
          </div>
        </div>
      }

      <div className="admin-tickets-header">
        <h1>{tUi("ui.pages.admin.adminTickets.allTickets_10363e2701")}</h1>
        <div className="filters-container">
          <div className="status-filter">
            <label>{tUi("ui.pages.admin.adminTickets.filterByStatus_9e240a5b82")}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>
              
              <option value="all">{tUi("ui.pages.admin.adminTickets.all_89e88f8e70")}</option>
              <option value="In Progress">{tUi("ui.pages.admin.adminTickets.inProgress_18e19f0fd6")}</option>
              <option value="Resolved">{tUi("ui.pages.admin.adminTickets.resolved_696eb2f977")}</option>
              <option value="Closed">{tUi("ui.pages.admin.adminTickets.closed_5b72d42e4a")}</option>
            </select>
          </div>
          <div className="assigned-filter">
            <label>{tUi("ui.pages.admin.adminTickets.filterByAssignedTo_d037356f6b")}</label>
            <select
              value={assignedToFilter}
              onChange={(e) => setAssignedToFilter(e.target.value)}>
              
              <option value="all">{tUi("ui.pages.admin.adminTickets.all_89e88f8e70")}</option>
              <option value="unassigned">{tUi("ui.pages.admin.adminTickets.unassigned_0796076cc1")}</option>
              {employees.map((emp) =>
              <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      {filteredTickets.length === 0 ?
      <div className="empty-tickets">
          <p>{tUi("ui.pages.admin.adminTickets.noTicketsFound_563b84a408")}</p>
        </div> :

      <div className="tickets-list">
          {filteredTickets.map((ticket) => {
          const isExpanded = expandedTicketId === ticket.id;
          return (
            <div key={ticket.id} className="ticket-card">
                <div
                className="ticket-header clickable"
                onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}>
                
                  <div>
                    <h3>{ticket.title}</h3>
                    <p className="ticket-meta">{tUi("ui.pages.admin.adminTickets.customer_b9f6549afe")}
                    {ticket.customer.first_name} {ticket.customer.last_name} ({ticket.customer.email}{tUi("ui.pages.admin.adminTickets.created_f71b3b1a93")}
                    {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <div className="ticket-header-right">
                    <span className={`status-badge ${getStatusColor(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                    {ticket.employee &&
                  <span className="assigned-to">{tUi("ui.pages.admin.adminTickets.assignedTo_b40e00f557")}
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
                      <h4>{tUi("ui.pages.admin.adminTickets.description_eafb618058")}</h4>
                      <p>{ticket.description}</p>
                    </div>

                    <div className="ticket-actions">
                      <div className="action-group">
                        <label>{tUi("ui.pages.admin.adminTickets.assignToEmployee_4abaeb3f1c")}</label>
                        <select
                      value={ticket.employee_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignTicket({ ...ticket, employee_id: parseInt(e.target.value) });
                        }
                      }}>
                      
                          <option value="">{tUi("ui.pages.admin.adminTickets.selectEmployee_6385419f6d")}</option>
                          {employees.map((emp) =>
                      <option key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name} ({emp.email})
                            </option>
                      )}
                        </select>
                      </div>

                      <div className="action-group">
                        <label>{tUi("ui.pages.admin.adminTickets.updateStatus_393c292f40")}</label>
                        <select
                      value={ticket.status}
                      onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                      disabled={updatingStatus === ticket.id}>
                      
                          <option value="In Progress">{tUi("ui.pages.admin.adminTickets.inProgress_18e19f0fd6")}</option>
                          <option value="Resolved">{tUi("ui.pages.admin.adminTickets.resolved_696eb2f977")}</option>
                          <option value="Closed">{tUi("ui.pages.admin.adminTickets.closed_5b72d42e4a")}</option>
                        </select>
                      </div>
                    </div>

                    <div className="ticket-responses">
                      <h4>{tUi("ui.pages.admin.adminTickets.responses_2332bf585e")}{ticket.responses?.length || 0})</h4>
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

                  <p className="no-responses">{tUi("ui.pages.admin.adminTickets.noResponsesYet_5773352778")}</p>
                  }
                    </div>

                    <div className="add-response">
                      <h4>{tUi("ui.pages.admin.adminTickets.addResponse_aefbf99ded")}</h4>
                      <textarea
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder={tUi("ui.pages.admin.adminTickets.typeYourResponse_3b25ee5a90")}
                    rows="3" />
                  
                      <button
                    className="submit-response-btn"
                    onClick={() => handleAddResponse(ticket.id)}
                    disabled={respondingTicketId === ticket.id || !responseMessage.trim()}>
                    
                        {respondingTicketId === ticket.id ? tUi("ui.pages.admin.adminTickets.sending_7c92c00154") : tUi("ui.pages.admin.adminTickets.sendResponse_19ad5c5ebf")}
                      </button>
                    </div>

                    <div className="ticket-delete-section">
                      {ticket.pending_delete ?
                  <div className="delete-pending">
                          <p>{tUi("ui.pages.admin.adminTickets.deleteRequestPendingApproval_30beb02ce2")}</p>
                          <div className="pending-delete-admin-actions">
                            <button
                        className="approve-delete-btn"
                        onClick={() => handleApproveDelete(ticket.id)}
                        disabled={approvingDelete === ticket.id}>
                        
                              {approvingDelete === ticket.id ? tUi("ui.pages.admin.adminTickets.approving_a1f7bf53e2") : tUi("ui.pages.admin.adminTickets.approveDelete_4efd775c5f")}
                            </button>
                            <button
                        className="reject-delete-btn"
                        onClick={() => handleRejectDelete(ticket.id)}
                        disabled={rejectingDelete === ticket.id}>
                        
                              {rejectingDelete === ticket.id ? tUi("ui.pages.admin.adminTickets.rejecting_75790791ce") : tUi("ui.pages.admin.adminTickets.reject_6ed0dbd575")}
                            </button>
                          </div>
                        </div> :

                  <button
                    className="delete-ticket-btn"
                    onClick={() => handleDeleteTicket(ticket.id)}
                    disabled={deleting === ticket.id}>
                    
                          {deleting === ticket.id ? tUi("ui.pages.admin.adminTickets.deleting_d794a0c704") : tUi("ui.pages.admin.adminTickets.deleteTicket_737e638768")}
                        </button>
                  }
                    </div>
                  </div>
              }
              </div>);

        })}
        </div>
      }

      {showAssignModal &&
      <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{tUi("ui.pages.admin.adminTickets.assignTicket_a1cbabca83")}</h2>
            <p>{tUi("ui.pages.admin.adminTickets.assignTicket_81adca4b2c")}{selectedTicket?.title}{tUi("ui.pages.admin.adminTickets.toAnEmployee_7f18876815")}</p>
            <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}>
            
              <option value="">{tUi("ui.pages.admin.adminTickets.selectEmployee_6385419f6d")}</option>
              {employees.map((emp) =>
            <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.email})
                </option>
            )}
            </select>
            <div className="modal-actions">
              <button onClick={() => setShowAssignModal(false)}>{tUi("ui.pages.admin.adminTickets.cancel_b33ccf8e29")}</button>
              <button
              onClick={handleConfirmAssign}
              disabled={assigning || !selectedEmployeeId}>
              
                {assigning ? tUi("ui.pages.admin.adminTickets.assigning_2d95e01d36") : tUi("ui.pages.admin.adminTickets.assign_b71a20df8c")}
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default AdminTickets;
