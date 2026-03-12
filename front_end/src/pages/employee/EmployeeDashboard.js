import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/pages/employee/EmployeeDashboard.css';

const EmployeeDashboard = () => {
  return (
    <div className="employee-dashboard">
      <h1>Employee Dashboard</h1>
      <div className="dashboard-cards">
        <Link to="/employee/tickets" className="dashboard-card">
          <div className="card-icon">🎫</div>
          <h2>View Tickets</h2>
          <p>View and manage your assigned tickets</p>
        </Link>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
