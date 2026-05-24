import { tUi } from '../i18n/uiText';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus,
  FiX,
  FiSend,
  FiMessageCircle,
  FiEdit2,
  FiClock,
  FiHelpCircle,
  FiHeadphones,
  FiArrowRight,
  FiMessageSquare,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import SupportTicketChatModal from '../components/SupportTicketChatModal';
import TicketUserAvatar from '../components/TicketUserAvatar';
import { useAuth } from '../hooks/useAuth';
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

const TICKET_FAQ_ITEMS = [
  {
    id: 'shipping',
    labelKey: 'ui.pages.tickets.faqShipping_v7w8x9y0z1',
    bodyKey: 'ui.pages.tickets.faqShippingBody_y0z1a2b3c4',
  },
  {
    id: 'refunds',
    labelKey: 'ui.pages.tickets.faqRefunds_w8x9y0z1a2',
    bodyKey: 'ui.pages.tickets.faqRefundsBody_z1a2b3c4d5',
  },
  {
    id: 'account',
    labelKey: 'ui.pages.tickets.faqAccount_x9y0z1a2b3',
    bodyKey: 'ui.pages.tickets.faqAccountBody_a2b3c4d5e6',
    profileLink: true,
  },
];

const Tickets = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '' });
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [activeChatTicketId, setActiveChatTicketId] = useState(null);
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [openFaqId, setOpenFaqId] = useState(null);
  const { markAsViewed } = useUnreadTickets();
  const { user: currentUser } = useAuth();

  const hasOpenTicketSlot = !tickets.some((ticket) => ticket.status !== 'Closed');
  const canCreateTicket = hasOpenTicketSlot && !loading;

  const selectedTicket = useMemo(
    () => tickets.find((tkt) => tkt.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    fetchTickets();
    markAsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tickets.length === 0) {
      setSelectedTicketId(null);
      return;
    }
    if (!selectedTicketId || !tickets.some((tkt) => tkt.id === selectedTicketId)) {
      const active =
        tickets.find((tkt) => tkt.status !== 'Closed') || tickets[0];
      setSelectedTicketId(active.id);
    }
  }, [tickets, selectedTicketId]);

  useEffect(() => {
    if (tickets.some((ticket) => ticket.status !== 'Closed')) {
      setShowCreateForm(false);
    }
  }, [tickets]);

  useEffect(() => {
    setResponseMessage('');
    setEditingTicketId(null);
  }, [selectedTicketId]);

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
    if (!canCreateTicket) {
      toast.warn(tUi('ui.pages.tickets.cannotCreateUntilClosed_a1b2c3d4e6'));
      return;
    }
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

  const handleStartEdit = (ticket) => {
    setEditingTicketId(ticket.id);
    setEditForm({ title: ticket.title, description: ticket.description });
  };

  const handleCancelEdit = () => {
    setEditingTicketId(null);
    setEditForm({ title: '', description: '' });
  };

  const handleSaveEdit = async (ticketId) => {
    if (!editForm.title.trim() || !editForm.description.trim()) {
      toast.error(tUi('ui.pages.tickets.pleaseFillInAllFields_4471417b8d'));
      return;
    }

    setSavingEdit(true);
    try {
      await http.patch(buildUrl(TICKET_ENDPOINTS.UPDATE, { ticket_id: ticketId }), editForm);
      toast.success(tUi('ui.pages.tickets.ticketUpdated_b2c3d4e5f7'));
      setEditingTicketId(null);
      setEditForm({ title: '', description: '' });
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to update ticket');
    } finally {
      setSavingEdit(false);
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

  const isAgent = (user, ticket) => user?.id !== ticket?.customer_id;
  const isClosedOrResolved = (status) =>
    ['resolved', 'closed'].includes(normalizeTicketStatus(status));

  const pageTitle = tUi('ui.pages.tickets.myTickets_7b2e55ccc1');
  const supportKicker = t('ui.pages.tickets.supportKicker_f1a2b3c4d5', { defaultValue: 'Support' });

  const renderTicketMain = () => {
    if (!selectedTicket) return null;

    const nonChatResponses = (selectedTicket.responses || []).filter((r) => !r.is_chat);
    const isOpen = normalizeTicketStatus(selectedTicket.status) === 'open';
    const isEditing = editingTicketId === selectedTicket.id;
    const canInteract = !isClosedOrResolved(selectedTicket.status);
    const hasAgent = Boolean(selectedTicket.employee);

    return (
      <motion.article
        key={selectedTicket.id}
        className="tkt-glass-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <header className="tkt-glass-card__header">
          <div>
            <div className="tkt-glass-card__badges">
              <span className={getStatusClass(selectedTicket.status)}>
                <span
                  className={`tkt-status-dot${
                    normalizeTicketStatus(selectedTicket.status) === 'in_progress'
                      ? ' is-pulse'
                      : ''
                  }`}
                  aria-hidden
                />
                {getStatusLabel(selectedTicket.status)}
              </span>
              <span className="tkt-ticket-id">
                {tUi('ui.pages.tickets.ticketIdLabel_f1a2b3c4d7', { id: selectedTicket.id })}
              </span>
            </div>
            {isEditing ? (
              <input
                className="tkt-inline-title-input"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                aria-label={tUi('ui.pages.tickets.title_1ae4d1369f')}
              />
            ) : (
              <h2 className="tkt-glass-card__title">{selectedTicket.title}</h2>
            )}
            <p className="tkt-glass-card__meta">
              {tUi('ui.pages.tickets.created_caf8e8fb6f')} {formatDate(selectedTicket.created_at)}
            </p>
          </div>
          {isOpen && !isEditing && (
            <button
              type="button"
              className="tkt-icon-btn"
              onClick={() => handleStartEdit(selectedTicket)}
              aria-label={tUi('ui.pages.tickets.editTicket_c3d4e5f6a8')}
            >
              <FiEdit2 aria-hidden />
            </button>
          )}
        </header>

        <div className="tkt-glass-card__body">
          <section className="tkt-section">
            <h3 className="tkt-section-label">{tUi('ui.pages.tickets.description_5df2b50e3c')}</h3>
            {isEditing ? (
              <div className="tkt-edit-stack">
                <textarea
                  className="tkt-glass-textarea"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={5}
                  aria-label={tUi('ui.pages.tickets.description_5df2b50e3c')}
                />
                <div className="tkt-edit-actions">
                  <button type="button" className="tkt-btn tkt-btn--ghost" onClick={handleCancelEdit}>
                    {tUi('ui.pages.tickets.cancel_320b7f4df0')}
                  </button>
                  <button
                    type="button"
                    className="tkt-btn tkt-btn--primary"
                    onClick={() => handleSaveEdit(selectedTicket.id)}
                    disabled={savingEdit}
                  >
                    {savingEdit
                      ? tUi('ui.pages.tickets.savingEdit_d4e5f6a7b9')
                      : tUi('ui.pages.tickets.saveChanges_e5f6a7b8c0')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="tkt-description-box">{selectedTicket.description}</div>
            )}
          </section>

          <section className="tkt-section">
            <h3 className="tkt-section-label">
              {tUi('ui.pages.tickets.responsesSection_k6l7m8n9o1', {
                count: nonChatResponses.length,
              })}
            </h3>
            {nonChatResponses.length > 0 ? (
              <div className="tkt-responses-list">
                {nonChatResponses.map((response) => (
                  <div
                    key={response.id}
                    className={`tkt-response${isAgent(response.user, selectedTicket) ? ' is-agent' : ''}`}
                  >
                    <TicketUserAvatar user={response.user} size={36} />
                    <div className="tkt-response-body">
                      <div className="tkt-response-top">
                        <span className="tkt-response-author">
                          {response.user.first_name} {response.user.last_name}
                          {isAgent(response.user, selectedTicket) && (
                            <span className="tkt-agent-tag">
                              {tUi('ui.pages.tickets.supportAgentTag_h3i4j5k6l7')}
                            </span>
                          )}
                        </span>
                        <span className="tkt-response-date">{formatDate(response.created_at)}</span>
                      </div>
                      <p className="tkt-response-msg">{response.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tkt-responses-empty">
                <FiMessageSquare className="tkt-responses-empty__icon" aria-hidden />
                <p className="tkt-responses-empty__title">
                  {tUi('ui.pages.tickets.noResponsesYet_c19fb28b39')}
                </p>
                <p className="tkt-responses-empty__hint">
                  {tUi('ui.pages.tickets.noResponsesHint_g2b3c4d5e8')}
                </p>
              </div>
            )}
          </section>

          {canInteract && (
            <section className="tkt-section">
              <h3 className="tkt-section-label">
                {tUi('ui.pages.tickets.addQuickNote_o0p1q2r3s4')}
              </h3>
              <textarea
                className="tkt-glass-textarea"
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                placeholder={
                  hasAgent
                    ? tUi('ui.pages.tickets.typeYourResponse_2fc5ce1286')
                    : tUi('ui.pages.tickets.noteWhenAssigned_p1q2r3s4t5')
                }
                rows={4}
                disabled={!hasAgent}
              />
              <div className="tkt-send-row">
                <button
                  type="button"
                  className="tkt-btn tkt-btn--primary"
                  onClick={() => handleAddResponse(selectedTicket.id)}
                  disabled={
                    !hasAgent ||
                    respondingTicketId === selectedTicket.id ||
                    !responseMessage.trim()
                  }
                >
                  <FiSend aria-hidden />
                  {respondingTicketId === selectedTicket.id
                    ? tUi('ui.pages.tickets.sending_feee595abe')
                    : tUi('ui.pages.tickets.sendResponse_9963e23826')}
                </button>
              </div>
            </section>
          )}
        </div>
      </motion.article>
    );
  };

  const renderLiveSupportSidebar = () => {
    if (!selectedTicket) return null;

    const hasAgent = Boolean(selectedTicket.employee);
    const canChat = hasAgent && !isClosedOrResolved(selectedTicket.status);

    return (
      <div className="tkt-side-card tkt-side-card--live">
        <div className="tkt-live-head">
          <div className="tkt-live-icon" aria-hidden>
            <FiHeadphones />
          </div>
          <div>
            <h4>{tUi('ui.pages.tickets.liveSupport_i4j5k6l7m8')}</h4>
            <p className="tkt-live-sub">
              {hasAgent
                ? tUi('ui.pages.tickets.agentConnected_l7m8n9o0p2', {
                    name: `${selectedTicket.employee.first_name} ${selectedTicket.employee.last_name}`,
                  })
                : tUi('ui.pages.tickets.waitingForAgent_k6l7m8n9o0')}
            </p>
          </div>
        </div>

        <div className="tkt-live-status-box">
          <p className="tkt-live-status-label">{tUi('ui.pages.tickets.liveStatusLabel_m8n9o0p1q3')}</p>
          <p className="tkt-live-status-value">
            {hasAgent
              ? tUi('ui.pages.tickets.agentReady_n9o0p1q2r4')
              : tUi('ui.pages.tickets.pendingAssignment_n9o0p1q2r3')}
          </p>
        </div>

        {hasAgent && (
          <div className="tkt-agent-row">
            <TicketUserAvatar user={selectedTicket.employee} size={44} />
            <div>
              <span className="tkt-agent-label">
                {tUi('ui.pages.tickets.assignedAgent_m8n9o0p1q2')}
              </span>
              <span className="tkt-agent-name">
                {selectedTicket.employee.first_name} {selectedTicket.employee.last_name}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          className={`tkt-btn tkt-btn--chat${canChat ? '' : ' is-waiting'}`}
          onClick={() => canChat && setActiveChatTicketId(selectedTicket.id)}
          disabled={!canChat}
        >
          {!canChat && <span className="tkt-wait-dot" aria-hidden />}
          <FiMessageCircle aria-hidden />
          {canChat
            ? tUi('ui.pages.tickets.startLiveChat_l7m8n9o0p1')
            : isClosedOrResolved(selectedTicket.status)
              ? tUi('ui.pages.tickets.chatClosed_o0p1q2r3s5')
              : tUi('ui.pages.tickets.waitingForAgent_k6l7m8n9o0')}
        </button>
      </div>
    );
  };

  return (
    <div className="tkt-page">
      <header className="tkt-page-header">
        <div className="tkt-page-header-top">
          <div className="tkt-page-header-copy">
            <span className="tkt-kicker">{supportKicker}</span>
            <h1 className="tkt-page-title">{pageTitle}</h1>
            <p className="tkt-page-subtitle">{tUi('ui.pages.tickets.subtitle_g2b3c4d5e6')}</p>
          </div>
          <div className="tkt-page-header-actions">
            {canCreateTicket ? (
              <button
                type="button"
                className={`tkt-btn tkt-btn--primary${showCreateForm ? ' is-active' : ''}`}
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
            ) : (
              <p className="tkt-create-blocked-note">
                {tUi('ui.pages.tickets.cannotCreateUntilClosed_a1b2c3d4e6')}
              </p>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
          {showCreateForm && (
            <motion.section
              className="tkt-glass-card tkt-create-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <h2 className="tkt-create-title">{tUi('ui.pages.tickets.createNewTicket_0662914296')}</h2>
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
                  <label htmlFor="tkt-description">{tUi('ui.pages.tickets.description_5df2b50e3c')}</label>
                  <textarea
                    id="tkt-description"
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    placeholder={tUi('ui.pages.tickets.describeYourIssueOrQuestion_ed3fd64aae')}
                    rows={5}
                    required
                  />
                </div>
                <div className="tkt-send-row">
                  <button type="submit" className="tkt-btn tkt-btn--primary" disabled={creating}>
                    <FiSend aria-hidden />
                    {creating
                      ? tUi('ui.pages.tickets.creating_5f1a5f7f04')
                      : tUi('ui.pages.tickets.createTicket_6a6e8488fc')}
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
          <div className="tkt-empty tkt-glass-card">
            <span className="tkt-empty-icon" aria-hidden>
              🎫
            </span>
            <p>{tUi('ui.pages.tickets.youHavenTCreatedAny_d33bce3131')}</p>
            {canCreateTicket && !showCreateForm && (
                <button
                type="button"
                className="tkt-btn tkt-btn--primary"
                onClick={() => setShowCreateForm(true)}
              >
                <FiPlus aria-hidden />
                {tUi('ui.pages.tickets.createYourFirstTicket_a2720076a8')}
                </button>
              )}
            </div>
          ) : (
          <>
            {tickets.length > 1 && (
              <nav className="tkt-ticket-nav" aria-label={tUi('ui.pages.tickets.selectTicket_i4j5k6l7m9')}>
                <span className="tkt-ticket-nav-label">
                  {tUi('ui.pages.tickets.historyTitle_j5k6l7m8n0')}
                </span>
                <div className="tkt-ticket-pills">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className={`tkt-ticket-pill${selectedTicketId === ticket.id ? ' is-active' : ''}`}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <span className="tkt-ticket-pill-title">{ticket.title}</span>
                      <span className={getStatusClass(ticket.status)}>
                        {getStatusLabel(ticket.status)}
                        </span>
                    </button>
                                  ))}
                                </div>
              </nav>
            )}

            <div className="tkt-bento">
              <div className="tkt-bento-main">{renderTicketMain()}</div>

              <aside className="tkt-bento-side">
                {renderLiveSupportSidebar()}

                <div className="tkt-side-card tkt-side-card--glass">
                  <div className="tkt-side-card-head">
                    <FiClock aria-hidden />
                    <h4>{tUi('ui.pages.tickets.supportHours_r3s4t5u6v7')}</h4>
                            </div>
                  <div className="tkt-hours-rows">
                    <div className="tkt-hours-row">
                      <span>{tUi('ui.pages.tickets.supportHoursWeekLabel_p1q2r3s4t6')}</span>
                      <span>{tUi('ui.pages.tickets.supportHoursWeek_s4t5u6v7w8')}</span>
                          </div>
                    <div className="tkt-hours-row">
                      <span>{tUi('ui.pages.tickets.supportHoursWeekendLabel_q2r3s4t5u7')}</span>
                      <span>{tUi('ui.pages.tickets.supportHoursWeekend_t5u6v7w8x9')}</span>
                                    </div>
                                  </div>
                  <p className="tkt-timezone">{tUi('ui.pages.tickets.timezoneNote_h3i4j5k6l8')}</p>
                              </div>

                <div className="tkt-side-card tkt-side-card--glass">
                  <div className="tkt-side-card-head">
                    <FiHelpCircle aria-hidden />
                    <h4>{tUi('ui.pages.tickets.commonQuestions_u6v7w8x9y0')}</h4>
                              </div>
                  <ul className="tkt-faq-links">
                    {TICKET_FAQ_ITEMS.map((item) => {
                      const isOpen = openFaqId === item.id;
                      return (
                        <li key={item.id} className={`tkt-faq-item${isOpen ? ' is-open' : ''}`}>
                          <button
                            type="button"
                            className="tkt-faq-trigger"
                            onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                            aria-expanded={isOpen}
                          >
                            <span>{tUi(item.labelKey)}</span>
                            <FiArrowRight className="tkt-faq-trigger-icon" aria-hidden />
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                className="tkt-faq-panel"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <p>{tUi(item.bodyKey)}</p>
                                {item.profileLink && (
                                  <Link to="/profile" className="tkt-faq-profile-link">
                                    {tUi('ui.pages.tickets.faqAccountLink_b3c4d5e6f7')}
                                  </Link>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                );
              })}
                  </ul>
                </div>
              </aside>
            </div>
          </>
        )}

      <SupportTicketChatModal 
        isOpen={!!activeChatTicketId}
        onClose={() => setActiveChatTicketId(null)}
        ticketId={activeChatTicketId}
        currentUserId={currentUser?.id}
        userName={currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : ''}
        currentUserProfileImage={currentUser?.profile_image}
        ticketStatus={tickets.find((tkt) => tkt.id === activeChatTicketId)?.status}
      />
    </div>
  );
};

export default Tickets;
