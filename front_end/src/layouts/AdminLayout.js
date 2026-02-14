import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import '../styles/layouts/AdminLayout.css';

const AdminLayout = () => {
  return (
    <div className="admin-layout">
      <Navbar />
      <div className="admin-container">
        <Sidebar />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
