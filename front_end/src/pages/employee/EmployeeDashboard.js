import { tUi } from "../../i18n/uiText";import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/pages/employee/EmployeeDashboard.css';

const EmployeeDashboard = () => {
  return (
    <div className="employee-dashboard">
      <h1>{tUi("ui.pages.employee.employeeDashboard.employeeDashboard_e03cbd4a9e")}</h1>
      <div className="dashboard-cards">
        <Link to="/employee/tickets" className="dashboard-card">
          <div className="card-icon">🎫</div>
          <h2>{tUi("ui.pages.employee.employeeDashboard.viewTickets_5397bf72c4")}</h2>
          <p>{tUi("ui.pages.employee.employeeDashboard.viewAndManageYourAssigned_540b3937a6")}</p>
        </Link>
      </div>
    </div>);

};

export default EmployeeDashboard;
