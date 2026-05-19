import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import WarehouseStaffSidebar from './WarehouseStaffSidebar';
import '../styles/layouts/WarehouseStaffLayout.css';

const WarehouseStaffLayout = () => {
  return (
    <div className="ws-layout">
      <Navbar />
      <div className="ws-layout-body">
        <WarehouseStaffSidebar />
        <main className="ws-layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default WarehouseStaffLayout;
