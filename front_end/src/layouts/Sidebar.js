import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import { useDeliveryIssueCount } from '../hooks/useDeliveryIssueCount';
import { useDeliveryPhotoCount } from '../hooks/useDeliveryPhotoCount';
import '../styles/layouts/Sidebar.css';

const DEFAULT_MENU_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: '📊' },
  { path: '/admin/products', label: 'Products', icon: '📦' },
  { path: '/admin/promotions', label: 'Promotions', icon: '🎯' },
  { path: '/admin/discounts', label: 'Discounts', icon: '🏷️' },
  { path: '/admin/categories', label: 'Categories', icon: '🏷️' },
  { path: '/admin/orders', label: 'Orders', icon: '📋' },
  { path: '/admin/deliveries', label: 'Deliveries', icon: '🚚' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/tickets', label: 'Tickets', icon: '🎫' },
  { path: '/admin/comments', label: 'Reviews', icon: '💬' },
];

const getStorageKey = (userId) => `admin-sidebar-order:${userId || 'default'}`;

const reorderMenuItems = (items, sourcePath, targetPath) => {
  const sourceIndex = items.findIndex((item) => item.path === sourcePath);
  const targetIndex = items.findIndex((item) => item.path === targetPath);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const Sidebar = () => {
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useUnreadTickets();
  const { issueCount } = useDeliveryIssueCount();
  const { photoCount } = useDeliveryPhotoCount();
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU_ITEMS);
  const [draggedPath, setDraggedPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  const deliveriesNotificationCount = issueCount + photoCount;

  useEffect(() => {
    const menuByPath = new Map(DEFAULT_MENU_ITEMS.map((item) => [item.path, item]));
    const storageKey = getStorageKey(user?.id);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setMenuItems(DEFAULT_MENU_ITEMS);
      return;
    }

    try {
      const orderedPaths = JSON.parse(raw);
      if (!Array.isArray(orderedPaths)) {
        setMenuItems(DEFAULT_MENU_ITEMS);
        return;
      }

      const restored = orderedPaths
        .map((path) => menuByPath.get(path))
        .filter(Boolean);
      const missing = DEFAULT_MENU_ITEMS.filter(
        (item) => !restored.some((existing) => existing.path === item.path)
      );
      setMenuItems([...restored, ...missing]);
    } catch {
      setMenuItems(DEFAULT_MENU_ITEMS);
    }
  }, [user?.id]);

  useEffect(() => {
    const storageKey = getStorageKey(user?.id);
    localStorage.setItem(
      storageKey,
      JSON.stringify(menuItems.map((item) => item.path))
    );
  }, [menuItems, user?.id]);

  const dragHint = useMemo(
    () => 'Drag and drop to reorder menu',
    []
  );

  const handleDragStart = (event, path) => {
    setDraggedPath(path);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', path);
  };

  const handleDragOver = (event, path) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverPath !== path) {
      setDragOverPath(path);
    }
  };

  const handleDrop = (event, targetPath) => {
    event.preventDefault();
    const sourcePath = draggedPath || event.dataTransfer.getData('text/plain');
    if (!sourcePath || sourcePath === targetPath) {
      setDraggedPath(null);
      setDragOverPath(null);
      return;
    }

    setMenuItems((prev) => reorderMenuItems(prev, sourcePath, targetPath));
    setDraggedPath(null);
    setDragOverPath(null);
  };

  const handleDragEnd = () => {
    setDraggedPath(null);
    setDragOverPath(null);
  };

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <h2>Admin Panel</h2>
        <p className="sidebar-reorder-hint">{dragHint}</p>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isTickets = item.path === '/admin/tickets';
          const isDeliveries = item.path === '/admin/deliveries';
          const isDragging = draggedPath === item.path;
          const isDragOver = dragOverPath === item.path && draggedPath !== item.path;
          return (
            <div
              key={item.path}
              className={`sidebar-item-row ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
              draggable
              onDragStart={(event) => handleDragStart(event, item.path)}
              onDragOver={(event) => handleDragOver(event, item.path)}
              onDrop={(event) => handleDrop(event, item.path)}
              onDragEnd={handleDragEnd}
            >
              <Link
                to={item.path}
                className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                draggable={false}
              >
                <span className="sidebar-drag-handle" aria-hidden="true">⋮⋮</span>
                <span className="sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
                {isTickets && unreadCount > 0 && (
                  <span className="sidebar-badge">{unreadCount}</span>
                )}
                {isDeliveries && deliveriesNotificationCount > 0 && (
                  <span className="sidebar-badge sidebar-badge-deliveries">{deliveriesNotificationCount}</span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
