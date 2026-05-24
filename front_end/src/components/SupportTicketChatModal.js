import { tUi } from '../i18n/uiText';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../config/api';
import { buildWebSocketUrl } from '../utils/helpers';
import { useAuth } from '../hooks/useAuth';
import TicketUserAvatar from './TicketUserAvatar';
import '../styles/components/ChatWidget.css';

const normalizeStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const sortMessages = (messages) =>
  [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

const SupportTicketChatModal = ({
  isOpen,
  onClose,
  ticketId,
  currentUserId,
  userName,
  ticketStatus,
}) => {
  const { user } = useAuth();
  const effectiveUserId = currentUserId ?? user?.id;

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);
  const knownIdsRef = useRef(new Set());

  const getMessageUserId = (msg) => msg?.user?.id ?? msg?.user_id;

  const isOwnMessage = useCallback(
    (msg) => String(getMessageUserId(msg)) === String(effectiveUserId),
    [effectiveUserId]
  );

  const upsertMessage = useCallback((prev, incoming) => {
    if (!incoming?.message) return prev;

    const incomingId = incoming.id != null ? String(incoming.id) : null;
    const incomingText = incoming.message.trim();

    if (incomingId && knownIdsRef.current.has(incomingId)) {
      const existingIdx = prev.findIndex((m) => String(m.id) === incomingId);
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...incoming };
        return sortMessages(next);
      }
    }

    const filtered = prev.filter((m) => {
      if (incomingId && m.id != null && String(m.id) === incomingId) return false;
      if (m.id == null && m.message?.trim() === incomingText) {
        return String(m.user?.id) !== String(incoming.user?.id);
      }
      return true;
    });

    if (incomingId && filtered.some((m) => String(m.id) === incomingId)) {
      return sortMessages(filtered);
    }

    if (incomingId) knownIdsRef.current.add(incomingId);

    return sortMessages([...filtered, incoming]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('support-ticket-chat-open');
    } else {
      document.body.classList.remove('support-ticket-chat-open');
    }
    return () => document.body.classList.remove('support-ticket-chat-open');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !ticketId) return;

    let isMounted = true;
    knownIdsRef.current = new Set();

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await http.get(buildUrl(TICKET_ENDPOINTS.BY_ID, { ticket_id: ticketId }));
        if (isMounted) {
          const chatMessages = (response.data.responses || []).filter((m) => m.is_chat);
          chatMessages.forEach((m) => {
            if (m.id != null) knownIdsRef.current.add(String(m.id));
          });
          setMessages(sortMessages(chatMessages));
        }
      } catch (error) {
        console.error('Error fetching ticket history:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistory();

    const connectWebSocket = async () => {
      try {
        const ticketTokenResponse = await http.post(
          buildUrl(TICKET_ENDPOINTS.CHAT_TICKET, { ticket_id: ticketId })
        );
        const wsAuthToken = ticketTokenResponse?.data?.ws_chat_token;

        if (!isMounted || !wsAuthToken) return;

        const wsUrl = buildWebSocketUrl(
          buildUrl(TICKET_ENDPOINTS.WS_CHAT, { ticket_id: ticketId }),
          { token: wsAuthToken }
        );

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!isMounted || !data.is_chat) return;
            setMessages((prev) => upsertMessage(prev, data));
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };
        ws.onerror = (error) => console.error('WebSocket error:', error);
      } catch (error) {
        console.error('Failed to connect to ticket chat WS:', error);
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen, ticketId, upsertMessage]);

  const getSenderLabel = (msg) => {
    if (isOwnMessage(msg)) {
      return tUi('ui.components.supportTicketChatModal.you_a1b2c3d4e5');
    }
    const name = `${msg.user?.first_name || ''} ${msg.user?.last_name || ''}`.trim();
    return name || msg.user?.email || tUi('ui.components.supportTicketChatModal.supportAgent_b2c3d4e5f6');
  };

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputMessage('');

    try {
      const response = await http.post(
        buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId }),
        { message: text, is_chat: true }
      );

      const confirmed = {
        id: response.data.id,
        message: response.data.message,
        created_at: response.data.created_at,
        is_chat: true,
        user: response.data.user || {
          id: effectiveUserId,
          first_name: userName?.split(' ')[0] || user?.first_name || '',
          last_name: userName?.split(' ').slice(1).join(' ') || user?.last_name || '',
        },
      };

      setMessages((prev) => upsertMessage(prev, confirmed));
    } catch (error) {
      console.error('Error sending ticket message:', error);
      setInputMessage(text);
      toast.error(tUi('ui.components.supportTicketChatModal.sendFailed_c3d4e5f6a7'));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const chatDisabled = ['resolved', 'closed'].includes(normalizeStatus(ticketStatus));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="chat-widget support-ticket-chat-widget"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.2 }}
        >
          <div className="chat-header">
            <div className="chat-header-content">
              <h3>{tUi('ui.components.supportTicketChatModal.title_d4e5f6a7b8')}</h3>
              <div className="chat-header-actions">
                <button
                  type="button"
                  onClick={onClose}
                  className="chat-close-button"
                  aria-label={tUi('ui.components.supportTicketChatModal.close_e5f6a7b8c9')}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div className="chat-messages">
            {isLoading && messages.length === 0 ? (
              <div className="support-ticket-chat-placeholder">
                {tUi('ui.components.supportTicketChatModal.loading_f6a7b8c9d0')}
              </div>
            ) : messages.length === 0 ? (
              <div className="support-ticket-chat-placeholder">
                {tUi('ui.components.supportTicketChatModal.empty_a7b8c9d0e1')}
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = isOwnMessage(msg);
                if (isMe) {
                  return (
                    <div
                      key={msg.id != null ? `msg-${msg.id}` : `pending-${msg.created_at}-${msg.message}`}
                      className="chat-message user-message"
                    >
                      <div className="support-ticket-chat-sender">
                        {tUi('ui.components.supportTicketChatModal.you_a1b2c3d4e5')}
                      </div>
                      <div className="message-content">{msg.message}</div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id != null ? `msg-${msg.id}` : `pending-${msg.created_at}-${msg.message}`}
                    className="chat-message assistant-message"
                  >
                    <div className="support-ticket-chat-other-row">
                      <TicketUserAvatar user={msg.user} size={34} />
                      <div className="support-ticket-chat-other-body">
                        <div className="support-ticket-chat-sender">{getSenderLabel(msg)}</div>
                        <div className="message-content">{msg.message}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            {chatDisabled ? (
              <div className="support-ticket-chat-disabled">
                {tUi('ui.components.supportTicketChatModal.disabled_b8c9d0e1f2', {
                  status: ticketStatus,
                })}
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  className="chat-input"
                  placeholder={tUi('ui.components.supportTicketChatModal.placeholder_c9d0e1f2a3')}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                />
                <button
                  type="button"
                  className="chat-send-button"
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isSending}
                  aria-label={tUi('ui.components.supportTicketChatModal.send_d0e1f2a3b4')}
                >
                  {isSending ? '⏳' : '➤'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SupportTicketChatModal;
