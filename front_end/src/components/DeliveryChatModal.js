import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import http from '../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../config/api';
import '../styles/components/ChatWidget.css';

const DeliveryChatModal = ({ isOpen, onClose, jobId, token, currentUserId, isDriver }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
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
          // Avoid duplicates: don't add if we already have this message from the REST response
          setMessages((prev) => {
            // If the message has an id and we already have it, skip
            if (data.id && prev.some(m => m.id === data.id)) {
              return prev;
            }
            // Also remove any optimistic message (id === null) with the same text from same sender
            const filtered = prev.filter(m => !(m.id === null && m.sender_id === data.sender_id && m.message === data.message));
            return [...filtered, data];
          });
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
      sender_id: currentUserId,
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
        const filtered = prev.filter(m => !(m.id === null && m.sender_id === currentUserId && m.message === text));
        // Only add if not already present (WS may have already delivered it)
        if (response.data.id && filtered.some(m => m.id === response.data.id)) {
          return filtered;
        }
        return [...filtered, response.data];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => !(m.id === null && m.sender_id === currentUserId && m.message === text)));
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
                const isMyMessage = msg.sender_id === currentUserId;
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
                      {msg.message}
                    </div>
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
