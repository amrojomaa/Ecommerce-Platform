import React, { useState, useEffect } from 'react';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/driver/DriverJobHistory.css';

const DriverJobHistory = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await http.get(DELIVERY_ENDPOINTS.JOB_HISTORY);
        setJobs(response.data);
      } catch (error) {
        console.error('Error fetching job history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="job-history-page">
      <div className="history-header">
        <h1>Delivery History</h1>
        <div className="history-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'delivered' ? 'active' : ''}`}
            onClick={() => setFilter('delivered')}
          >
            Delivered
          </button>
          <button
            className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled
          </button>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="no-history">
          <div className="no-history-icon">📋</div>
          <h2>No Deliveries Yet</h2>
          <p>Your completed deliveries will appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {filteredJobs.map((job) => (
            <div key={job.id} className="history-card">
              <div className="history-card-header">
                <div className="history-order-info">
                  <span className="history-order-id">Order #{job.order_id}</span>
                  <span className="history-date">
                    {new Date(job.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="history-right">
                  <span className={`history-status-badge ${job.status}`}>
                    {job.status === 'delivered' ? '✅ Delivered' : '❌ Cancelled'}
                  </span>
                  <span className="history-amount">${job.payment_amount.toFixed(2)}</span>
                </div>
              </div>
              <div className="history-card-body">
                <div className="history-route">
                  <div className="route-point">
                    <span className="route-dot pickup-dot" />
                    <span>{job.pickup_address || 'Pickup location'}</span>
                  </div>
                  <div className="route-line" />
                  <div className="route-point">
                    <span className="route-dot delivery-dot" />
                    <span>{job.delivery_address || 'Delivery location'}</span>
                  </div>
                </div>
                {job.customer && (
                  <div className="history-customer">
                    👤 {job.customer.first_name} {job.customer.last_name}
                  </div>
                )}
                {job.items && job.items.length > 0 && (
                  <div className="history-items">
                    {job.items.map((item, idx) => (
                      <span key={idx} className="history-item-tag">
                        {item.product?.name} x{item.quantity}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {job.issue_description && (
                <div className="history-issue">
                  ⚠️ Issue reported: {job.issue_description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverJobHistory;
