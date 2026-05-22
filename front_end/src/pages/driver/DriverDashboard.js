import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
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
        http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS)]
        );
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
      <div className="page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const dashboardTitle = tUi('ui.pages.driver.driverDashboard.driverDashboard_6764ab49f0');

  return (
    <div className="page-shell driver-dashboard">
      <PageHeader kicker={dashboardTitle} title={dashboardTitle} />
      
      <div className="dashboard-stats">
        <div className="stat-card earnings-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(earnings?.today || 0)}</span>
            <span className="stat-label">{tUi("ui.pages.driver.driverDashboard.todaySEarnings_6557872ed4")}</span>
          </div>
        </div>
        <div className="stat-card active-card">
          <div className="stat-icon">🚚</div>
          <div className="stat-info">
            <span className="stat-value">{activeJobs.length}</span>
            <span className="stat-label">{tUi("ui.pages.driver.driverDashboard.activeDeliveries_b212236f76")}</span>
          </div>
        </div>
        <div className="stat-card available-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <span className="stat-value">{availableCount}</span>
            <span className="stat-label">{tUi("ui.pages.driver.driverDashboard.availableJobs_cc23afe56a")}</span>
          </div>
        </div>
        <div className="stat-card total-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(earnings?.this_month || 0)}</span>
            <span className="stat-label">{tUi("ui.pages.driver.driverDashboard.thisMonth_3801c1bfca")}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-cards">
        <Link to="/driver/map" className="dashboard-card">
          <div className="card-icon">🗺️</div>
          <h2>{tUi("ui.pages.driver.driverDashboard.findJobs_d0c3b5a149")}</h2>
          <p>{tUi("ui.pages.driver.driverDashboard.viewAvailableDeliveryRequestsOn_aa9ad5470b")}</p>
        </Link>
        <Link to="/driver/active" className="dashboard-card">
          <div className="card-icon">🚚</div>
          <h2>{tUi("ui.pages.driver.driverDashboard.activeDelivery_dbf7ad5b46")}</h2>
          <p>{tUi("ui.pages.driver.driverDashboard.trackAndManageYourCurrent_e78d8342ac")}</p>
        </Link>
        <Link to="/driver/history" className="dashboard-card">
          <div className="card-icon">📋</div>
          <h2>{tUi("ui.pages.driver.driverDashboard.deliveryHistory_853624d313")}</h2>
          <p>{tUi("ui.pages.driver.driverDashboard.viewYourCompletedDeliveries_5595c582d7")}</p>
        </Link>
        <Link to="/driver/earnings" className="dashboard-card">
          <div className="card-icon">💰</div>
          <h2>{tUi("ui.pages.driver.driverDashboard.earnings_5bb4b61373")}</h2>
          <p>{tUi("ui.pages.driver.driverDashboard.trackEarningsAndRequestPayouts_695783d44b")}</p>
        </Link>
      </div>

      {activeJobs.length > 0 &&
      <div className="active-deliveries-section">
          <h2>{tUi("ui.pages.driver.driverDashboard.currentDeliveries_54f80c8ed4")}</h2>
          <div className="active-jobs-list">
            {activeJobs.map((job) =>
          <Link to="/driver/active" key={job.id} className="active-job-card">
                <div className="job-status-badge">{job.status.replace('_', ' ')}</div>
                <div className="job-details">
                  <span className="job-id">{tUi("ui.pages.driver.driverDashboard.order_de54b2e674")}{job.order_id}</span>
                  <span className="job-address">{job.delivery_address || tUi("ui.pages.driver.driverDashboard.nA_b209613603")}</span>
                  <span className="job-amount">{formatCurrency(job.payment_amount || 0)}</span>
                </div>
              </Link>
          )}
          </div>
        </div>
      }
    </div>);

};

export default DriverDashboard;
