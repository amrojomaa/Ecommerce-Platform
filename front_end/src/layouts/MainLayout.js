import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from '../components/ChatWidget';
import '../styles/layouts/MainLayout.css';

const MainLayout = () => {
  const location = useLocation();
  
  // Hide AI assistant on login, signup, and auth-related pages
  const hideChatWidget = [
    '/login',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/verify-reset-code',
    '/reset-password'
  ].includes(location.pathname);

  return (
    <div className="main-layout">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
      {!hideChatWidget && <ChatWidget />}
    </div>
  );
};

export default MainLayout;
