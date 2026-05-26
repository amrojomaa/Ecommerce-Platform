import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import SidebarMenuIcon, { SidebarPanelBrandIcon } from '../components/SidebarMenuIcon';
import '../styles/layouts/Sidebar.css';

const DRIVER_MENU_ITEMS = [
  { path: '/driver', labelKey: 'ui.sidebar.menu.dashboard', icon: 'dashboard' },
  { path: '/driver/map', labelKey: 'ui.sidebar.menu.findJobs', icon: 'findJobs' },
  { path: '/driver/active', labelKey: 'ui.sidebar.menu.activeJob', icon: 'activeJob' },
  { path: '/driver/history', labelKey: 'ui.sidebar.menu.history', icon: 'history' },
];

const getStorageKey = (userId) => `driver-sidebar-order:${userId || 'default'}`;

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

const DriverSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState(DRIVER_MENU_ITEMS);
  const [draggedPath, setDraggedPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);

  useEffect(() => {
    const menuByPath = new Map(DRIVER_MENU_ITEMS.map((item) => [item.path, item]));
    const storageKey = getStorageKey(user?.id);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setMenuItems(DRIVER_MENU_ITEMS);
      return;
    }

    try {
      const orderedPaths = JSON.parse(raw);
      if (!Array.isArray(orderedPaths)) {
        setMenuItems(DRIVER_MENU_ITEMS);
        return;
      }

      const restored = orderedPaths
        .map((path) => menuByPath.get(path))
        .filter(Boolean);
      const missing = DRIVER_MENU_ITEMS.filter(
        (item) => !restored.some((existing) => existing.path === item.path)
      );
      setMenuItems([...restored, ...missing]);
    } catch {
      setMenuItems(DRIVER_MENU_ITEMS);
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
    () => t('ui.sidebar.reorderHint'),
    [t]
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

  const isActivePath = (path) => location.pathname === path;

  return (
    <aside className={`sidebar ${isDarkMode ? 'dark' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <SidebarPanelBrandIcon panelKey="driver" />
          <div className="sidebar-brand-copy">
            <h2>{t('ui.sidebar.panel.driver')}</h2>
            <p className="sidebar-reorder-hint">{dragHint}</p>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
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
                className={`sidebar-link ${isActivePath(item.path) ? 'active' : ''}`}
                draggable={false}>
                <span className="sidebar-drag-handle" aria-hidden="true">⋮⋮</span>
                <SidebarMenuIcon name={item.icon} />
                <span className="sidebar-link-label">{t(item.labelKey)}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default DriverSidebar;
