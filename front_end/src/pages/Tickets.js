import { tUi } from '../i18n/uiText';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiX, FiSend, FiMessageCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import http from '../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import { useConfirm } from '../hooks/useConfirm';
import SupportTicketChatModal from '../components/SupportTicketChatModal';
import TicketUserAvatar from '../components/TicketUserAvatar';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/PageHeader';
import '../styles/pages/Tickets.css';

const TICKET_STATUS_LABEL_KEYS = {
  open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  in_progress: 'ui.pages.tickets.statusInProgress_b2c3d4e5f2',
  resolved: 'ui.pages.tickets.statusResolved_c3d4e5f6a3',
  closed: 'ui.pages.tickets.closed_f259bec343',
};

const normalizeTicketStatus = (status) =>
  String(status || 'open')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const Tickets = () => {
  const { t } = useTranslation();
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
      toast.error(tUi('ui.pages.tickets.failedToFetchTickets_550b44f85c'));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      toast.error(tUi('ui.pages.tickets.pleaseFillInAllFields_4471417b8d'));
      return;
    }

    setCreating(true);
    try {
      await http.post(TICKET_ENDPOINTS.CREATE, newTicket);
      toast.success(tUi('ui.pages.tickets.ticketCreatedSuccessfully_160b1ad7b1'));
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
      toast.error(tUi('ui.pages.tickets.pleaseEnterAMessage_2ac42d2101'));
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      const url = buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId });
      await http.post(url, { message: responseMessage });
      toast.success(tUi('ui.pages.tickets.responseAddedSuccessfully_4454e51342'));
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
      title: tUi('ui.pages.tickets.deleteTicketTitle_d4e5f6a7b8'),
      message: tUi('ui.pages.tickets.deleteTicketMessage_e5f6a7b8c9'),
      confirmText: tUi('ui.pages.tickets.deleteConfirm_f6a7b8c9d0'),
      cancelText: tUi('ui.pages.tickets.cancel_320b7f4df0'),
    });
    if (!confirmed) return;

    setDeletingTicketId(ticketId);
    try {
      await http.delete(`${TICKET_ENDPOINTS.MY.replace('/my', '')}/${ticketId}`);
      toast.success(tUi('ui.pages.tickets.ticketDeleted_a7b8c9d0e1'));
      if (expandedTicketId === ticketId) setExpandedTicketId(null);
      fetchTickets();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete ticket');
    } finally {
      setDeletingTicketId(null);
    }
  };

  const getStatusClass = (status) => {
    const normalized = normalizeTicketStatus(status);
    if (['in_progress', 'resolved', 'closed', 'open'].includes(normalized)) {
      return `tkt-status tkt-status--${normalized}`;
    }
    return 'tkt-status tkt-status--default';
  };

  const getStatusLabel = (status) => {
    const normalized = normalizeTicketStatus(status);
    const key = TICKET_STATUS_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return status;
  };

  const toggleExpanded = (ticketId) => {
    const next = expandedTicketId === ticketId ? null : ticketId;
    setExpandedTicketId(next);
    if (next) markAsViewed();
  };

  const pageTitle = tUi('ui.pages.tickets.myTickets_7b2e55ccc1');
  const supportKicker = t('ui.pages.tickets.supportKicker_f1a2b3c4d5', { defaultValue: 'Support' });

  return (
    <div className="page-shell tkt-page">
      <div className="tkt-layout">
        <div className="tkt-main">
          <PageHeader
            kicker={supportKicker}
            title={pageTitle}
            subtitle={tUi('ui.pages.tickets.subtitle_g2b3c4d5e6')}
            actions={
              <button
                type="button"
                className={showCreateForm ? 'page-btn-secondary tkt-header-cta' : 'page-btn-primary tkt-header-cta'}
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                {showCreateForm ? (
                  <>
                    <FiX aria-hidden /> {tUi('ui.pages.tickets.cancel_320b7f4df0')}
                  </>
                ) : (
                  <>
                    <FiPlus aria-hidden /> {tUi('ui.pages.tickets.createNewTicket_b216e424fe')}
                  </>
                )}
              </button>
            }
            animate={false}
          />

          <AnimatePresence>
            {showCreateForm && (
              <motion.section
                className="tkt-create-card page-card page-card--static"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="page-section-title">
                  {tUi('ui.pages.tickets.createNewTicket_0662914296')}
                </h2>
                <form className="tkt-form" onSubmit={handleCreateTicket}>
                  <div className="tkt-field">
                    <label htmlFor="tkt-title">{tUi('ui.pages.tickets.title_1ae4d1369f')}</label>
                    <input
                      id="tkt-title"
                      type="text"
                      value={newTicket.title}
                      onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                      placeholder={tUi('ui.pages.tickets.enterTicketTitle_97d186e8ee')}
                      required
                    />
                  </div>
                  <div className="tkt-field">
                    <label htmlFor="tkt-description">
                      {tUi('ui.pages.tickets.description_5df2b50e3c')}
                    </label>
                    <textarea
                      id="tkt-description"
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      placeholder={tUi('ui.pages.tickets.describeYourIssueOrQuestion_ed3fd64aae')}
                      rows={5}
                      required
                    />
                  </div>
                  <div className="tkt-form-actions">
                    <button
                      type="submit"
                      disabled={creating}
                      className="page-btn-primary tkt-submit-create"
                    >
                      {creating ? (
                        tUi('ui.pages.tickets.creating_5f1a5f7f04')
                      ) : (
                        <>
                          <FiSend aria-hidden /> {tUi('ui.pages.tickets.createTicket_6a6e8488fc')}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.section>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="tkt-loading">
              <LoadingSpinner size="large" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="tkt-empty page-card page-card--static page-empty">
              <div className="page-empty-icon" aria-hidden>
                🎫
              </div>
              <p>{tUi('ui.pages.tickets.youHavenTCreatedAny_d33bce3131')}</p>
              {!showCreateForm && (
                <button
                  type="button"
                  className="page-btn-primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  {tUi('ui.pages.tickets.createYourFirstTicket_a2720076a8')}
                </button>
              )}
            </div>
          ) : (
            <div className="tkt-list">
              {tickets.map((ticket, index) => {
                const isExpanded = expandedTicketId === ticket.id;
                const nonChatResponses = (ticket.responses || []).filter((r) => !r.is_chat);
                const isAgent = (user) => user?.id !== ticket.customer_id;

                return (
                  <motion.article
                    key={ticket.id}
                    className={`tkt-card${isExpanded ? ' is-expanded' : ''}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <div
                      className="tkt-card-header"
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
                      <div className="tkt-card-header-start">
                        <TicketUserAvatar user={ticket.customer || currentUser} size={44} />
                        <div className="tkt-card-copy">
                          <h3 className="tkt-card-title">{ticket.title}</h3>
                          <p className="tkt-card-meta">
                            {tUi('ui.pages.tickets.created_caf8e8fb6f')} {formatDate(ticket.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="tkt-card-header-end">
                        <span className={getStatusClass(ticket.status)}>
                          {getStatusLabel(ticket.status)}
                        </span>
                        <span className="tkt-expand" aria-hidden>
                          {isExpanded ? '−' : '+'}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="tkt-detail">
                        <div className="tkt-detail-grid">
                          <div className="tkt-info-col">
                            <div className="tkt-block">
                              <h4>{tUi('ui.pages.tickets.description_5df2b50e3c')}</h4>
                              <p>{ticket.description}</p>
                            </div>

                            <div className="tkt-block tkt-responses">
                              <h4>
                                {tUi('ui.pages.tickets.responses_71bbaea046')}
                                {nonChatResponses.length})
                              </h4>
                              {nonChatResponses.length > 0 ? (
                                nonChatResponses.map((response) => (
                                  <div
                                    key={response.id}
                                    className={`tkt-response${isAgent(response.user) ? ' is-agent' : ''}`}
                                  >
                                    <TicketUserAvatar user={response.user} size={36} />
                                    <div className="tkt-response-body">
                                      <div className="tkt-response-top">
                                        <span className="tkt-response-author">
                                          {response.user.first_name} {response.user.last_name}
                                          {isAgent(response.user) && (
                                            <span className="tkt-agent-tag">
                                              {tUi('ui.pages.tickets.supportAgentTag_h3i4j5k6l7')}
                                            </span>
                                          )}
                                        </span>
                                        <span className="tkt-response-date">
                                          {formatDate(response.created_at)}
                                        </span>
                                      </div>
                                      <p className="tkt-response-msg">{response.message}</p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="tkt-no-responses">
                                  {tUi('ui.pages.tickets.noResponsesYet_c19fb28b39')}
                                </p>
                              )}
                            </div>
                          </div>

                          {ticket.status !== 'Closed' && ticket.status !== 'Resolved' && (
                            <div className="tkt-actions-col">
                              <div className="tkt-chat-card">
                                <h5>{tUi('ui.pages.tickets.liveSupport_i4j5k6l7m8')}</h5>
                                <p>{tUi('ui.pages.tickets.liveSupportDesc_j5k6l7m8n9')}</p>
                                <button
                                  type="button"
                                  className={`page-btn-primary tkt-chat-btn${!ticket.employee ? ' is-disabled' : ''}`}
                                  onClick={() => ticket.employee && setActiveChatTicketId(ticket.id)}
                                  disabled={!ticket.employee}
                                  title={
                                    !ticket.employee
                                      ? tUi('ui.pages.tickets.waitingForAgent_k6l7m8n9o0')
                                      : undefined
                                  }
                                >
                                  <FiMessageCircle aria-hidden />
                                  {ticket.employee
                                    ? tUi('ui.pages.tickets.startLiveChat_l7m8n9o0p1')
                                    : tUi('ui.pages.tickets.waitingForAgent_k6l7m8n9o0')}
                                </button>
                                {ticket.employee ? (
                                  <div className="tkt-agent-row">
                                    <TicketUserAvatar user={ticket.employee} size={48} />
                                    <div>
                                      <span className="tkt-agent-label">
                                        {tUi('ui.pages.tickets.assignedAgent_m8n9o0p1q2')}
                                      </span>
                                      <span className="tkt-agent-name">
                                        {ticket.employee.first_name} {ticket.employee.last_name}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="tkt-pending-note">
                                    <p>{tUi('ui.pages.tickets.pendingAssignment_n9o0p1q2r3')}</p>
                                  </div>
                                )}
                              </div>

                              <div className="tkt-note-card">
                                <h5>{tUi('ui.pages.tickets.addQuickNote_o0p1q2r3s4')}</h5>
                                <textarea
                                  className="tkt-note-textarea"
                                  value={responseMessage}
                                  onChange={(e) => setResponseMessage(e.target.value)}
                                  placeholder={
                                    !ticket.employee
                                      ? tUi('ui.pages.tickets.noteWhenAssigned_p1q2r3s4t5')
                                      : tUi('ui.pages.tickets.typeYourResponse_2fc5ce1286')
                                  }
                                  rows={3}
                                  disabled={!ticket.employee}
                                />
                                <button
                                  type="button"
                                  className="page-btn-secondary tkt-note-btn"
                                  onClick={() => handleAddResponse(ticket.id)}
                                  disabled={
                                    !ticket.employee ||
                                    respondingTicketId === ticket.id ||
                                    !responseMessage.trim()
                                  }
                                >
                                  {respondingTicketId === ticket.id
                                    ? tUi('ui.pages.tickets.sending_feee595abe')
                                    : tUi('ui.pages.tickets.sendResponse_9963e23826')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="tkt-delete-row">
                          <button
                            type="button"
                            className="page-btn-danger"
                            onClick={() => handleDeleteTicket(ticket.id)}
                            disabled={deletingTicketId === ticket.id}
                          >
                            {deletingTicketId === ticket.id
                              ? tUi('ui.pages.tickets.deleting_q2r3s4t5u6')
                              : tUi('ui.pages.tickets.deleteTicketTitle_d4e5f6a7b8')}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="tkt-sidebar">
          <div className="tkt-side-card page-card page-card--static">
            <h4>{tUi('ui.pages.tickets.supportHours_r3s4t5u6v7')}</h4>
            <p>{tUi('ui.pages.tickets.supportHoursWeek_s4t5u6v7w8')}</p>
            <p>{tUi('ui.pages.tickets.supportHoursWeekend_t5u6v7w8x9')}</p>
            <hr className="tkt-side-divider" />
            <h4>{tUi('ui.pages.tickets.commonQuestions_u6v7w8x9y0')}</h4>
            <ul className="tkt-faq-links">
              <li>
                <a href="/faq">{tUi('ui.pages.tickets.faqShipping_v7w8x9y0z1')}</a>
              </li>
              <li>
                <a href="/faq">{tUi('ui.pages.tickets.faqRefunds_w8x9y0z1a2')}</a>
              </li>
              <li>
                <a href="/faq">{tUi('ui.pages.tickets.faqAccount_x9y0z1a2b3')}</a>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <SupportTicketChatModal
        isOpen={!!activeChatTicketId}
        onClose={() => setActiveChatTicketId(null)}
        ticketId={activeChatTicketId}
        currentUserId={currentUser?.id}
        userName={currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : ''}
        currentUserProfileImage={currentUser?.profile_image}
        ticketStatus={tickets.find((t) => t.id === activeChatTicketId)?.status}
      />
    </div>
  );
};

export default Tickets;
