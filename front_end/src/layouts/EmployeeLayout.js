import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import EmployeeSidebar from './EmployeeSidebar';
import '../styles/layouts/EmployeeLayout.css';

const EmployeeLayout = () => {
  return (
    <div className="employee-layout">
      <Navbar />
      <div className="employee-container">
        <EmployeeSidebar />
        <main className="employee-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default EmployeeLayout;
