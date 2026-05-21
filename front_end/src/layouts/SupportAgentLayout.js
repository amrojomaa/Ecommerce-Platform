import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import SupportAgentSidebar from './SupportAgentSidebar';
import '../styles/layouts/SupportAgentLayout.css';

const SupportAgentLayout = () => {
  return (
    <div className="SupportAgent-layout">
      <Navbar />
      <div className="SupportAgent-container">
        <SupportAgentSidebar />
        <main className="SupportAgent-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SupportAgentLayout;
