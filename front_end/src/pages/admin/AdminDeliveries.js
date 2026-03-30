import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS } from '../../config/api';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/admin/AdminDeliveries.css';

const AdminDeliveries = () => {
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (allJobs.length > 0) {
      if (statusFilter === 'all') {
        setJobs(allJobs);
      } else {
        const filtered = allJobs.filter(job =>
          (job.status || '').toLowerCase() === statusFilter.toLowerCase()
        );
        setJobs(filtered);
      }
    } else {
      setJobs([]);
    }
  }, [statusFilter, allJobs]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
      const data = Array.isArray(response.data) ? response.data : [];
      setAllJobs(data);
    } catch (error) {
      console.error('Error fetching delivery jobs:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch delivery jobs';
      setError(errorMessage);
      setAllJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const deliveryStatuses = ['all', 'available', 'assigned', 'picked_up', 'delivering', 'delivered', 'cancelled'];

  const getStatusLabel = (status) => {
    const labels = {
      available: 'Available',
      assigned: 'Assigned',
      picked_up: 'Picked Up',
      delivering: 'Delivering',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="admin-deliveries-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-deliveries">
      <div className="admin-deliveries-header">
        <h1>Delivery Management</h1>
        <div className="deliveries-filter">
          <label htmlFor="delivery-status-filter">Filter by Status:</label>
          <select
            id="delivery-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter-select"
          >
            {deliveryStatuses.map(status => (
              <option key={status} value={status}>
                {status === 'all' ? 'All' : getStatusLabel(status)}
              </option>
            ))}
          </select>
          {statusFilter !== 'all' && (
            <span className="filter-count">
              ({jobs.length} {jobs.length === 1 ? 'job' : 'jobs'})
            </span>
          )}
        </div>
      </div>

      {error ? (
        <motion.div
          className="error-message"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '20px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '8px',
            margin: '20px 0'
          }}
        >
          <p><strong>Error:</strong> {error}</p>
          <button onClick={fetchJobs} className="retry-btn">Retry</button>
        </motion.div>
      ) : jobs.length === 0 ? (
        <motion.div
          className="empty-deliveries"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>
            {statusFilter === 'all'
              ? 'No delivery jobs found.'
              : `No delivery jobs with status "${getStatusLabel(statusFilter)}".`}
          </p>
          {statusFilter !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="show-all-btn">
              Show All Jobs
            </button>
          )}
        </motion.div>
      ) : (
        <div className="deliveries-table-container">
          <table className="deliveries-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Order ID</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Payment</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => (
                <React.Fragment key={job.id}>
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`delivery-row ${expandedJobId === job.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>#{job.id}</td>
                    <td>#{job.order_id}</td>
                    <td>{job.driver_name || <span className="no-driver">Unassigned</span>}</td>
                    <td>
                      <span className={`delivery-status status-${job.status}`}>
                        {getStatusLabel(job.status)}
                      </span>
                    </td>
                    <td className="address-cell">{job.pickup_address || 'N/A'}</td>
                    <td className="address-cell">{job.delivery_address || 'N/A'}</td>
                    <td className="payment-cell">${job.payment_amount?.toFixed(2) || '0.00'}</td>
                    <td>{formatDate(job.created_at)}</td>
                  </motion.tr>
                  {expandedJobId === job.id && (
                    <tr className="expanded-row">
                      <td colSpan="8">
                        <div className="job-expanded-details">
                          <div className="expanded-grid">
                            <div className="detail-card">
                              <h4>📦 Pickup</h4>
                              <p>{job.pickup_address || 'N/A'}</p>
                              {job.pickup_latitude && (
                                <p className="coords">({job.pickup_latitude?.toFixed(4)}, {job.pickup_longitude?.toFixed(4)})</p>
                              )}
                            </div>
                            <div className="detail-card">
                              <h4>📍 Delivery</h4>
                              <p>{job.delivery_address || 'N/A'}</p>
                              {job.delivery_latitude && (
                                <p className="coords">({job.delivery_latitude?.toFixed(4)}, {job.delivery_longitude?.toFixed(4)})</p>
                              )}
                            </div>
                            <div className="detail-card">
                              <h4>👤 Customer</h4>
                              {job.customer ? (
                                <p>{job.customer.first_name} {job.customer.last_name}
                                  {job.customer.phone && ` • ${job.customer.phone}`}
                                </p>
                              ) : (
                                <p>N/A</p>
                              )}
                            </div>
                            <div className="detail-card">
                              <h4>🚚 Driver</h4>
                              <p>{job.driver_name || 'Not assigned'}</p>
                            </div>
                          </div>
                          {job.issue_type && (
                            <div className="issue-alert">
                              <strong>⚠️ Issue Reported:</strong> {job.issue_type.replace(/_/g, ' ')}
                              {job.issue_description && <p>{job.issue_description}</p>}
                            </div>
                          )}
                          {job.items && job.items.length > 0 && (
                            <div className="expanded-items">
                              <h4>Items</h4>
                              <div className="items-list">
                                {job.items.map((item, idx) => (
                                  <span key={idx} className="item-tag">
                                    {item.product?.name} x{item.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDeliveries;
