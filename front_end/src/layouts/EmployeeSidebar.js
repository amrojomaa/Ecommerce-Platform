import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import '../styles/layouts/Sidebar.css';

const EmployeeSidebar = () => {
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { unreadCount } = useUnreadTickets();

  const menuItems = [
    { path: '/employee', label: 'Dashboard', icon: '📊' },
    { path: '/employee/tickets', label: 'Tickets', icon: '🎫' },
  ];

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>Employee Panel</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isTickets = item.path === '/employee/tickets';
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
              {isTickets && unreadCount > 0 && (
                <span className="sidebar-badge">{unreadCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default EmployeeSidebar;
