import { tUi } from "../../i18n/uiText";import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { PRODUCT_ENDPOINTS, ORDER_ENDPOINTS, ADMIN_SETTINGS_ENDPOINTS, DELIVERY_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const isOperationsManager = user?.role === 'operations_manager';
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    activeDeliveries: 0
  });
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [thresholdInput, setThresholdInput] = useState('');
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [updatingThreshold, setUpdatingThreshold] = useState(false);
  const isInitialMount = useRef(true);

  const fetchLowStockThreshold = useCallback(async () => {
    try {
      const response = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      const threshold = response.data.threshold;
      setLowStockThreshold(threshold);
      setThresholdInput(threshold.toString());
      return threshold;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      // Use default value of 10 if fetch fails
      setLowStockThreshold(10);
      setThresholdInput('10');
      return 10;
    }
  }, []);

  const fetchStats = useCallback(async (thresholdOverride = null) => {
    const effectiveThreshold = Number.isFinite(Number(thresholdOverride)) ?
    Number(thresholdOverride) :
    Number(lowStockThreshold);
    setLoading(true);
    try {
      // Fetch products
      const productsResponse = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
      const products = productsResponse.data;

      const lowStock = products.filter((p) => p.quantity < effectiveThreshold).length;

      // Fetch orders
      let totalOrders = 0;
      let totalRevenue = 0;

      try {
        const ordersResponse = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
        const ordersData = Array.isArray(ordersResponse.data) ?
        ordersResponse.data :
        ordersResponse.data?.orders || [];

        totalOrders = ordersData.length;

        // Calculate total revenue from paid, shipped, or delivered orders
        const revenueOrders = ordersData.filter((order) =>
        order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered'
        );

        totalRevenue = revenueOrders.reduce((sum, order) => {
          return sum + (parseFloat(order.total_amount) || 0);
        }, 0);
      } catch (orderError) {
        console.error('Error fetching orders:', orderError);
        // Continue with 0 values if orders fetch fails
      }

      // Fetch active deliveries count
      let activeDeliveries = 0;
      try {
        const deliveriesResponse = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
        const deliveriesData = Array.isArray(deliveriesResponse.data) ? deliveriesResponse.data : [];
        activeDeliveries = deliveriesData.filter((j) =>
        ['available', 'assigned', 'picked_up', 'delivering'].includes(j.status)
        ).length;
      } catch (deliveryError) {
        console.error('Error fetching deliveries:', deliveryError);
      }

      setStats({
        totalProducts: products.length,
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
        lowStockProducts: lowStock,
        activeDeliveries: activeDeliveries
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [lowStockThreshold]);

  useEffect(() => {
    if (isOperationsManager) {
      navigate('/admin/orders', { replace: true });
      return;
    }
    const initializeData = async () => {
      const threshold = await fetchLowStockThreshold();
      await fetchStats(threshold);
    };
    initializeData();
  }, [isOperationsManager, navigate, fetchLowStockThreshold, fetchStats]);

  useEffect(() => {
    if (isOperationsManager) {
      return;
    }
    // Refetch stats when threshold changes (but not on initial mount)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (lowStockThreshold > 0) {
      fetchStats();
    }
  }, [isOperationsManager, lowStockThreshold, fetchStats]);

  const handleUpdateThreshold = async () => {
    const newThreshold = parseInt(thresholdInput);
    if (isNaN(newThreshold) || newThreshold < 1) {
      toast.error(tUi("ui.pages.admin.adminDashboard.pleaseEnterAValidNumber_13831328c9"));
      return;
    }

    setUpdatingThreshold(true);
    try {
      await http.put(ADMIN_SETTINGS_ENDPOINTS.UPDATE_LOW_STOCK_THRESHOLD, {
        threshold: newThreshold
      });
      setLowStockThreshold(newThreshold);
      setShowThresholdModal(false);
      toast.success(tUi("ui.pages.admin.adminDashboard.lowStockThresholdUpdatedSuccessfully_131aa1d046"));
      // Refetch stats with new threshold
      await fetchStats(newThreshold);
    } catch (error) {
      console.error('Error updating threshold:', error);
      toast.error(error.response?.data?.detail || 'Failed to update threshold');
    } finally {
      setUpdatingThreshold(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  const statCards = [
  {
    title: tUi("ui.pages.admin.adminDashboard.totalProducts_d457551dae"),
    value: stats.totalProducts,
    icon: '📦',
    color: '#4CAF50',
    path: '/admin/products'
  },
  {
    title: tUi("ui.pages.admin.adminDashboard.totalOrders_3968b1aea2"),
    value: stats.totalOrders,
    icon: '📋',
    color: '#2196F3',
    path: '/admin/orders'
  },
  {
    title: tUi("ui.pages.admin.adminDashboard.totalRevenue_8625d01bf6"),
    value: formatCurrency(stats.totalRevenue),
    icon: '💰',
    color: '#FF9800',
    path: '/admin/orders?filter=revenue'
  },
  {
    title: tUi("ui.pages.admin.adminDashboard.lowStockItems_5d20c43c41"),
    value: stats.lowStockProducts,
    icon: '⚠️',
    color: '#F44336',
    path: '/admin/products?filter=lowstock',
    threshold: lowStockThreshold
  },
  {
    title: tUi("ui.pages.admin.adminDashboard.activeDeliveries_88b2551152"),
    value: stats.activeDeliveries,
    icon: '🚚',
    color: '#9C27B0',
    path: '/admin/deliveries'
  }];


  return (
    <div className="admin-dashboard">
      <h1>{tUi("ui.pages.admin.adminDashboard.adminDashboard_16654f6473")}</h1>
      
      <div className="stats-grid">
        {statCards.map((stat, index) =>
        <motion.div
          key={stat.title}
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => {
            if (stat.path) {
              navigate(stat.path);
            }
          }}
          style={{ cursor: stat.path ? 'pointer' : 'default' }}>
          
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}20` }}>
              <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
            </div>
            <div className="stat-content">
              <h3>{stat.value}</h3>
              <p>{stat.title}</p>
              {stat.threshold &&
            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{tUi("ui.pages.admin.adminDashboard.threshold_5e08be5809")}
              {'<'} {stat.threshold}
                </p>
            }
            </div>
            {stat.threshold &&
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowThresholdModal(true);
            }}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(0,0,0,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={tUi("ui.pages.admin.adminDashboard.configureThreshold_6c49d82303")}>
            
                ⚙️
              </button>
          }
          </motion.div>
        )}
      </div>

      {/* Threshold Configuration Modal */}
      {showThresholdModal &&
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowThresholdModal(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
        
          <motion.div
          className="modal-content"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '400px',
            width: '90%'
          }}>
          
            <h2 style={{ marginBottom: '1rem' }}>{tUi("ui.pages.admin.adminDashboard.configureLowStockThreshold_22dcb80c15")}</h2>
            <p style={{ marginBottom: '1rem', color: '#666' }}>{tUi("ui.pages.admin.adminDashboard.setTheMinimumQuantityThreshold_fe35c5b475")}

          </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{tUi("ui.pages.admin.adminDashboard.thresholdValue_71a139a7b5")}

            </label>
              <input
              type="number"
              min="1"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '0.25rem',
                fontSize: '1rem'
              }}
              placeholder={tUi("ui.pages.admin.adminDashboard.enterThreshold_219f1692b7")} />
            
              <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>{tUi("ui.pages.admin.adminDashboard.currentThreshold_4fa4cc319c")}
              {lowStockThreshold}
              </small>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
              onClick={() => setShowThresholdModal(false)}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #ddd',
                borderRadius: '0.25rem',
                background: 'white',
                cursor: 'pointer'
              }}
              disabled={updatingThreshold}>{tUi("ui.pages.admin.adminDashboard.cancel_a89615662d")}


            </button>
              <button
              onClick={handleUpdateThreshold}
              disabled={updatingThreshold}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '0.25rem',
                background: '#2196F3',
                color: 'white',
                cursor: 'pointer',
                opacity: updatingThreshold ? 0.6 : 1
              }}>
              
                {updatingThreshold ? tUi("ui.pages.admin.adminDashboard.updating_6f3aa97175") : tUi("ui.pages.admin.adminDashboard.update_9caf0051b0")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      }

      <div className="dashboard-actions">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          
          <Link to="/admin/products" className="dashboard-action-card">
            <h3>{tUi("ui.pages.admin.adminDashboard.manageProducts_f61663679a")}</h3>
            <p>{tUi("ui.pages.admin.adminDashboard.addEditOrDeleteProducts_e0122eec91")}</p>
          </Link>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          
          <Link to="/admin/promotions" className="dashboard-action-card">
            <h3>{tUi("ui.pages.admin.adminDashboard.managePromotions_48a31a922f")}</h3>
            <p>{tUi("ui.pages.admin.adminDashboard.createRuleBasedCartAnd_1861c140e1")}</p>
          </Link>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          
          <Link to="/admin/categories" className="dashboard-action-card">
            <h3>{tUi("ui.pages.admin.adminDashboard.manageCategories_ca9b3bad2a")}</h3>
            <p>{tUi("ui.pages.admin.adminDashboard.organizeYourProductCategories_4e86f7c153")}</p>
          </Link>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          
          <Link to="/admin/orders" className="dashboard-action-card">
            <h3>{tUi("ui.pages.admin.adminDashboard.viewOrders_9d4d2887cf")}</h3>
            <p>{tUi("ui.pages.admin.adminDashboard.monitorCustomerOrders_026e4ad4df")}</p>
          </Link>
        </motion.div>
      </div>
    </div>);

};

export default AdminDashboard;
