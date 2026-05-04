import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import CashierSidebar from './CashierSidebar';
import '../styles/layouts/CashierLayout.css';

const CashierLayout = () => {
  return (
    <div className="cashier-layout">
      <Navbar />
      <div className="cashier-container">
        <CashierSidebar />
        <main className="cashier-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CashierLayout;
