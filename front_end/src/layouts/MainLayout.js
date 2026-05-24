import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from '../components/ChatWidget';
import CustomerFeedbackPopup from '../components/CustomerFeedbackPopup';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import '../styles/layouts/MainLayout.css';

const MainLayout = () => {
  const location = useLocation();
  const { isAuthenticated, isAdmin, isDriver, isWarehouseManager, loading, user } = useAuth();
  
  // Hide AI assistant on login, signup, and auth-related pages
  const hideChatWidget = [
    '/login',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/verify-reset-code',
    '/reset-password'
  ].includes(location.pathname);

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const isProfilePage = location.pathname === '/profile';

  if (!isProfilePage && isAuthenticated && user?.role === 'cashier') {
    return <Navigate to="/cashier" replace />;
  }

  if (!isProfilePage && isAuthenticated && isAdmin && typeof isAdmin === 'function' && isAdmin()) {
    return <Navigate to="/admin" replace />;
  }

  if (!isProfilePage && isAuthenticated && isDriver && typeof isDriver === 'function' && isDriver()) {
    return <Navigate to="/driver" replace />;
  }

  if (!isProfilePage && isAuthenticated && isWarehouseManager && typeof isWarehouseManager === 'function' && isWarehouseManager()) {
    return <Navigate to="/warehouse" replace />;
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
