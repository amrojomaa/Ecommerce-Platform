import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiMessageCircle, FiClock } from 'react-icons/fi';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import SupportTicketChatModal from '../../components/SupportTicketChatModal';
import TicketUserAvatar from '../../components/TicketUserAvatar';
import { formatDate } from '../../utils/helpers';
import '../../styles/pages/admin/AdminPanel.css';
import '../../styles/pages/support-agent/SupportAgentPanel.css';
import '../../styles/pages/support-agent/SupportAgentChats.css';

const SupportAgentChats = () => {
  const { t } = useTranslation();
  const panelKicker = t('ui.sidebar.panel.support_agent');

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchChats();
    fetchCurrentUser();
  }, []);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.CHAT_LIST);
      setChats(response.data || []);
    } catch (error) {
      console.error('Error fetching chat list:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await http.get(USER_ENDPOINTS.ME);
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredChats = chats.filter(
    (chat) =>
      `${chat.first_name} ${chat.last_name}`.toLowerCase().includes(term) ||
      chat.email.toLowerCase().includes(term)
  );

  if (loading) {
    return (
      <div className="page-loading adm-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-page-shell adm-page spa-page spa-chats-page">
      <PageHeader
        kicker={panelKicker}
        title={t('ui.pages.support_agent.chats.title')}
        subtitle={t('ui.pages.support_agent.chats.subtitle')}
      />

      <section className="spa-chats-section" aria-label={t('ui.pages.support_agent.chats.title')}>
        <div className="spa-chats-panel">
          <label className="spa-chats-search" htmlFor="spa-chats-search-input">
            <FiSearch aria-hidden />
            <input
              id="spa-chats-search-input"
              type="search"
              className="spa-chats-search-input"
              placeholder={t('ui.pages.support_agent.chats.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>

          <div className="spa-chats-list">
            {filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className="spa-chat-item"
                  onClick={() => setSelectedTicketId(chat.active_ticket_id)}
                >
                  <TicketUserAvatar
                    user={{
                      first_name: chat.first_name,
                      last_name: chat.last_name,
                      email: chat.email,
                      profile_image: chat.profile_image,
                    }}
                    size={48}
                  />
                  <div className="spa-chat-info">
                    <div className="spa-chat-top">
                      <h3 className="spa-chat-name">
                        {chat.first_name} {chat.last_name}
                      </h3>
                      <span className="spa-chat-time">
                        <FiClock size={12} aria-hidden />
                        {formatDate(chat.last_updated)}
                      </span>
                    </div>
                    <p className="spa-chat-preview">{chat.last_message}</p>
                  </div>
                  <span className="spa-chat-action" aria-hidden>
                    <FiMessageCircle />
                  </span>
                </button>
              ))
            ) : (
              <div className="spa-chats-empty">
                <FiMessageCircle aria-hidden />
                <p>{t('ui.pages.support_agent.chats.empty')}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <SupportTicketChatModal
        isOpen={!!selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        ticketId={selectedTicketId}
        currentUserId={currentUser?.id}
        userName={currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : ''}
        currentUserProfileImage={currentUser?.profile_image}
      />
    </div>
  );
};

export default SupportAgentChats;
