import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import '../../styles/pages/admin/AdminTickets.css';

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

  useEffect(() => {
    fetchTickets();
    fetchEmployees();
    fetchPendingDeletes();
    // Mark tickets as viewed when page loads
    markAsViewed();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [statusFilter, assignedToFilter, tickets]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.ALL);
      setTickets(response.data || []);
      setFilteredTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch tickets');
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
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Filter by assigned employee
    if (assignedToFilter === 'unassigned') {
      filtered = filtered.filter(ticket => {
        // Check both employee_id and employee.id
        const employeeId = ticket.employee_id || (ticket.employee && ticket.employee.id);
        return !employeeId || employeeId === null || employeeId === undefined;
      });
    } else if (assignedToFilter !== 'all' && assignedToFilter !== '') {
      const employeeId = parseInt(assignedToFilter, 10);
      if (!isNaN(employeeId)) {
        filtered = filtered.filter(ticket => {
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
      toast.error('Please select an employee');
      return;
    }

    setAssigning(true);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ASSIGN, { ticket_id: selectedTicket.id });
      await http.patch(url, { employee_id: parseInt(selectedEmployeeId) });
      toast.success('Ticket assigned successfully');
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

  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      return;
    }

    setDeleting(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.DELETE, { ticket_id: ticketId });
      await http.delete(url);
      toast.success('Ticket deleted successfully');
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
    if (!window.confirm('Approve and delete this ticket?')) {
      return;
    }

    setApprovingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.APPROVE_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success('Delete request approved and ticket deleted');
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
      toast.success('Delete request rejected');
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
      <div className="admin-tickets-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-tickets-page">
      {pendingDeletes.length > 0 && (
        <div className="pending-deletes-section">
          <h2>Pending Delete Requests ({pendingDeletes.length})</h2>
          <div className="pending-deletes-list">
            {pendingDeletes.map((ticket) => (
              <div key={ticket.id} className="pending-delete-card">
                <div className="pending-delete-info">
                  <h4>{ticket.title}</h4>
                  <p>
                    Requested by: {ticket.employee?.first_name} {ticket.employee?.last_name} | 
                    Requested: {formatDate(ticket.delete_requested_at)}
                  </p>
                  <p className="ticket-description-preview">{ticket.description.substring(0, 100)}...</p>
                </div>
                <div className="pending-delete-actions">
                  <button
                    className="approve-delete-btn"
                    onClick={() => handleApproveDelete(ticket.id)}
                    disabled={approvingDelete === ticket.id}
                  >
                    {approvingDelete === ticket.id ? 'Approving...' : 'Approve & Delete'}
                  </button>
                  <button
                    className="reject-delete-btn"
                    onClick={() => handleRejectDelete(ticket.id)}
                    disabled={rejectingDelete === ticket.id}
                  >
                    {rejectingDelete === ticket.id ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-tickets-header">
        <h1>All Tickets</h1>
        <div className="filters-container">
          <div className="status-filter">
            <label>Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="assigned-filter">
            <label>Filter by Assigned To:</label>
            <select
              value={assignedToFilter}
              onChange={(e) => setAssignedToFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="empty-tickets">
          <p>No tickets found.</p>
        </div>
      ) : (
        <div className="tickets-list">
          {filteredTickets.map((ticket) => {
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
                    {ticket.employee && (
                      <span className="assigned-to">
                        Assigned to: {ticket.employee.first_name} {ticket.employee.last_name}
                      </span>
                    )}
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
                        <label>Assign to Employee:</label>
                        <select
                          value={ticket.employee_id || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignTicket({ ...ticket, employee_id: parseInt(e.target.value) });
                            }
                          }}
                        >
                          <option value="">Select Employee</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name} ({emp.email})
                            </option>
                          ))}
                        </select>
                      </div>

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

                    <div className="ticket-delete-section">
                      {ticket.pending_delete ? (
                        <div className="delete-pending">
                          <p>🗑️ Delete request pending approval</p>
                          <div className="pending-delete-admin-actions">
                            <button
                              className="approve-delete-btn"
                              onClick={() => handleApproveDelete(ticket.id)}
                              disabled={approvingDelete === ticket.id}
                            >
                              {approvingDelete === ticket.id ? 'Approving...' : 'Approve & Delete'}
                            </button>
                            <button
                              className="reject-delete-btn"
                              onClick={() => handleRejectDelete(ticket.id)}
                              disabled={rejectingDelete === ticket.id}
                            >
                              {rejectingDelete === ticket.id ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="delete-ticket-btn"
                          onClick={() => handleDeleteTicket(ticket.id)}
                          disabled={deleting === ticket.id}
                        >
                          {deleting === ticket.id ? 'Deleting...' : 'Delete Ticket'}
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

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Assign Ticket</h2>
            <p>Assign ticket "{selectedTicket?.title}" to an employee:</p>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="">Select Employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.email})
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button
                onClick={handleConfirmAssign}
                disabled={assigning || !selectedEmployeeId}
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTickets;
