import { tUi } from '../../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { useConfirm } from '../../hooks/useConfirm';
import SupportTicketChatModal from '../../components/SupportTicketChatModal';
import TicketUserAvatar from '../../components/TicketUserAvatar';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminTickets.css';

const TICKET_STATUS_LABEL_KEYS = {
  open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  in_progress: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6',
  resolved: 'ui.pages.admin.adminTickets.resolved_696eb2f977',
  closed: 'ui.pages.admin.adminTickets.closed_5b72d42e4a',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', labelKey: 'ui.pages.admin.adminTickets.all_89e88f8e70' },
  { value: 'Open', labelKey: 'ui.pages.tickets.statusOpen_a1b2c3d4e1' },
  { value: 'In Progress', labelKey: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6' },
  { value: 'Resolved', labelKey: 'ui.pages.admin.adminTickets.resolved_696eb2f977' },
  { value: 'Closed', labelKey: 'ui.pages.admin.adminTickets.closed_5b72d42e4a' },
];

const STATUS_UPDATE_OPTIONS = STATUS_FILTER_OPTIONS.filter((opt) => opt.value !== 'all');

const normalizeTicketStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const AdminTickets = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [supportAgents, setSupportAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedToFilter, setAssignedToFilter] = useState('all');
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedSupportAgentId, setSelectedSupportAgentId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [approvingDelete, setApprovingDelete] = useState(null);
  const [rejectingDelete, setRejectingDelete] = useState(null);
  const [activeChatTicketId, setActiveChatTicketId] = useState(null);
  const { markAsViewed } = useUnreadTickets();
  const { currentUser } = useAuth();
  const confirm = useConfirm();

  useEffect(() => {
    fetchTickets();
    fetchSupportAgents();
    fetchPendingDeletes();
    markAsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, assignedToFilter, tickets]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.ALL);
      setTickets(response.data || []);
      setFilteredTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error(tUi('ui.pages.admin.adminTickets.failedToFetchTickets_bbd8cd3f96'));
      setTickets([]);
      setFilteredTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportAgents = async () => {
    try {
      const response = await http.get(USER_ENDPOINTS.ALL, {
        params: { role: 'support_agent' },
      });
      setSupportAgents(response.data || []);
    } catch (error) {
      console.error('Error fetching support agents:', error);
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

    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (ticket) => normalizeTicketStatus(ticket.status) === normalizeTicketStatus(statusFilter)
      );
    }

    if (assignedToFilter === 'unassigned') {
      filtered = filtered.filter((ticket) => {
        const employeeId = ticket.employee_id || (ticket.employee && ticket.employee.id);
        return !employeeId;
      });
    } else if (assignedToFilter !== 'all' && assignedToFilter !== '') {
      const employeeId = parseInt(assignedToFilter, 10);
      if (!Number.isNaN(employeeId)) {
        filtered = filtered.filter((ticket) => {
          const ticketEmployeeId = ticket.employee_id || (ticket.employee && ticket.employee.id);
          if (ticketEmployeeId === null || ticketEmployeeId === undefined) return false;
          return Number(ticketEmployeeId) === employeeId;
        });
      }
    }

    setFilteredTickets(filtered);
  };

  const handleAssignTicket = (ticket) => {
    setSelectedTicket(ticket);
    setSelectedSupportAgentId(ticket.employee_id || '');
    setShowAssignModal(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedTicket || !selectedSupportAgentId) {
      toast.error(tUi('ui.pages.admin.adminTickets.pleaseSelectASupportAgent_6b43f647e4'));
      return;
    }

    setAssigning(true);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ASSIGN, { ticket_id: selectedTicket.id });
      await http.patch(url, { employee_id: parseInt(selectedSupportAgentId, 10) });
      toast.success(tUi('ui.pages.admin.adminTickets.ticketAssignedSuccessfully_e8f368d365'));
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
      toast.success(tUi('ui.pages.admin.adminTickets.ticketStatusUpdated_427b063fd8'));
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
      toast.error(tUi('ui.pages.admin.adminTickets.pleaseEnterAMessage_f6c65dd8c8'));
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage });
      toast.success(tUi('ui.pages.admin.adminTickets.responseAddedSuccessfully_5e9379f27d'));
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
      title: tUi('ui.pages.admin.adminTickets.deleteTicket_a55318815b'),
      message: tUi('ui.pages.admin.adminTickets.areYouSureYouWant_59d1414125'),
      confirmText: tUi('ui.pages.admin.adminTickets.delete_96591806d8'),
      cancelText: tUi('ui.pages.admin.adminTickets.cancel_b33ccf8e29'),
    });
    if (!confirmed) return;

    setDeleting(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.DELETE, { ticket_id: ticketId });
      await http.delete(url);
      toast.success(tUi('ui.pages.admin.adminTickets.ticketDeletedSuccessfully_37475331df'));
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
      title: tUi('ui.pages.admin.adminTickets.approveDeleteRequest_b023259325'),
      message: tUi('ui.pages.admin.adminTickets.approveAndDeleteThisTicket_93b6b71614'),
      confirmText: tUi('ui.pages.admin.adminTickets.approveDelete_4efd775c5f'),
      cancelText: tUi('ui.pages.admin.adminTickets.cancel_b33ccf8e29'),
    });
    if (!confirmed) return;

    setApprovingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.APPROVE_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success(tUi('ui.pages.admin.adminTickets.deleteRequestApprovedAndTicket_e02ef83db1'));
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
      toast.success(tUi('ui.pages.admin.adminTickets.deleteRequestRejected_4224b23e53'));
      fetchTickets();
      fetchPendingDeletes();
    } catch (error) {
      console.error('Error rejecting delete:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject delete');
    } finally {
      setRejectingDelete(null);
    }
  };

  const getStatusClass = (status) => {
    const normalized = normalizeTicketStatus(status);
    if (['open', 'in_progress', 'resolved', 'closed'].includes(normalized)) {
      return `adm-tkt-status adm-tkt-status--${normalized}`;
    }
    return 'adm-tkt-status adm-tkt-status--default';
  };

  const getStatusLabel = (status) => {
    const normalized = normalizeTicketStatus(status);
    const key = TICKET_STATUS_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return status || normalized.replace(/_/g, ' ');
  };

  const formatTicketMeta = (ticket) => {
    const customerName = `${ticket.customer?.first_name || ''} ${ticket.customer?.last_name || ''}`.trim();
    return tUi('ui.pages.admin.adminTickets.ticketMeta_9a8b7c6d5e', {
      value0: customerName,
      value1: ticket.customer?.email || '',
      value2: formatDate(ticket.created_at),
    });
  };

  const formatPendingMeta = (ticket) => {
    const agentName = ticket.employee
      ? `${ticket.employee.first_name} ${ticket.employee.last_name}`.trim()
      : '—';
    return tUi('ui.pages.admin.adminTickets.pendingRequestMeta_8b7c6d5e4f', {
      value0: agentName,
      value1: formatDate(ticket.delete_requested_at),
    });
  };

  const allTicketsTitle = tUi('ui.pages.admin.adminTickets.allTickets_10363e2701');
  const panelKicker = t('ui.sidebar.panel.admin', { defaultValue: 'Admin' });
  const ticketCountLabel =
    filteredTickets.length === 1
      ? tUi('ui.pages.admin.adminTickets.ticket_6f5e4d3c2b')
      : tUi('ui.pages.admin.adminTickets.tickets_5e4d3c2b1a');

  const toggleExpanded = (ticketId) => {
    setExpandedTicketId((prev) => (prev === ticketId ? null : ticketId));
  };

  const isResolvedOrClosed = (status) => {
    const normalized = normalizeTicketStatus(status);
    return normalized === 'resolved' || normalized === 'closed';
  };

  return (
    <div className="admin-page-shell adm-page adm-tkt-page">
      <PageHeader
        kicker={panelKicker}
        title={allTicketsTitle}
        subtitle={tUi('ui.pages.admin.adminTickets.subtitle_1a2b3c4d5j')}
        actions={
          <div className="adm-tkt-header-filter">
            <div className="adm-tkt-filter-row">
              <label className="adm-tkt-filter-label" htmlFor="adm-tkt-status-filter">
                {tUi('ui.pages.admin.adminTickets.filterByStatus_9e240a5b82')}
              </label>
              <select
                id="adm-tkt-status-filter"
                className="adm-tkt-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {tUi(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="adm-tkt-filter-row">
              <label className="adm-tkt-filter-label" htmlFor="adm-tkt-assigned-filter">
                {tUi('ui.pages.admin.adminTickets.filterByAssignedTo_d037356f6b')}
              </label>
              <select
                id="adm-tkt-assigned-filter"
                className="adm-tkt-select"
                value={assignedToFilter}
                onChange={(e) => setAssignedToFilter(e.target.value)}
              >
                <option value="all">{tUi('ui.pages.admin.adminTickets.all_89e88f8e70')}</option>
                <option value="unassigned">
                  {tUi('ui.pages.admin.adminTickets.unassigned_0796076cc1')}
                </option>
                {supportAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
            </div>
            <p className="adm-tkt-header-meta" aria-live="polite">
              <strong>{filteredTickets.length}</strong> {ticketCountLabel}
            </p>
          </div>
        }
      />

      {pendingDeletes.length > 0 && (
        <section className="adm-tkt-section adm-tkt-pending-section" aria-labelledby="adm-tkt-pending-title">
          <h2 id="adm-tkt-pending-title" className="adm-tkt-pending-title">
            {tUi('ui.pages.admin.adminTickets.pendingDeleteRequestsTitle_7d6c5b4a3f', {
              count: pendingDeletes.length,
            })}
          </h2>
          <div className="adm-tkt-pending-list">
            {pendingDeletes.map((ticket) => (
              <article key={ticket.id} className="adm-tkt-pending-card">
                <div className="adm-tkt-pending-copy">
                  <h4>{ticket.title}</h4>
                  <p>{formatPendingMeta(ticket)}</p>
                  <p className="adm-tkt-pending-preview">
                    {ticket.description?.length > 100
                      ? `${ticket.description.substring(0, 100)}…`
                      : ticket.description}
                  </p>
                </div>
                <div className="adm-tkt-pending-actions">
                  <button
                    type="button"
                    className="adm-tkt-btn adm-tkt-btn--approve"
                    onClick={() => handleApproveDelete(ticket.id)}
                    disabled={approvingDelete === ticket.id}
                  >
                    {approvingDelete === ticket.id
                      ? tUi('ui.pages.admin.adminTickets.approving_a1f7bf53e2')
                      : tUi('ui.pages.admin.adminTickets.approveDelete_4efd775c5f')}
                  </button>
                  <button
                    type="button"
                    className="adm-tkt-btn adm-tkt-btn--reject"
                    onClick={() => handleRejectDelete(ticket.id)}
                    disabled={rejectingDelete === ticket.id}
                  >
                    {rejectingDelete === ticket.id
                      ? tUi('ui.pages.admin.adminTickets.rejecting_75790791ce')
                      : tUi('ui.pages.admin.adminTickets.reject_6ed0dbd575')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="adm-tkt-section">
        {loading ? (
          <div className="adm-tkt-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="adm-tkt-empty">
            <p>{tUi('ui.pages.admin.adminTickets.noTicketsFound_563b84a408')}</p>
          </div>
        ) : (
          <div className="adm-tkt-list">
            {filteredTickets.map((ticket, index) => {
              const isExpanded = expandedTicketId === ticket.id;
              return (
                <motion.article
                  key={ticket.id}
                  className={`adm-tkt-card${isExpanded ? ' is-expanded' : ''}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div
                    className="adm-tkt-card-header"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpanded(ticket.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(ticket.id);
                      }
                    }}
                  >
                    <div className="adm-tkt-card-header-start">
                      <TicketUserAvatar user={ticket.customer} size={44} className="adm-tkt-card-avatar" />
                      <div>
                        <h3 className="adm-tkt-card-title">{ticket.title}</h3>
                        <p className="adm-tkt-card-meta">{formatTicketMeta(ticket)}</p>
                      </div>
                    </div>
                    <div className="adm-tkt-card-header-end">
                      <span className={getStatusClass(ticket.status)}>{getStatusLabel(ticket.status)}</span>
                      {ticket.employee && (
                        <span className="adm-tkt-assigned">
                          <TicketUserAvatar user={ticket.employee} size={28} className="adm-tkt-assigned-avatar" />
                          <span>
                            {tUi('ui.pages.admin.adminTickets.assignedTo_b40e00f557')}{' '}
                            {ticket.employee.first_name} {ticket.employee.last_name}
                          </span>
                        </span>
                      )}
                      <span className="adm-tkt-expand" aria-hidden>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      className="adm-tkt-detail"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="adm-tkt-detail-block">
                        <h4>{tUi('ui.pages.admin.adminTickets.description_eafb618058')}</h4>
                        <p>{ticket.description}</p>
                      </div>

                      <div className="adm-tkt-actions-panel">
                        <div className="adm-tkt-field">
                          <label htmlFor={`assign-${ticket.id}`}>
                            {tUi('ui.pages.admin.adminTickets.assignToSupportAgent_4abaeb3f1c')}
                          </label>
                          <select
                            id={`assign-${ticket.id}`}
                            className="adm-tkt-select"
                            value={ticket.employee_id || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignTicket({
                                  ...ticket,
                                  employee_id: parseInt(e.target.value, 10),
                                });
                              }
                            }}
                          >
                            <option value="">
                              {tUi('ui.pages.admin.adminTickets.selectSupportAgent_6385419f6d')}
                            </option>
                            {supportAgents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.first_name} {agent.last_name} ({agent.email})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="adm-tkt-field">
                          <label htmlFor={`status-${ticket.id}`}>
                            {tUi('ui.pages.admin.adminTickets.updateStatus_393c292f40')}
                          </label>
                          <select
                            id={`status-${ticket.id}`}
                            className="adm-tkt-select"
                            value={ticket.status}
                            onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                            disabled={updatingStatus === ticket.id}
                          >
                            {STATUS_UPDATE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {tUi(opt.labelKey)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="adm-tkt-detail-block">
                        <h4>
                          {tUi('ui.pages.admin.adminTickets.responses_2332bf585e')}
                          {ticket.responses?.filter((r) => !r.is_chat).length || 0})
                        </h4>
                        {ticket.responses && ticket.responses.filter((r) => !r.is_chat).length > 0 ? (
                          <div className="adm-tkt-responses">
                            {ticket.responses.filter((r) => !r.is_chat).map((response) => (
                              <div key={response.id} className="adm-tkt-response">
                                <TicketUserAvatar user={response.user} size={36} />
                                <div className="adm-tkt-response-body">
                                  <div className="adm-tkt-response-top">
                                    <span className="adm-tkt-response-author">
                                      {response.user.first_name} {response.user.last_name}
                                    </span>
                                    <span className="adm-tkt-response-date">
                                      {formatDate(response.created_at)}
                                    </span>
                                  </div>
                                  <p className="adm-tkt-response-msg">{response.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="adm-tkt-no-responses">
                            {tUi('ui.pages.admin.adminTickets.noResponsesYet_5773352778')}
                          </p>
                        )}
                      </div>

                      {!isResolvedOrClosed(ticket.status) && (
                        <div className="adm-tkt-response-form">
                          <div className="adm-tkt-response-form-head">
                            <h4>{tUi('ui.pages.admin.adminTickets.addResponse_aefbf99ded')}</h4>
                            <button
                              type="button"
                              className="adm-tkt-btn adm-tkt-btn--chat"
                              onClick={() => setActiveChatTicketId(ticket.id)}
                            >
                              {tUi('ui.pages.admin.adminTickets.joinLiveChat_4d3c2b1a0f')}
                            </button>
                          </div>
                          <textarea
                            className="adm-tkt-textarea"
                            value={responseMessage}
                            onChange={(e) => setResponseMessage(e.target.value)}
                            placeholder={tUi('ui.pages.admin.adminTickets.typeYourResponse_3b25ee5a90')}
                            rows={3}
                          />
                          <button
                            type="button"
                            className="adm-btn-primary"
                            onClick={() => handleAddResponse(ticket.id)}
                            disabled={respondingTicketId === ticket.id || !responseMessage.trim()}
                          >
                            {respondingTicketId === ticket.id
                              ? tUi('ui.pages.admin.adminTickets.sending_7c92c00154')
                              : tUi('ui.pages.admin.adminTickets.sendResponse_19ad5c5ebf')}
                          </button>
                        </div>
                      )}

                      <div className="adm-tkt-delete-zone">
                        {ticket.pending_delete ? (
                          <div className="adm-tkt-delete-pending">
                            <p>
                              {tUi('ui.pages.admin.adminTickets.deleteRequestPendingApproval_30beb02ce2')}
                            </p>
                            <div className="adm-tkt-delete-actions">
                              <button
                                type="button"
                                className="adm-tkt-btn adm-tkt-btn--approve"
                                onClick={() => handleApproveDelete(ticket.id)}
                                disabled={approvingDelete === ticket.id}
                              >
                                {approvingDelete === ticket.id
                                  ? tUi('ui.pages.admin.adminTickets.approving_a1f7bf53e2')
                                  : tUi('ui.pages.admin.adminTickets.approveDelete_4efd775c5f')}
                              </button>
                              <button
                                type="button"
                                className="adm-tkt-btn adm-tkt-btn--reject"
                                onClick={() => handleRejectDelete(ticket.id)}
                                disabled={rejectingDelete === ticket.id}
                              >
                                {rejectingDelete === ticket.id
                                  ? tUi('ui.pages.admin.adminTickets.rejecting_75790791ce')
                                  : tUi('ui.pages.admin.adminTickets.reject_6ed0dbd575')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="adm-tkt-btn adm-tkt-btn--delete"
                            onClick={() => handleDeleteTicket(ticket.id)}
                            disabled={deleting === ticket.id}
                          >
                            {deleting === ticket.id
                              ? tUi('ui.pages.admin.adminTickets.deleting_d794a0c704')
                              : tUi('ui.pages.admin.adminTickets.deleteTicket_737e638768')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      <AnimatePresence>
        {showAssignModal && selectedTicket && (
          <motion.div
            className="adm-tkt-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAssignModal(false)}
          >
            <motion.div
              className="adm-tkt-modal"
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{tUi('ui.pages.admin.adminTickets.assignTicket_a1cbabca83')}</h2>
              <p className="adm-tkt-modal-text">
                {tUi('ui.pages.admin.adminTickets.assignTicket_81adca4b2c')}
                {selectedTicket.title}
                {tUi('ui.pages.admin.adminTickets.toASupportAgent_7f18876815')}
              </p>
              <select
                className="adm-tkt-select"
                value={selectedSupportAgentId}
                onChange={(e) => setSelectedSupportAgentId(e.target.value)}
              >
                <option value="">
                  {tUi('ui.pages.admin.adminTickets.selectSupportAgent_6385419f6d')}
                </option>
                {supportAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name} ({agent.email})
                  </option>
                ))}
              </select>
              <div className="adm-tkt-modal-actions">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setShowAssignModal(false)}
                >
                  {tUi('ui.pages.admin.adminTickets.cancel_b33ccf8e29')}
                </button>
                <button
                  type="button"
                  className="adm-btn-primary"
                  onClick={handleConfirmAssign}
                  disabled={assigning || !selectedSupportAgentId}
                >
                  {assigning
                    ? tUi('ui.pages.admin.adminTickets.assigning_2d95e01d36')
                    : tUi('ui.pages.admin.adminTickets.assign_b71a20df8c')}
                </button>
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
        currentUserProfileImage={currentUser?.profile_image}
      />
    </div>
  );
};

export default AdminTickets;
