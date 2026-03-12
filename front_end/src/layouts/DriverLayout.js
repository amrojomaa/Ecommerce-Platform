import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import DriverSidebar from './DriverSidebar';
import '../styles/layouts/DriverLayout.css';

const DriverLayout = () => {
  return (
    <div className="driver-layout">
      <Navbar />
      <div className="driver-container">
        <DriverSidebar />
        <main className="driver-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DriverLayout;
