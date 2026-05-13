import { tUi } from "../../i18n/uiText";import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import http from '../../services/http';
import { ORDER_ENDPOINTS } from '../../config/api';
import { formatDate, getImageUrl } from '../../utils/helpers';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useCurrency } from '../../hooks/useCurrency';
import '../../styles/pages/admin/AdminOrders.css';

const ORDER_STATUS_LABEL_KEYS = {
  created: 'ui.pages.orders.status.created',
  pending: 'ui.pages.orders.status.pending',
  paid: 'ui.pages.orders.status.paid',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  shipped: 'ui.pages.orders.status.shipped',
  delivered: 'ui.pages.orders.status.delivered',
  cancelled: 'ui.pages.orders.status.cancelled',
  failed: 'ui.pages.orders.status.failed',
  refunded: 'ui.pages.orders.status.refunded',
};

const AdminOrders = () => {
  const { formatCurrency } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // Store all orders for filtering
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(() => {
    // Initialize from URL parameter if present
    const filterParam = searchParams.get('filter');
    return filterParam || 'all';
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  // Apply filter when statusFilter changes or when orders are loaded
  useEffect(() => {
    if (allOrders.length > 0) {
      if (statusFilter === 'all') {
        setOrders(allOrders);
      } else if (statusFilter === 'revenue') {
        // Filter for revenue orders: paid, shipped, and delivered
        const filtered = allOrders.filter((order) => {
          const status = (order.status || 'created').toLowerCase();
          return status === 'paid' || status === 'shipped' || status === 'delivered';
        });
        setOrders(filtered);
      } else if (statusFilter === 'pos') {
        setOrders(allOrders.filter((order) => order.sale_channel === 'pos'));
      } else {
        const filtered = allOrders.filter((order) =>
        (order.status || 'created').toLowerCase() === statusFilter.toLowerCase()
        );
        setOrders(filtered);
      }
    }
  }, [statusFilter, allOrders]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
      console.log('Orders API Response:', response);
      console.log('Orders Data:', response.data);

      // Handle both array and object responses
      const ordersData = Array.isArray(response.data) ? response.data : response.data?.orders || [];
      setAllOrders(ordersData); // Store all orders - the useEffect will handle filtering

      if (ordersData.length === 0) {
        console.log('No orders found in database');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        data: error.data,
        response: error.response
      });

      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch orders';
      setError(errorMessage);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStatuses = (currentStatus) => {
    // Admin can change:
    // - paid → shipped
    // - shipped → delivered
    // - any status → cancelled
    // Delivery statuses (assigned, picked_up, delivering) are set by drivers — admin can only cancel
    if (currentStatus === 'paid') {
      return ['shipped', 'cancelled'];
    } else if (currentStatus === 'shipped') {
      return ['delivered', 'cancelled'];
    } else if (['assigned', 'picked_up', 'delivering'].includes(currentStatus)) {
      return ['cancelled'];
    } else {
      return ['cancelled'];
    }
  };

  const handleStatusFilterChange = (e) => {
    const filterValue = e.target.value;
    setStatusFilter(filterValue);

    // Update URL parameter
    if (filterValue === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: filterValue });
    }
  };

  const orderStatuses = ['all', 'revenue', 'pos', 'created', 'paid', 'assigned', 'picked_up', 'delivering', 'shipped', 'delivered', 'cancelled'];

  const getOrderStatusLabel = (status) => {
    const normalized = String(status || 'created').toLowerCase();
    const key = ORDER_STATUS_LABEL_KEYS[normalized];
    if (key) return tUi(key);
    return normalized.replace(/_/g, ' ');
  };

  const formatFilterLabel = (value) => {
    if (value === 'pos') return tUi("ui.pages.admin.adminOrders.pos_a479fcd150");
    if (value === 'revenue') return tUi("ui.pages.admin.adminOrders.revenue_a1caf5553a");
    if (value === 'all') return tUi("ui.pages.admin.adminOrders.all_80e364fbdb");
    return getOrderStatusLabel(value);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updateUrl = ORDER_ENDPOINTS.UPDATE_STATUS.replace('{order_id}', orderId);
      await http.patch(updateUrl, { status: newStatus });

      // Update the order in both filtered and all orders lists
      const updatedOrder = { ...orders.find((o) => o.id === orderId), status: newStatus };

      setAllOrders((prevAllOrders) =>
      prevAllOrders.map((order) =>
      order.id === orderId ? updatedOrder : order
      )
      );

      setOrders((prevOrders) =>
      prevOrders.map((order) =>
      order.id === orderId ? updatedOrder : order
      )
      );

      setSelectedStatus({ ...selectedStatus, [orderId]: '' });
      toast.success(tUi("ui.pages.admin.adminOrders.orderStatusUpdatedSuccessfully_fc30445a1d"));
    } catch (error) {
      console.error('Error updating order status:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to update order status';
      toast.error(`Failed to update order status: ${errorMsg}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-orders-loading">
        <LoadingSpinner size="large" />
      </div>);

  }

  return (
    <div className="admin-orders">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>{tUi("ui.pages.admin.adminOrders.allOrders_4b39990b5b")}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="status-filter" style={{ fontWeight: '500' }}>{tUi("ui.pages.admin.adminOrders.filterByStatus_c0507d4cfa")}</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '150px'
            }}>
            
            {orderStatuses.map((status) =>
            <option key={status} value={status}>
                {formatFilterLabel(status)}
              </option>
            )}
          </select>
          {statusFilter !== "all" &&
          <span style={{ color: '#666', fontSize: '14px' }}>
              ({orders.length} {orders.length === 1 ? tUi("ui.pages.admin.adminOrders.order_34aea86a72") : tUi("ui.pages.admin.adminOrders.orders_0e0e34ceea")})
            </span>
          }
        </div>
      </div>
      
      {error ?
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
        }}>
        
          <p><strong>{tUi("ui.pages.admin.adminOrders.error_4f8aad30a6")}</strong> {error}</p>
          <button
          onClick={fetchOrders}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#c62828',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>{tUi("ui.pages.admin.adminOrders.retry_b584d994cc")}


        </button>
        </motion.div> :
      orders.length === 0 ?
      <motion.div
        className="empty-orders"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        
          <p>
            {statusFilter === "all" ? tUi("ui.pages.admin.adminOrders.noOrdersFound_fc2cb6ab28") :

          statusFilter === "revenue" ? tUi("ui.pages.admin.adminOrders.noOrdersFoundWithStatus_935a07a75e") :

          statusFilter === "pos" ? tUi("ui.pages.admin.adminOrders.noInStorePosOrders_e985e1c501") : tUi("ui.pages.admin.adminOrders.noOrdersFoundWithStatus_abbac05c5c", { value0:

            formatFilterLabel(statusFilter) })}
          </p>
          {statusFilter !== "all" &&
        <button
          onClick={() => {
            setStatusFilter("all");
            setSearchParams({});
          }}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>{tUi("ui.pages.admin.adminOrders.showAllOrders_a234fdd874")}


        </button>
        }
        </motion.div> :

      <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>{tUi("ui.pages.admin.adminOrders.orderId_87fb94b0ea")}</th>
                <th>{tUi("ui.pages.admin.adminOrders.customer_af49dd1c93")}</th>
                <th>{tUi("ui.pages.admin.adminOrders.date_d12a0581d9")}</th>
                <th>{tUi("ui.pages.admin.adminOrders.items_716d042f1e")}</th>
                <th>{tUi("ui.pages.admin.adminOrders.total_fe96c090ae")}</th>
                <th>{tUi("ui.pages.admin.adminOrders.status_7bb0ee7637")}</th>
                <th>{tUi("ui.pages.admin.adminOrders.notification_21ad4e898c")}</th>
                <th>{tUi("ui.pages.admin.adminOrders.actions_8926462604")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) =>
            <React.Fragment key={order.id}>
                  {(() => {
                const orderStatus = (order.status || '').toLowerCase();
                const showIssueNotification = !!order.order_delivery?.issue_type && !order.order_delivery?.issue_resolved && !["cancelled", "delivered"].includes(orderStatus);
                return (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={expandedOrderId === order.id ? "row-expanded" : ''}>
                    
                    <td>#{order.id}</td>
                    <td>
                      {order.sale_channel === "pos" ?
                      <>
                          <span className="order-channel-pos" title={tUi("ui.pages.admin.adminOrders.inStorePosSale_28efdad1f0")}>{tUi("ui.pages.admin.adminOrders.pos_a479fcd150")}</span>
                          {order.cashier ?
                        <>
                              <span className="pos-customer-primary">{order.cashier.email}</span>
                              {(order.cashier.first_name || order.cashier.last_name) &&
                          <span className="user-name">
                                  {' '}
                                  ({[order.cashier.first_name, order.cashier.last_name].filter(Boolean).join(' ')})
                                </span>
                          }
                            </> :

                        <span className="user-name">{tUi("ui.pages.admin.adminOrders.cashierNotRecorded_fc0dc3a12d")}</span>
                        }
                        </> :

                      <>
                          {order.user?.email || tUi("ui.pages.admin.adminOrders.nA_eb6526e85d")}
                          {order.user?.first_name && order.user?.last_name &&
                        <span className="user-name">
                              {' '}({order.user.first_name} {order.user.last_name})
                            </span>
                        }
                        </>
                      }
                    </td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.items?.length || order.orderitems?.length || 0}</td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>
                      <span className={`order-status status-${order.status || 'created'}`}>
                        {getOrderStatusLabel(order.status || 'created')}
                      </span>
                    </td>
                    <td>
                      {showIssueNotification ?
                      <span className="issue-notification-badge">{tUi("ui.pages.admin.adminOrders.driverIssue_0d9f42cb96")}</span> :

                      <span className="no-action">{tUi("ui.pages.admin.adminOrders.none_840aa967a8")}</span>
                      }
                    </td>
                    <td>
                      <div className="order-actions-cell">
                        {getAvailableStatuses(order.status || "created").length > 0 ?
                        <select
                          value={selectedStatus[order.id] || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleStatusChange(order.id, e.target.value);
                            }
                          }}
                          disabled={updatingOrderId === order.id}
                          className="status-select">
                          
                            <option value="">{tUi("ui.pages.admin.adminOrders.changeStatus_82cd1fa50c")}</option>
                            {getAvailableStatuses(order.status || "created").map((status) =>
                          <option key={status} value={status}>
                                {getOrderStatusLabel(status)}
                              </option>
                          )}
                          </select> :

                        <span className="no-action">{tUi("ui.pages.admin.adminOrders.noActions_8095e03ffa")}</span>
                        }

                        {(order.order_delivery?.issue_type || (order.order_delivery?.photos?.length || 0) > 0) &&
                        <button
                          className="btn-view-issue"
                          onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}>
                          
                            {expandedOrderId === order.id ? tUi("ui.pages.admin.adminOrders.hideReport_ede910d752") : tUi("ui.pages.admin.adminOrders.viewReport_1b00ec094c")}
                          </button>
                        }
                      </div>
                    </td>
                  </motion.tr>);

              })()}

                  {expandedOrderId === order.id &&
              <tr className="order-expanded-row">
                      <td colSpan="8">
                        <div className="order-expanded-panel">
                          <h4>{tUi("ui.pages.admin.adminOrders.driverReport_1685bd9703")}</h4>
                          {order.order_delivery?.issue_type ?
                    <p className="issue-report-line">
                              <strong>{tUi("ui.pages.admin.adminOrders.type_5479c42965")}</strong> {order.order_delivery.issue_type.replace(/_/g, ' ')}
                            </p> :

                    <p className="issue-report-line">{tUi("ui.pages.admin.adminOrders.noIssueTypeProvided_be64d46132")}</p>
                    }

                          {order.order_delivery?.issue_description &&
                    <p className="issue-report-line">
                              <strong>{tUi("ui.pages.admin.adminOrders.description_ddd5e10a09")}</strong> {order.order_delivery.issue_description}
                            </p>
                    }

                          {Array.isArray(order.order_delivery?.photos) && order.order_delivery.photos.length > 0 &&
                    <div className="order-issue-photo-grid">
                              {order.order_delivery.photos.map((photo) =>
                      <div className="order-issue-photo-card" key={`order-photo-${photo.id}`}>
                                  <img src={getImageUrl(photo.image_path)} alt={tUi("ui.pages.admin.adminOrders.deliveryValue_8de82198a5", { value0: photo.photo_type })} />
                                  <span>{photo.photo_type.replace(/_/g, ' ')}</span>
                                </div>
                      )}
                            </div>
                    }
                        </div>
                      </td>
                    </tr>
              }
                </React.Fragment>
            )}
            </tbody>
          </table>
        </div>
      }
    </div>);

};

export default AdminOrders;
