import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import { useDeliveryIssueCount } from '../hooks/useDeliveryIssueCount';
import { useDeliveryPhotoCount } from '../hooks/useDeliveryPhotoCount';
import '../styles/layouts/Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { unreadCount } = useUnreadTickets();
  const { issueCount } = useDeliveryIssueCount();
  const { photoCount } = useDeliveryPhotoCount();
  const deliveriesNotificationCount = issueCount + photoCount;

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/products', label: 'Products', icon: '📦' },
    { path: '/admin/categories', label: 'Categories', icon: '🏷️' },
    { path: '/admin/orders', label: 'Orders', icon: '📋' },
    { path: '/admin/deliveries', label: 'Deliveries', icon: '🚚' },
    { path: '/admin/users', label: 'Users', icon: '👥' },
    { path: '/admin/tickets', label: 'Tickets', icon: '🎫' },
    { path: '/admin/comments', label: 'Reviews', icon: '💬' },
  ];

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>Admin Panel</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isTickets = item.path === '/admin/tickets';
          const isDeliveries = item.path === '/admin/deliveries';
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
              {isDeliveries && deliveriesNotificationCount > 0 && (
                <span className="sidebar-badge sidebar-badge-deliveries">{deliveriesNotificationCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
