import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { CashierPosProvider } from '../context/CashierPosContext';
import '../styles/layouts/CashierLayout.css';

const CashierLayout = () => {
  return (
    <CashierPosProvider>
      <div className="cashier-layout">
        <Navbar />
        <main className="cashier-content">
          <Outlet />
        </main>
      </div>
    </CashierPosProvider>
  );
};

export default CashierLayout;
