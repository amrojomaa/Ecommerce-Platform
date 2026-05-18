import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import { useDeliveryIssueCount } from '../hooks/useDeliveryIssueCount';
import { useDeliveryPhotoCount } from '../hooks/useDeliveryPhotoCount';
import '../styles/layouts/Sidebar.css';

const ADMIN_MENU_ITEMS = [
{ path: '/admin', labelKey: 'ui.sidebar.menu.dashboard', icon: '📊' },
{ path: '/admin/products', labelKey: 'ui.sidebar.menu.products', icon: '📦' },
{ path: '/admin/promotions', labelKey: 'ui.sidebar.menu.promotions', icon: '🎯' },
{ path: '/admin/discounts', labelKey: 'ui.sidebar.menu.discounts', icon: '🏷️' },
{ path: '/admin/categories', labelKey: 'ui.sidebar.menu.categories', icon: '🏷️' },
{ path: '/admin/orders', labelKey: 'ui.sidebar.menu.orders', icon: '📋' },
{ path: '/admin/installments', labelKey: 'ui.sidebar.menu.installments', icon: '💳' },
{ path: '/admin/deliveries', labelKey: 'ui.sidebar.menu.deliveries', icon: '🚚' },
{ path: '/admin/users', labelKey: 'ui.sidebar.menu.users', icon: '👥' },
{ path: '/admin/tickets', labelKey: 'ui.sidebar.menu.tickets', icon: '🎫' },
{ path: '/admin/comments', labelKey: 'ui.sidebar.menu.reviews', icon: '💬' },
{ path: '/admin/feedback', labelKey: 'ui.sidebar.menu.feedback', icon: '⭐' }];


const OPERATIONS_MANAGER_MENU_ITEMS = [
{ path: '/admin/orders', labelKey: 'ui.sidebar.menu.orders', icon: '📋' },
{ path: '/admin/installments', labelKey: 'ui.sidebar.menu.installments', icon: '💳' },
{ path: '/admin/deliveries', labelKey: 'ui.sidebar.menu.deliveries', icon: '🚚' }];


const SUPPORT_MANAGER_MENU_ITEMS = [
{ path: '/support', labelKey: 'ui.sidebar.menu.dashboard', icon: '📊' },
{ path: '/support/tickets', labelKey: 'ui.sidebar.menu.tickets', icon: '🎫' },
{ path: '/support/comments', labelKey: 'ui.sidebar.menu.reviews', icon: '💬' },
{ path: '/support/feedback', labelKey: 'ui.sidebar.menu.feedback', icon: '⭐' }];


const WAREHOUSE_MANAGER_MENU_ITEMS = [
{ path: '/warehouse/products', labelKey: 'ui.sidebar.menu.products', icon: '📦' }];


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
  const { t } = useTranslation();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useUnreadTickets();
  const { issueCount } = useDeliveryIssueCount();
  const { photoCount } = useDeliveryPhotoCount();
  const availableMenuItems = useMemo(
    () => {
      if (user?.role === 'operations_manager') return OPERATIONS_MANAGER_MENU_ITEMS;
      if (user?.role === 'support_manager') return SUPPORT_MANAGER_MENU_ITEMS;
      if (user?.role === 'warehouse_manager') return WAREHOUSE_MANAGER_MENU_ITEMS;
      return ADMIN_MENU_ITEMS;
    },
    [user?.role]
  );
  const [menuItems, setMenuItems] = useState(availableMenuItems);
  const [draggedPath, setDraggedPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  const deliveriesNotificationCount = issueCount + photoCount;

  useEffect(() => {
    const menuByPath = new Map(availableMenuItems.map((item) => [item.path, item]));
    const storageKey = getStorageKey(user?.id);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setMenuItems(availableMenuItems);
      return;
    }

    try {
      const orderedPaths = JSON.parse(raw);
      if (!Array.isArray(orderedPaths)) {
        setMenuItems(availableMenuItems);
        return;
      }

      const restored = orderedPaths
      .map((path) => menuByPath.get(path))
      .filter(Boolean);
      const missing = availableMenuItems.filter(
        (item) => !restored.some((existing) => existing.path === item.path)
      );
      setMenuItems([...restored, ...missing]);
    } catch {
      setMenuItems(availableMenuItems);
    }
  }, [availableMenuItems, user?.id]);

  useEffect(() => {
    const storageKey = getStorageKey(user?.id);
    localStorage.setItem(
      storageKey,
      JSON.stringify(menuItems.map((item) => item.path))
    );
  }, [menuItems, user?.id]);

  const dragHint = useMemo(
    () => t('ui.sidebar.reorderHint'),
    [t]
  );

  const panelTitle = useMemo(() => {
    if (user?.role === 'operations_manager') return 'ui.sidebar.panel.operations';
    if (user?.role === 'support_manager') return 'ui.sidebar.panel.support';
    if (user?.role === 'warehouse_manager') return 'ui.sidebar.panel.warehouse';
    return 'ui.sidebar.panel.admin';
  }, [user?.role]);

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
        <h2>
          {t(panelTitle)}
        </h2>
        <p className="sidebar-reorder-hint">{dragHint}</p>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isTickets = item.path === '/admin/tickets' || item.path === '/support/tickets';
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
              onDragEnd={handleDragEnd}>
              
              <Link
                to={item.path}
                className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                draggable={false}>
                
                <span className="sidebar-drag-handle" aria-hidden="true">⋮⋮</span>
                <span className="sidebar-icon">{item.icon}</span>
                <span>{t(item.labelKey)}</span>
                {isTickets && unreadCount > 0 &&
                <span className="sidebar-badge">{unreadCount}</span>
                }
                {isDeliveries && deliveriesNotificationCount > 0 &&
                <span className="sidebar-badge sidebar-badge-deliveries">{deliveriesNotificationCount}</span>
                }
              </Link>
            </div>);

        })}
      </nav>
    </aside>);

};

export default Sidebar;
