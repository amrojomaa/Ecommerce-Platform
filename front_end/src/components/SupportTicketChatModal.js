import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../config/api';
import { buildWebSocketUrl } from '../utils/helpers';
import '../styles/components/ChatWidget.css';

const SupportTicketChatModal = ({ isOpen, onClose, ticketId, currentUserId, userName }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);

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

  // Fetch initial history and connect to WebSocket
  useEffect(() => {
    if (!isOpen || !ticketId) return;

    let isMounted = true;

    // Fetch history
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await http.get(buildUrl(TICKET_ENDPOINTS.BY_ID, { ticket_id: ticketId }));
        if (isMounted) {
          const chatMessages = (response.data.responses || []).filter(m => m.is_chat);
          setMessages(chatMessages);
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

        ws.onopen = () => console.log('Ticket Chat Connected');
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (isMounted) {
              if (!data.is_chat) return;
              setMessages((prev) => {
                const filtered = prev.filter(m => !(m.id === null && m.user?.id === data.user?.id && m.message === data.message));
                if (filtered.some(m => m.id === data.id)) return filtered;
                return [...filtered, data];
              });
            }
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };
        ws.onerror = (error) => console.error('WebSocket error:', error);
        ws.onclose = () => console.log('Ticket Chat Disconnected');
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
  }, [isOpen, ticketId]);

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputMessage('');

    // Optimistic UI
    const optimisticMsg = {
      id: null,
      message: text,
      created_at: new Date().toISOString(),
      is_chat: true,
      user: {
        id: currentUserId,
        first_name: userName.split(' ')[0],
        last_name: userName.split(' ')[1] || '',
        role: 'customer'
      }
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await http.post(
        buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId }),
        { message: text, is_chat: true }
      );
      // Message will be replaced/confirmed via WebSocket broadcast
    } catch (error) {
      console.error('Error sending ticket message:', error);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter(m => m !== optimisticMsg));
      setInputMessage(text);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isOwnMessage = (msg) => String(msg?.user?.id) === String(currentUserId);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="chat-widget active-job-chat-widget"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, width: '350px', height: '500px', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          
          <div className="chat-header" style={{ padding: '15px', background: '#4f46e5', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Support Chat</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
          </div>

          <div className="chat-messages" style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', color: '#666' }}>Loading messages...</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>No messages yet.</div>
            ) : (
              messages.map((msg, index) => {
                const isMe = isOwnMessage(msg);
                return (
                  <div key={msg.id || index} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px', textAlign: isMe ? 'right' : 'left' }}>
                      {isMe ? 'You' : `${msg.user.first_name} ${msg.user.last_name}`}
                    </div>
                    <div style={{ background: isMe ? '#4f46e5' : '#f3f4f6', color: isMe ? '#fff' : '#1f2937', padding: '8px 12px', borderRadius: '12px', borderBottomRightRadius: isMe ? '2px' : '12px', borderBottomLeftRadius: isMe ? '12px' : '2px', fontSize: '0.9rem' }}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container" style={{ padding: '15px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', border: '1px solid #d1d5db', outline: 'none' }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isSending}
              style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
              ➤
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SupportTicketChatModal;
