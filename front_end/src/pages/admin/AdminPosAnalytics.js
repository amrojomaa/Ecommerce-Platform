import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { POS_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminDashboard.css';

const AdminPosAnalytics = () => {
  const { formatCurrency } = useCurrency();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const { data } = await http.get(POS_ENDPOINTS.SALES_ALL_TODAY);
        setSales(Array.isArray(data) ? data : []);
      } catch (error) {
        toast.error('Failed to load POS sales data');
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, []);

  const { totalRevenue, totalOrders, cashierStats } = useMemo(() => {
    let rev = 0;
    const statsMap = {};

    sales.forEach(s => {
      rev += s.total_amount || 0;
      const cashierId = s.cashier?.id || 'unknown';
      const cashierName = s.cashier ? `${s.cashier.first_name} ${s.cashier.last_name}` : 'Unknown Cashier';
      
      if (!statsMap[cashierId]) {
        statsMap[cashierId] = {
          id: cashierId,
          name: cashierName,
          totalSales: 0,
          totalOrders: 0
        };
      }
      statsMap[cashierId].totalSales += s.total_amount || 0;
      statsMap[cashierId].totalOrders += 1;
    });

    return {
      totalRevenue: rev,
      totalOrders: sales.length,
      cashierStats: Object.values(statsMap).sort((a, b) => b.totalSales - a.totalSales)
    };
  }, [sales]);

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div style={{ marginBottom: '2rem' }}>
        <h1>POS Analytics</h1>
        <p style={{ color: '#666' }}>Supervise POS terminal operations and cashier performance for today.</p>
      </div>

      <div className="stats-grid">
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="stat-icon" style={{ backgroundColor: '#2196F320' }}>
            <span style={{ fontSize: '2rem' }}>📋</span>
          </div>
          <div className="stat-content">
            <h3>{totalOrders}</h3>
            <p>Total POS Orders Today</p>
          </div>
        </motion.div>

        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="stat-icon" style={{ backgroundColor: '#FF980020' }}>
            <span style={{ fontSize: '2rem' }}>💰</span>
          </div>
          <div className="stat-content">
            <h3>{formatCurrency(totalRevenue)}</h3>
            <p>Total POS Revenue Today</p>
          </div>
        </motion.div>
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Cashier Performance</h2>
        {cashierStats.length === 0 ? (
          <p className="pos-muted">No POS sales recorded today.</p>
        ) : (
          <table className="pos-today-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '1rem 0.5rem' }}>Cashier Name</th>
                <th style={{ padding: '1rem 0.5rem' }}>Orders Processed</th>
                <th style={{ padding: '1rem 0.5rem' }}>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {cashierStats.map(stat => (
                <tr key={stat.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem 0.5rem' }}>{stat.name}</td>
                  <td style={{ padding: '1rem 0.5rem' }}>{stat.totalOrders}</td>
                  <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold' }}>{formatCurrency(stat.totalSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Recent POS Transactions</h2>
        {sales.length === 0 ? (
          <p className="pos-muted">No transactions today.</p>
        ) : (
          <table className="pos-today-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '1rem 0.5rem' }}>Order ID</th>
                <th style={{ padding: '1rem 0.5rem' }}>Time</th>
                <th style={{ padding: '1rem 0.5rem' }}>Cashier</th>
                <th style={{ padding: '1rem 0.5rem' }}>Customer Name</th>
                <th style={{ padding: '1rem 0.5rem' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 50).map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem 0.5rem' }}>#{s.id}</td>
                  <td style={{ padding: '1rem 0.5rem' }}>{new Date(s.created_at).toLocaleTimeString()}</td>
                  <td style={{ padding: '1rem 0.5rem' }}>{s.cashier ? `${s.cashier.first_name} ${s.cashier.last_name}` : 'Unknown'}</td>
                  <td style={{ padding: '1rem 0.5rem' }}>{s.customer_name || 'Walk-in'}</td>
                  <td style={{ padding: '1rem 0.5rem' }}>{formatCurrency(s.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminPosAnalytics;
