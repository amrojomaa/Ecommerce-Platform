import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/driver/DriverDashboard.css';

const DriverDashboard = () => {
  const { formatCurrency } = useCurrency();
  const [earnings, setEarnings] = useState(null);
  const [activeJobs, setActiveJobs] = useState([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [earningsRes, activeRes, availableRes] = await Promise.all([
          http.get(DELIVERY_ENDPOINTS.EARNINGS),
          http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS),
          http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS),
        ]);
        setEarnings(earningsRes.data);
        setActiveJobs(activeRes.data);
        setAvailableCount(availableRes.data.length);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="driver-dashboard">
      <h1>Driver Dashboard</h1>
      
      <div className="dashboard-stats">
        <div className="stat-card earnings-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(earnings?.today || 0)}</span>
            <span className="stat-label">Today's Earnings</span>
          </div>
        </div>
        <div className="stat-card active-card">
          <div className="stat-icon">🚚</div>
          <div className="stat-info">
            <span className="stat-value">{activeJobs.length}</span>
            <span className="stat-label">Active Deliveries</span>
          </div>
        </div>
        <div className="stat-card available-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <span className="stat-value">{availableCount}</span>
            <span className="stat-label">Available Jobs</span>
          </div>
        </div>
        <div className="stat-card total-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(earnings?.this_month || 0)}</span>
            <span className="stat-label">This Month</span>
          </div>
        </div>
      </div>

      <div className="dashboard-cards">
        <Link to="/driver/map" className="dashboard-card">
          <div className="card-icon">🗺️</div>
          <h2>Find Jobs</h2>
          <p>View available delivery requests on the map</p>
        </Link>
        <Link to="/driver/active" className="dashboard-card">
          <div className="card-icon">🚚</div>
          <h2>Active Delivery</h2>
          <p>Track and manage your current delivery</p>
        </Link>
        <Link to="/driver/history" className="dashboard-card">
          <div className="card-icon">📋</div>
          <h2>Delivery History</h2>
          <p>View your completed deliveries</p>
        </Link>
        <Link to="/driver/earnings" className="dashboard-card">
          <div className="card-icon">💰</div>
          <h2>Earnings</h2>
          <p>Track earnings and request payouts</p>
        </Link>
      </div>

      {activeJobs.length > 0 && (
        <div className="active-deliveries-section">
          <h2>Current Deliveries</h2>
          <div className="active-jobs-list">
            {activeJobs.map((job) => (
              <Link to="/driver/active" key={job.id} className="active-job-card">
                <div className="job-status-badge">{job.status.replace('_', ' ')}</div>
                <div className="job-details">
                  <span className="job-id">Order #{job.order_id}</span>
                  <span className="job-address">{job.delivery_address || 'N/A'}</span>
                  <span className="job-amount">{formatCurrency(job.payment_amount || 0)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
