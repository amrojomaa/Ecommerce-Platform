import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from '../components/ChatWidget';
import CustomerFeedbackPopup from '../components/CustomerFeedbackPopup';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { getRoleDashboardPath } from '../utils/roleDashboard';
import '../styles/layouts/MainLayout.css';

const MainLayout = () => {
  const location = useLocation();
  const { isAuthenticated, loading, user } = useAuth();

  const hideChatWidget = [
    '/login',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/verify-reset-code',
    '/reset-password',
  ].includes(location.pathname);

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const isProfilePage = location.pathname === '/profile';
  const dashboardPath = getRoleDashboardPath(user?.role);

  if (!isProfilePage && isAuthenticated && dashboardPath) {
    return <Navigate to={dashboardPath} replace />;
  }

  return (
    <div className="main-layout">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
      {!hideChatWidget && <ChatWidget />}
      <CustomerFeedbackPopup />
    </div>
  );
};

export default MainLayout;
