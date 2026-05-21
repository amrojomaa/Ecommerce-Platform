import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import '../styles/layouts/Sidebar.css';

const SupportAgentSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { unreadCount } = useUnreadTickets();

  const menuItems = [
  { path: '/support-agent', labelKey: 'ui.sidebar.menu.support_agent_dashboard', icon: '📊' },
  { path: '/support-agent/tickets', labelKey: 'ui.sidebar.menu.tickets', icon: '🎫' }];


  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>{t('ui.sidebar.panel.support_agent')}</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isTickets = item.path === '/support-agent/tickets';
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}>
              
              <span className="sidebar-icon">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
              {isTickets && unreadCount > 0 &&
              <span className="sidebar-badge">{unreadCount}</span>
              }
            </Link>);

        })}
      </nav>
    </aside>);

};

export default SupportAgentSidebar;
