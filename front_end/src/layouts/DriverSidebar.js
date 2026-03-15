import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import '../styles/layouts/Sidebar.css';

const DriverSidebar = () => {
  const location = useLocation();
  const { isDarkMode } = useTheme();

  const menuItems = [
    { path: '/driver', label: 'Dashboard', icon: '📊' },
    { path: '/driver/map', label: 'Find Jobs', icon: '🗺️' },
    { path: '/driver/active', label: 'Active Job', icon: '🚚' },
    { path: '/driver/history', label: 'History', icon: '📋' },
    { path: '/driver/earnings', label: 'Earnings', icon: '💰' },
  ];

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>Driver Panel</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default DriverSidebar;
