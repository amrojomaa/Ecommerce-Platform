import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { tUi } from '../../i18n/uiText';
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
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/admin/AdminTickets.css';
import '../../styles/pages/support-manager/SupportPanel.css';
import '../../styles/pages/support-agent/SupportAgentPanel.css';

const TICKET_STATUS_LABEL_KEYS = {
  open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  in_progress: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6',
  resolved: 'ui.pages.admin.adminTickets.resolved_696eb2f977',
  closed: 'ui.pages.admin.adminTickets.closed_5b72d42e4a',
};

const STATUS_UPDATE_OPTIONS = [
  { value: 'In Progress', labelKey: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6' },
  { value: 'Resolved', labelKey: 'ui.pages.admin.adminTickets.resolved_696eb2f977' },
  { value: 'Closed', labelKey: 'ui.pages.admin.adminTickets.closed_5b72d42e4a' },
];

const normalizeTicketStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const TICKET_TABS = ['assigned', 'unassigned', 'completed'];

const parseTicketTab = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return TICKET_TABS.includes(normalized) ? normalized : 'assigned';
};

const SupportAgentTickets = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => parseTicketTab(searchParams.get('tab')), [searchParams]);
  const panelKicker = t('ui.sidebar.panel.support_agent');
  const confirm = useConfirm();
  const { markAsViewed } = useUnreadTickets();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [requestingDelete, setRequestingDelete] = useState(null);
  const [activeChatTicketId, setActiveChatTicketId] = useState(null);
  const [assignedTickets, setAssignedTickets] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [claimingTicketId, setClaimingTicketId] = useState(null);

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
    return t('ui.pages.support_agent.tickets.ticketMeta', {
      value0: customerName,
      value1: ticket.customer?.email || '',
      value2: formatDate(ticket.created_at),
    });
  };

  const fetchAllTickets = useCallback(async () => {
    try {
      const [assigned, unassigned] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ASSIGNED),
        http.get(TICKET_ENDPOINTS.UNASSIGNED),
      ]);
      const assignedData = assigned.data || [];
      setAssignedTickets(assignedData.filter((ticket) => ticket.status !== 'Resolved' && ticket.status !== 'Closed'));
      setCompletedTickets(assignedData.filter((ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed'));
      setUnassignedTickets(unassigned.data || []);
    } catch (error) {
      console.error('Error fetching all tickets:', error);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.ASSIGNED);
      const assignedData = response.data || [];
      setAssignedTickets(assignedData.filter((ticket) => ticket.status !== 'Resolved' && ticket.status !== 'Closed'));
      setCompletedTickets(assignedData.filter((ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed'));
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error(tUi('ui.pages.support_agent.supportAgentTickets.failedToFetchTickets_bd5457c4b4'));
      setAssignedTickets([]);
      setCompletedTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnassignedTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.UNASSIGNED);
      setUnassignedTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching unassigned tickets:', error);
      toast.error(t('ui.pages.support_agent.tickets.failedToFetchUnassigned'));
      setUnassignedTickets([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleTabChange = (tab) => {
    if (tab === 'assigned') {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab }, { replace: true });
  };

  useEffect(() => {
    fetchAllTickets();
    markAsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'unassigned') {
      fetchUnassignedTickets();
    } else {
      fetchTickets();
    }
  }, [activeTab, fetchTickets, fetchUnassignedTickets]);

  const handleClaimTicket = async (ticketId) => {
    setClaimingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.CLAIM, { ticket_id: ticketId });
      await http.post(url);
      toast.success(t('ui.pages.support_agent.tickets.ticketClaimed'));
      fetchAllTickets();
      if (activeTab === 'unassigned') {
        fetchUnassignedTickets();
      } else {
        fetchTickets();
      }
    } catch (error) {
      console.error('Error claiming ticket:', error);
      toast.error(error.response?.data?.detail || t('ui.pages.support_agent.tickets.failedToClaim'));
    } finally {
      setClaimingTicketId(null);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    setUpdatingStatus(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.UPDATE_STATUS, { ticket_id: ticketId });
      await http.patch(url, { status: newStatus });
      toast.success(tUi('ui.pages.support_agent.supportAgentTickets.ticketStatusUpdated_d066e0335b'));
      fetchAllTickets();
      fetchTickets();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.response?.data?.detail || t('ui.pages.support_agent.tickets.failedToUpdateStatus'));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleAddResponse = async (ticketId) => {
    if (!responseMessage.trim()) {
      toast.error(tUi('ui.pages.support_agent.supportAgentTickets.pleaseEnterAMessage_1ce84d1798'));
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage, is_chat: false });
      toast.success(tUi('ui.pages.support_agent.supportAgentTickets.responseAddedSuccessfully_cc736ef86a'));
      setResponseMessage('');
      fetchTickets();
    } catch (error) {
      console.error('Error adding response:', error);
      toast.error(error.response?.data?.detail || t('ui.pages.support_agent.tickets.failedToAddResponse'));
    } finally {
      setRespondingTicketId(null);
    }
  };

  const handleRequestDelete = async (ticketId) => {
    const confirmed = await confirm({
      title: t('ui.pages.support_agent.tickets.deleteTicket'),
      message: t('ui.pages.support_agent.tickets.deleteConfirm'),
      confirmText: t('ui.pages.support_agent.tickets.deleteTicket'),
      cancelText: tUi('ui.pages.support_agent.supportAgentTickets.cancel_3786084ae4'),
    });
    if (!confirmed) return;

    setRequestingDelete(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.REQUEST_DELETE, { ticket_id: ticketId });
      await http.post(url);
      toast.success(t('ui.pages.support_agent.tickets.ticketDeleted'));
      fetchAllTickets();
      fetchTickets();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error(error.response?.data?.detail || t('ui.pages.support_agent.tickets.failedToDelete'));
    } finally {
      setRequestingDelete(null);
    }
  };

  const toggleExpanded = (ticketId) => {
    setExpandedTicketId((prev) => (prev === ticketId ? null : ticketId));
  };

  const isResolvedOrClosed = (status) => {
    const normalized = normalizeTicketStatus(status);
    return normalized === 'resolved' || normalized === 'closed';
  };

  const currentTickets =
    activeTab === 'assigned' ? assignedTickets : activeTab === 'completed' ? completedTickets : unassignedTickets;

  const emptyMessage =
    activeTab === 'assigned'
      ? tUi('ui.pages.support_agent.supportAgentTickets.youDonTHaveAny_178d30ce0d')
      : activeTab === 'completed'
        ? t('ui.pages.support_agent.tickets.noCompleted')
        : t('ui.pages.support_agent.tickets.noUnassigned');

  const tabs = [
    { id: 'assigned', label: t('ui.pages.support_agent.tickets.tabAssigned'), count: assignedTickets.length },
    { id: 'unassigned', label: t('ui.pages.support_agent.tickets.tabUnassigned'), count: unassignedTickets.length },
    { id: 'completed', label: t('ui.pages.support_agent.tickets.tabCompleted'), count: completedTickets.length },
  ];

  return (
    <div className="admin-page-shell adm-page adm-tkt-page spa-page spa-tkt-page">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.support_agent.tickets.title')}
        subtitle={t('ui.pages.support_agent.tickets.subtitle')}
        actions={
          <div className="spa-header-tabs" role="tablist" aria-label={t('ui.pages.support_agent.tickets.title')}>
            <div className="spm-pill-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`spm-pill-tab${activeTab === tab.id ? ' is-active' : ''}`}
                  aria-selected={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                  <span className="spm-pill-tab-count">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>
        }
      />

      <section className="adm-tkt-section">
        {loading ? (
          <div className="adm-tkt-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : currentTickets.length === 0 ? (
          <div className="adm-tkt-empty">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="adm-tkt-list">
            {currentTickets.map((ticket, index) => {
              const isExpanded = expandedTicketId === ticket.id;
              const publicResponses = ticket.responses?.filter((response) => !response.is_chat) || [];

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
                      {activeTab === 'unassigned' && (
                        <button
                          type="button"
                          className="adm-tkt-btn adm-tkt-btn--claim"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClaimTicket(ticket.id);
                          }}
                          disabled={claimingTicketId === ticket.id}
                        >
                          {claimingTicketId === ticket.id
                            ? t('ui.pages.support_agent.tickets.claiming')
                            : t('ui.pages.support_agent.tickets.claimTicket')}
                        </button>
                      )}
                      <span className={getStatusClass(ticket.status)}>{getStatusLabel(ticket.status)}</span>
                      <span className="adm-tkt-expand" aria-hidden>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="adm-tkt-detail" onClick={(e) => e.stopPropagation()}>
                      <div className="adm-tkt-detail-block">
                        <h4>{tUi('ui.pages.support_agent.supportAgentTickets.description_97f8368ed2')}</h4>
                        <p>{ticket.description}</p>
                      </div>

                      {activeTab !== 'unassigned' && (
                        <div className="adm-tkt-actions-panel">
                          <div className="adm-tkt-field">
                            <label htmlFor={`status-${ticket.id}`}>
                              {tUi('ui.pages.support_agent.supportAgentTickets.updateStatus_77aa83ea21')}
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
                      )}

                      {ticket.order_delivery && (
                        <div className="adm-tkt-detail-block adm-tkt-delivery">
                          <h4>{tUi('ui.pages.support_agent.supportAgentTickets.deliveryInformation_a9b114e013')}</h4>
                          <div className="adm-tkt-delivery-grid">
                            <div>
                              <span className="adm-tkt-delivery-label">
                                {tUi('ui.pages.support_agent.supportAgentTickets.status_60e7fc540a')}
                              </span>
                              <span className={`adm-tkt-status adm-tkt-status--default`}>
                                {ticket.order_delivery.status?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {ticket.order_delivery.driver_name && (
                              <div>
                                <span className="adm-tkt-delivery-label">
                                  {tUi('ui.pages.support_agent.supportAgentTickets.driver_f9c1288fd2')}
                                </span>
                                <span>{ticket.order_delivery.driver_name}</span>
                              </div>
                            )}
                            {ticket.order_delivery.delivery_address && (
                              <div>
                                <span className="adm-tkt-delivery-label">
                                  {tUi('ui.pages.support_agent.supportAgentTickets.deliveryAddress_1643a9193e')}
                                </span>
                                <span>{ticket.order_delivery.delivery_address}</span>
                              </div>
                            )}
                          </div>
                          {ticket.order_delivery.issue_type && (
                            <div className="adm-tkt-delivery-alert">
                              <strong>{tUi('ui.pages.support_agent.supportAgentTickets.driverIssue_956e13688e')}</strong>{' '}
                              {ticket.order_delivery.issue_type.replace(/_/g, ' ')}
                              {ticket.order_delivery.issue_description && (
                                <p>{ticket.order_delivery.issue_description}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="adm-tkt-detail-block">
                        <h4>
                          {tUi('ui.pages.support_agent.supportAgentTickets.responses_a968a5d270')}
                          {publicResponses.length})
                        </h4>
                        {publicResponses.length > 0 ? (
                          <div className="adm-tkt-responses">
                            {publicResponses.map((response) => (
                              <div key={response.id} className="adm-tkt-response">
                                <TicketUserAvatar user={response.user} size={36} />
                                <div className="adm-tkt-response-body">
                                  <div className="adm-tkt-response-top">
                                    <span className="adm-tkt-response-author">
                                      {response.user.first_name} {response.user.last_name}
                                    </span>
                                    <span className="adm-tkt-response-date">{formatDate(response.created_at)}</span>
                                  </div>
                                  <p className="adm-tkt-response-msg">{response.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="adm-tkt-no-responses">
                            {tUi('ui.pages.support_agent.supportAgentTickets.noResponsesYet_53f9543b02')}
                          </p>
                        )}
                      </div>

                      {!isResolvedOrClosed(ticket.status) && activeTab !== 'unassigned' && (
                        <div className="adm-tkt-response-form">
                          <div className="adm-tkt-response-form-head">
                            <h4>{tUi('ui.pages.support_agent.supportAgentTickets.addResponse_b32ceede19')}</h4>
                            <button
                              type="button"
                              className="adm-tkt-btn adm-tkt-btn--chat"
                              onClick={() => setActiveChatTicketId(ticket.id)}
                            >
                              {t('ui.pages.support_agent.tickets.openLiveChat')}
                            </button>
                          </div>
                          <textarea
                            className="adm-tkt-textarea"
                            value={responseMessage}
                            onChange={(e) => setResponseMessage(e.target.value)}
                            placeholder={tUi('ui.pages.support_agent.supportAgentTickets.typeYourResponse_d948fd64a0')}
                            rows={3}
                          />
                          <button
                            type="button"
                            className="adm-btn-primary"
                            onClick={() => handleAddResponse(ticket.id)}
                            disabled={respondingTicketId === ticket.id || !responseMessage.trim()}
                          >
                            {respondingTicketId === ticket.id
                              ? tUi('ui.pages.support_agent.supportAgentTickets.sending_5850ee6d23')
                              : tUi('ui.pages.support_agent.supportAgentTickets.sendResponse_bc411e0b13')}
                          </button>
                        </div>
                      )}

                      {activeTab !== 'unassigned' &&
                        !isResolvedOrClosed(ticket.status) &&
                        !ticket.pending_delete && (
                          <div className="adm-tkt-delete-zone">
                            <button
                              type="button"
                              className="adm-tkt-btn adm-tkt-btn--delete"
                              onClick={() => handleRequestDelete(ticket.id)}
                              disabled={requestingDelete === ticket.id}
                            >
                              {requestingDelete === ticket.id
                                ? t('ui.pages.support_agent.tickets.deleting')
                                : t('ui.pages.support_agent.tickets.deleteTicket')}
                            </button>
                          </div>
                        )}

                      {ticket.pending_delete && (
                        <div className="adm-tkt-delete-pending">
                          <p>{tUi('ui.pages.support_agent.supportAgentTickets.deleteRequestPendingAdminApproval_41491b306c')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

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

export default SupportAgentTickets;
