import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import SellerSidebar from './SellerSidebar';
import '../styles/layouts/SellerLayout.css';

const SellerLayout = () => {
  return (
    <div className="seller-layout">
      <Navbar />
      <div className="seller-layout-body">
        <SellerSidebar />
        <main className="seller-layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SellerLayout;
