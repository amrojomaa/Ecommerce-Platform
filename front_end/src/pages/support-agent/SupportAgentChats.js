import React, { useState, useEffect } from 'react';
import { FiSearch, FiMessageCircle, FiUser, FiClock } from 'react-icons/fi';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import SupportTicketChatModal from '../../components/SupportTicketChatModal';
import { formatDate } from '../../utils/helpers';
import '../../styles/pages/support-agent/SupportAgentDashboard.css';

const SupportAgentChats = () => {
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

  const filteredChats = chats.filter(chat => 
    `${chat.first_name} ${chat.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="page-loading dashboard-loading"><LoadingSpinner size="large" /></div>;

  const activeChatsTitle = 'Active Customer Chats';

  return (
    <div className="admin-page-shell support-agent-dashboard">
      <header className="dashboard-header">
        <PageHeader
          kicker={activeChatsTitle}
          title={activeChatsTitle}
          subtitle="Real-time conversations with customers who have active tickets assigned to you."
        />
      </header>

      <div className="dashboard-content">
        <div className="chats-container" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div className="search-bar" style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <FiSearch style={{ color: '#9ca3af' }} />
            <input 
              type="text" 
              placeholder="Search customers by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem' }}
            />
          </div>

          <div className="chats-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredChats.length > 0 ? (
              filteredChats.map(chat => (
                <div 
                  key={chat.id} 
                  className="chat-item" 
                  onClick={() => setSelectedTicketId(chat.active_ticket_id)}
                  style={{ 
                    padding: '15px 20px', 
                    borderBottom: '1px solid #f3f4f6', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4f46e5', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {chat.profile_image ? (
                      <img src={chat.profile_image} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <FiUser />
                    )}
                  </div>
                  <div className="chat-info" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#111827' }}>{chat.first_name} {chat.last_name}</h4>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiClock size={12} /> {formatDate(chat.last_updated)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                      {chat.last_message}
                    </p>
                  </div>
                  <div className="chat-action">
                    <FiMessageCircle style={{ color: '#4f46e5', fontSize: '1.5rem' }} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <FiMessageCircle style={{ fontSize: '3rem', marginBottom: '10px', opacity: 0.5 }} />
                <p>No active chats found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
