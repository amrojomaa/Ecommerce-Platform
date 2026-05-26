import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import SidebarMenuIcon, { SidebarPanelBrandIcon } from '../components/SidebarMenuIcon';
import '../styles/layouts/Sidebar.css';

const SupportAgentSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { unreadCount } = useUnreadTickets();

  const menuItems = [
    { path: '/support-agent', labelKey: 'ui.sidebar.menu.support_agent_dashboard', icon: 'dashboard' },
    { path: '/support-agent/tickets', labelKey: 'ui.sidebar.menu.tickets', icon: 'tickets' },
  ];

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <SidebarPanelBrandIcon panelKey="supportAgent" />
          <div className="sidebar-brand-copy">
            <h2>{t('ui.sidebar.panel.support_agent')}</h2>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isTickets = item.path === '/support-agent/tickets';
          const isActive =
            item.path === '/support-agent'
              ? location.pathname === '/support-agent'
              : location.pathname.startsWith(item.path);

          return (
            <Link key={item.path} to={item.path} className={`sidebar-link${isActive ? ' active' : ''}`}>
              <SidebarMenuIcon name={item.icon} />
              <span className="sidebar-link-label">{t(item.labelKey)}</span>
              {isTickets && unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default SupportAgentSidebar;
