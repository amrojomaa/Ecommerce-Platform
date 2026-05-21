import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import http from '../services/http';
import { AI_ASSISTANT_ENDPOINTS } from '../config/api';
import { formatPrice, getImageUrl } from '../utils/helpers';
import { normalizeLanguageCode } from '../i18n/constants';
import { localizeProduct } from '../utils/localizedContent';
import '../styles/components/ChatWidget.css';

const ChatWidget = () => {
  const { t, i18n } = useTranslation();
  const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
  {
    role: 'assistant',
    content: t('chat.welcomeMessage'),
    products: []
  }]
  );
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to chat
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      products: []
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await http.post(AI_ASSISTANT_ENDPOINTS.CHAT, {
        message: userMessage,
        session_id: sessionId
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.message,
        products: response.data.products || []
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: t('chat.errorMessage'),
        products: []
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    try {
      await http.post(AI_ASSISTANT_ENDPOINTS.CLEAR, {
        session_id: sessionId
      });
      setMessages([
      {
        role: 'assistant',
        content: t('chat.clearedMessage'),
        products: []
      }]
      );
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        className="chat-toggle-button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label={t("chat.toggleAria")}>
        
        {isOpen ? '✕' : '💬'}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen &&
        <motion.div
          className="chat-widget"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.2 }}>
          
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-content">
                <h3>{t("chat.title")}</h3>
                <div className="chat-header-actions">
                  <button
                  onClick={clearChat}
                  className="chat-clear-button"
                  title={t("chat.clearTitle")}>
                  
                    🗑️
                  </button>
                  <button
                  onClick={() => setIsOpen(false)}
                  className="chat-close-button"
                  title={t("chat.closeTitle")}>
                  
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div className="chat-messages">
              {messages.map((msg, index) =>
            <div
              key={index}
              className={`chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}>
              
                  <div className="message-content">
                    {msg.content}
                  </div>
                  
                  {/* Product Cards */}
                  {msg.products && msg.products.length > 0 &&
              <div className="product-recommendations">
                      <h4>{t("chat.recommendedProducts")}</h4>
                      <div className="product-cards-grid">
                        {msg.products.map((product) =>
                  (() => {
                    const localizedProduct = localizeProduct(product, languageCode);
                    return (
                  <motion.div
                    key={product.id}
                    className="product-card-mini"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}>
                    
                            <Link
                      to={`/products/${encodeURIComponent(product.name)}`}
                      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: '12px', width: '100%' }}>
                      
                            {product.images && product.images.length > 0 &&
                      <div className="product-image-mini">
                                <img
                          src={getImageUrl(product.images[0])}
                          alt={localizedProduct.localized_name}
                          onError={(e) => {
                            e.target.src = getImageUrl('/images/placeholder.jpg');
                          }} />
                        
                              </div>
                      }
                            <div className="product-info-mini">
                              <h5>{localizedProduct.localized_name}</h5>
                              <p className="product-price-mini">{formatPrice(product.price)}</p>
                              <p className="product-category-mini">{localizedProduct.localized_category_name}</p>
                            </div>
                            </Link>
                          </motion.div>
                    );
                  })()
                  )}
                      </div>
                    </div>
              }
                </div>
            )}
              
              {isLoading &&
            <div className="chat-message assistant-message">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
            }
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chat-input-container">
              <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder={t("chat.inputPlaceholder")}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading} />
            
              <button
              className="chat-send-button"
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}>
              
                {isLoading ? '⏳' : '➤'}
              </button>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </>);

};

export default ChatWidget;
