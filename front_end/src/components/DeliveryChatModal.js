import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../config/api';
import '../styles/components/ChatWidget.css';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

const DeliveryChatModal = ({ isOpen, onClose, jobId, token, currentUserId, isDriver }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);

  const getUserIdFromToken = () => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id ?? payload.user_id ?? payload.sub ?? null;
    } catch (e) {
      return null;
    }
  };

  const effectiveCurrentUserId = currentUserId ?? getUserIdFromToken();

  const isOwnMessage = (msg) => String(msg?.sender_id) === String(effectiveCurrentUserId);

  const upsertMessage = (prev, incoming) => {
    if (!incoming) return prev;
    const idx = prev.findIndex((m) => m.id === incoming.id);
    if (idx === -1) {
      const filtered = prev.filter(
        (m) => !(m.id === null && m.sender_id === incoming.sender_id && m.message === incoming.message)
      );
      return [...filtered, incoming];
    }

    const next = [...prev];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  };

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
    if (!isOpen || !jobId) return;

    let isMounted = true;

    // Fetch history
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.GET_CHAT, { job_id: jobId }));
        if (isMounted) {
          setMessages(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching chat history:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistory();

    // Connect WebSocket for real-time receiving
    const wsProt = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = 'localhost:8000';
    const wsUrl = `${wsProt}//${backendHost}/delivery/jobs/${jobId}/ws/chat?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Chat WebSocket connected');
      if (isMounted) setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (isMounted) {
          if (data.event && data.message) {
            setMessages((prev) => upsertMessage(prev, data.message));
            return;
          }
          setMessages((prev) => upsertMessage(prev, data));
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (isMounted) setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('Chat WebSocket disconnected');
      if (isMounted) setWsConnected(false);
    };

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen, jobId, token]);

  // Send message via REST API (always reliable)
  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputMessage('');

    // Optimistic UI: add the message immediately
    const optimisticMsg = {
      id: null,
      delivery_job_id: jobId,
      sender_id: effectiveCurrentUserId,
      sender_name: 'You',
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // Send via REST API
      const response = await http.post(
        buildUrl(DELIVERY_ENDPOINTS.SEND_CHAT, { job_id: jobId }),
        { message: text }
      );

      // Replace optimistic message with the real one from server
      setMessages(prev => {
        const filtered = prev.filter(m => !(m.id === null && String(m.sender_id) === String(effectiveCurrentUserId) && m.message === text));
        // Only add if not already present (WS may have already delivered it)
        if (response.data.id && filtered.some(m => m.id === response.data.id)) {
          return filtered;
        }
        return [...filtered, response.data];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => !(m.id === null && String(m.sender_id) === String(effectiveCurrentUserId) && m.message === text)));
      // Re-populate the input so user can try again
      setInputMessage(text);
    } finally {
      setIsSending(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reactToMessage = async (messageId, reaction) => {
    setActionLoadingId(messageId);
    try {
      const response = await http.post(
        buildUrl(DELIVERY_ENDPOINTS.REACT_CHAT, { job_id: jobId, message_id: messageId }),
        { reaction }
      );
      setMessages((prev) => upsertMessage(prev, response.data));
    } catch (error) {
      console.error('Error reacting to message:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="chat-widget active-job-chat-widget"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}
        >
          {/* Chat Header */}
          <div className="chat-header">
            <div className="chat-header-content">
              <h3>{isDriver ? 'Chat with Customer' : 'Chat with Driver'}</h3>
              <div className="chat-header-actions">
                <button
                  onClick={onClose}
                  className="chat-close-button"
                  title="Close chat"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div className="chat-messages">
            {isLoading && messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading messages...</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No messages yet. Send one to start the conversation!</div>
            ) : (
              messages.map((msg, index) => {
                const isMyMessage = isOwnMessage(msg);
                return (
                  <div
                    key={msg.id || `msg-${index}`}
                    className={`chat-message ${isMyMessage ? 'user-message' : 'assistant-message'}`}
                    style={{ opacity: msg.id === null ? 0.6 : 1 }}
                  >
                     <div style={{ fontSize: '0.75rem', marginBottom: '2px', opacity: 0.7 }}>
                        {isMyMessage ? 'You' : msg.sender_name}
                     </div>
                    <div className="message-content">
                      <span>{msg.message}</span>
                    </div>

                    {msg.id && !msg.is_deleted && !isMyMessage && (
                      <div className="chat-reactions-row" style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={`${msg.id}-${emoji}`}
                            className="chat-reaction-btn"
                            style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '12px', padding: '2px 6px', fontSize: '14px', cursor: 'pointer' }}
                            onClick={() => reactToMessage(msg.id, emoji)}
                            disabled={actionLoadingId === msg.id}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="chat-reaction-summary" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {msg.reactions.map((reaction) => (
                          <button
                            key={`${msg.id}-summary-${reaction.emoji}`}
                            className={`chat-reaction-chip ${reaction.reacted_by_me ? 'active' : ''}`}
                            style={{ 
                              border: reaction.reacted_by_me ? '1px solid #667eea' : '1px solid rgba(0,0,0,0.1)', 
                              background: reaction.reacted_by_me ? 'rgba(102,126,234,0.15)' : '#fff',
                              borderRadius: '12px', padding: '2px 6px', fontSize: '12px', cursor: isMyMessage ? 'default' : 'pointer'
                            }}
                            onClick={() => {
                              if (!isMyMessage) {
                                reactToMessage(msg.id, reaction.emoji);
                              }
                            }}
                            disabled={actionLoadingId === msg.id || msg.is_deleted}
                          >
                            {reaction.emoji} {reaction.count}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
            />
            <button
              className="chat-send-button"
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isSending}
            >
              {isSending ? '⏳' : '➤'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeliveryChatModal;
