import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import http from '../../services/http';
import { WAREHOUSE_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/pages/warehouse-staff/WarehouseStaffDashboard.css';

const WarehouseStaffDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ preparingCount: 0, packedCount: 0 });
  const [preparingOrders, setPreparingOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prepRes, packedRes] = await Promise.all([
        http.get(WAREHOUSE_ENDPOINTS.PREPARING_ORDERS),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_ORDERS),
      ]);

      const preparing = Array.isArray(prepRes.data) ? prepRes.data : [];
      const packed = Array.isArray(packedRes.data) ? packedRes.data : [];

      setPreparingOrders(preparing.slice(0, 6));
      setStats({
        preparingCount: preparing.length,
        packedCount: packed.length,
      });
    } catch (error) {
      console.error('Error fetching warehouse dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="ws-dashboard-loading"><LoadingSpinner size="large" /></div>;
  }

  const statCards = [
    { title: 'Orders to Pack', value: stats.preparingCount, icon: '📋', color: '#f59e0b' },
    { title: 'Packed / Done', value: stats.packedCount, icon: '✅', color: '#16a34a' },
  ];

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="ws-dashboard">
      <h1>Warehouse Dashboard</h1>

      <div className="ws-stats-grid">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            className="ws-stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => navigate('/warehouse-staff/orders')}
          >
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}18` }}>
              <span>{stat.icon}</span>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.title}</div>
          </motion.div>
        ))}
      </div>

      <div className="ws-queue-section">
        <h2>📋 Packing Queue</h2>
        {preparingOrders.length === 0 ? (
          <div className="ws-empty-state">
            <div className="empty-icon">✅</div>
            <p>No orders waiting to be packed</p>
          </div>
        ) : (
          <div className="ws-queue-cards">
            {preparingOrders.map((order, index) => (
              <motion.div
                key={order.id}
                className="ws-queue-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate('/warehouse-staff/orders')}
              >
                <div className="ws-queue-card-header">
                  <span className="order-id">Order #{order.id}</span>
                  <span className="item-count">{order.items?.length || 0} items</span>
                </div>
                <div className="ws-queue-card-info">
                  {order.user?.email || 'Customer'}
                </div>
                <div className="ws-queue-card-info">
                  {formatDate(order.created_at)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WarehouseStaffDashboard;
