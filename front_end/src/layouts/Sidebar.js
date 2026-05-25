import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useUnreadTickets } from '../hooks/useUnreadTickets';
import { useDeliveryIssueCount } from '../hooks/useDeliveryIssueCount';
import { useDeliveryPhotoCount } from '../hooks/useDeliveryPhotoCount';
import SidebarMenuIcon, { SidebarPanelBrandIcon } from '../components/SidebarMenuIcon';
import '../styles/layouts/Sidebar.css';

const ADMIN_MENU_ITEMS = [
  { path: '/admin', labelKey: 'ui.sidebar.menu.dashboard', icon: 'dashboard' },
  { path: '/admin/products', labelKey: 'ui.sidebar.menu.products', icon: 'products' },
  { path: '/admin/promotions', labelKey: 'ui.sidebar.menu.promotions', icon: 'promotions' },
  { path: '/admin/discounts', labelKey: 'ui.sidebar.menu.discounts', icon: 'discounts' },
  { path: '/admin/categories', labelKey: 'ui.sidebar.menu.categories', icon: 'categories' },
  { path: '/admin/orders', labelKey: 'ui.sidebar.menu.orders', icon: 'orders' },
  { path: '/admin/installments', labelKey: 'ui.sidebar.menu.installments', icon: 'installments' },
  { path: '/admin/deliveries', labelKey: 'ui.sidebar.menu.deliveries', icon: 'deliveries' },
  { path: '/admin/users', labelKey: 'ui.sidebar.menu.users', icon: 'users' },
  { path: '/admin/tickets', labelKey: 'ui.sidebar.menu.tickets', icon: 'tickets' },
  { path: '/admin/comments', labelKey: 'ui.sidebar.menu.reviews', icon: 'reviews' },
  { path: '/admin/feedback', labelKey: 'ui.sidebar.menu.feedback', icon: 'feedback' },
];

const OPERATIONS_MANAGER_MENU_ITEMS = [
  { path: '/admin/orders', labelKey: 'ui.sidebar.menu.orders', icon: 'orders' },
  { path: '/admin/installments', labelKey: 'ui.sidebar.menu.installments', icon: 'installments' },
  { path: '/admin/deliveries', labelKey: 'ui.sidebar.menu.deliveries', icon: 'deliveries' },
];

const SUPPORT_MANAGER_MENU_ITEMS = [
  { path: '/support', labelKey: 'ui.sidebar.menu.dashboard', icon: 'dashboard' },
  { path: '/support/tickets', labelKey: 'ui.sidebar.menu.tickets', icon: 'tickets' },
  { path: '/support/comments', labelKey: 'ui.sidebar.menu.reviews', icon: 'reviews' },
  { path: '/support/feedback', labelKey: 'ui.sidebar.menu.feedback', icon: 'feedback' },
];

const WAREHOUSE_MANAGER_MENU_ITEMS = [
  { path: '/warehouse', labelKey: 'ui.sidebar.menu.dashboard', icon: 'dashboard' },
  { path: '/warehouse/inventory', labelKey: 'ui.sidebar.menu.warehouseInventory', icon: 'warehouseInventory' },
  { path: '/warehouse/approvals', labelKey: 'ui.sidebar.menu.warehouseApprovals', icon: 'warehouseApprovals' },
  { path: '/warehouse/issues', labelKey: 'ui.sidebar.menu.warehouseIssues', icon: 'warehouseIssues' },
];

const SELLER_MENU_ITEMS = [
  { path: '/seller', labelKey: 'ui.sidebar.menu.dashboard', icon: 'dashboard' },
  { path: '/seller/products', labelKey: 'ui.sidebar.menu.products', icon: 'products' },
  { path: '/seller/categories', labelKey: 'ui.sidebar.menu.categories', icon: 'categories' },
  { path: '/seller/promotions', labelKey: 'ui.sidebar.menu.promotions', icon: 'promotions' },
  { path: '/seller/orders', labelKey: 'ui.sidebar.menu.orders', icon: 'orders' },
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
      if (user?.role === 'seller') return SELLER_MENU_ITEMS;
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
    if (user?.role === 'seller') return 'ui.sidebar.panel.seller';
    return 'ui.sidebar.panel.admin';
  }, [user?.role]);

  const panelBrandKey = useMemo(() => {
    if (user?.role === 'operations_manager') return 'operations';
    if (user?.role === 'support_manager') return 'support';
    if (user?.role === 'warehouse_manager') return 'warehouse';
    if (user?.role === 'seller') return 'seller';
    return 'admin';
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
        <div className="sidebar-brand">
          <SidebarPanelBrandIcon panelKey={panelBrandKey} />
          <div className="sidebar-brand-copy">
            <h2>{t(panelTitle)}</h2>
            <p className="sidebar-reorder-hint">{dragHint}</p>
          </div>
        </div>
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
                <SidebarMenuIcon name={item.icon} />
                <span className="sidebar-link-label">{t(item.labelKey)}</span>
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
