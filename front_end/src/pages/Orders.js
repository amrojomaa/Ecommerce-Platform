import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../services/http';
import { ORDER_ENDPOINTS } from '../config/api';
import { formatPrice, formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import API_BASE_URL from '../config/api';
import '../styles/pages/Orders.css';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('Fetching orders from:', ORDER_ENDPOINTS.MY_ORDERS);
      const response = await http.get(ORDER_ENDPOINTS.MY_ORDERS);
      console.log('Orders response:', response);
      setOrders(response.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      console.error('Error type:', error.constructor.name);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      console.error('Error message:', error.message);
      console.error('Error config:', error.config);
      
      // Network errors (no response from server)
      if (!error.response) {
        console.error('Network error - server may be down or endpoint not accessible');
        toast.error('Network Error: Unable to connect to server. Please check if the server is running.');
        setOrders([]);
        return;
      }
      
      // If 404 or empty, set empty array (this is normal for users with no orders)
      if (error.response?.status === 404) {
        setOrders([]);
      } else {
        const errorMsg = error.response?.data?.detail || error.message || 'Failed to fetch orders';
        console.error('Error message:', errorMsg);
        toast.error(`Failed to fetch orders: ${errorMsg}`);
        setOrders([]); // Set empty array to prevent UI breaking
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    // Confirm cancellation
    const confirmed = window.confirm(
      `Are you sure you want to cancel Order #${orderId}?`
    );
    
    if (!confirmed) {
      return;
    }

    setCancellingOrderId(orderId);
    try {
      const cancelUrl = ORDER_ENDPOINTS.CANCEL.replace('{order_id}', orderId);
      const response = await http.patch(cancelUrl);
      
      // alert('Order cancelled successfully');
      
      // Update the order in the list with new status
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, status: 'cancelled' } : order
        )
      );
      
      // If the cancelled order was expanded, refresh it
      if (expandedOrderId === orderId) {
        setExpandedOrderId(null);
      }
      toast.success('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to cancel order';
      toast.error(`Failed to cancel order: ${errorMsg}`);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handlePayment = (order) => {
    // Navigate to payment page with order information
    navigate('/payment', {
      state: {
        amount: order.total_amount,
        orderId: order.id
      }
    });
  };

  if (loading) {
    return (
      <div className="orders-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1>My Orders</h1>
      
      {orders.length === 0 ? (
        <div className="empty-orders">
          <p>You haven't placed any orders yet.</p>
          <Link to="/products" className="shop-link">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order, index) => {
            // Safety check: skip if order is invalid
            if (!order || !order.id) {
              return null;
            }
            
            const isExpanded = expandedOrderId === order.id;
            // Debug: Log order structure
            if (isExpanded) {
              console.log('Order data:', order);
              console.log('Order items:', order.items);
              console.log('Order orderitems:', order.orderitems);
            }
            // Use items or orderitems as fallback
            const orderItems = order.items || order.orderitems || [];
            return (
              <div
                key={order.id}
                className="order-card"
              >
                <div className="order-header-container">
                  <div 
                    className="order-header clickable"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  >
                    <div>
                      <h3>Order #{order.id}</h3>
                      <p className="order-date">
                        Created at: {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="order-header-right">
                      <div className="order-status-badge">
                        <span className={`status-badge status-${order.status || 'created'}`}>
                          {order.status || 'created'}
                        </span>
                      </div>
                      <div className="order-total">
                        Total: {formatPrice(order.total_amount)}
                      </div>
                      <span className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>
                  <div className="order-actions">
                    {order.status === 'created' && (
                      <button
                        className="payment-order-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePayment(order);
                        }}
                        title="Pay for order"
                      >
                        Pay Now
                      </button>
                    )}
                    {order.status === 'created' && (
                      <button
                        className="cancel-order-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelOrder(order.id);
                        }}
                        disabled={cancellingOrderId === order.id}
                        title="Cancel order"
                      >
                        {cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="order-details">
                    <div className="order-info-section">
                      <h4>Order Information</h4>
                      <div className="info-row">
                        <span className="info-label">Created At:</span>
                        <span className="info-value">{formatDate(order.created_at)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Total Amount:</span>
                        <span className="info-value">{formatPrice(order.total_amount)}</span>
                      </div>
                    </div>

                    <div className="order-products-section">
                      <h4>Products ({orderItems.length})</h4>
                      <div className="order-items">
                        {orderItems.length === 0 ? (
                          <p className="no-items">No products found in this order.</p>
                        ) : (
                          orderItems.map((item) => {
                            const productImage = item.product?.images && item.product.images.length > 0
                              ? `${API_BASE_URL}/${item.product.images[0]}`
                              : `${API_BASE_URL}/images/placeholder.jpg`;
                            const productName = item.product?.name || 'Product';
                            
                            return (
                              <div key={item.id} className="order-item">
                                <Link
                                  to={`/products/${encodeURIComponent(productName)}`}
                                  className="order-item-image-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <img
                                    src={productImage}
                                    alt={productName}
                                    className="order-item-image"
                                    onError={(e) => {
                                      e.target.src = `${API_BASE_URL}/images/placeholder.jpg`;
                                    }}
                                  />
                                </Link>
                                <div className="order-item-info">
                                  <Link
                                    to={`/products/${encodeURIComponent(productName)}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <h4>{productName}</h4>
                                  </Link>
                                  <p>Quantity: {item.quantity}</p>
                                </div>
                                <div className="order-item-price">
                                  <p>Price: {formatPrice(item.price)} each</p>
                                  <p className="item-total">Total: {formatPrice(item.total)}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;
