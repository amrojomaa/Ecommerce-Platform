import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import http from '../services/http';
import { ORDER_ENDPOINTS, DELIVERY_ENDPOINTS, buildUrl } from '../config/api';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import DeliveryChatModal from '../components/DeliveryChatModal';
import API_BASE_URL from '../config/api';
import { useConfirm } from '../hooks/useConfirm';
import { useCurrency } from '../hooks/useCurrency';
import '../styles/pages/Orders.css';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [activeChatJobId, setActiveChatJobId] = useState(null);
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
  
  const token = localStorage.getItem('token');
  const getUserIdFromToken = () => {
      if (!token) return null;
      try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.user_id;
      } catch (e) {
          return null;
      }
  };
  const currentUserId = getUserIdFromToken();

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
    const confirmed = await confirm({
      title: 'Cancel order',
      message: `Are you sure you want to cancel Order #${orderId}?`,
      confirmText: 'Cancel order',
      cancelText: 'Keep order',
    });
    
    if (!confirmed) {
      return;
    }

    setCancellingOrderId(orderId);
    try {
      const cancelUrl = ORDER_ENDPOINTS.CANCEL.replace('{order_id}', orderId);
      await http.patch(cancelUrl);
      
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

  const handleRequestInstallment = (orderId) => {
    navigate(`/installments?orderId=${orderId}`);
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
                        Total: {formatCurrency(order.total_amount)}
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
                          handleRequestInstallment(order.id);
                        }}
                        title="Request installment plan"
                      >
                        Installments
                      </button>
                    )}
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
                        <span className="info-value">{formatCurrency(order.total_amount)}</span>
                      </div>
                    </div>

                    {/* Delivery Tracking (for orders in delivery flow) */}
                    {['paid', 'assigned', 'picked_up', 'delivering', 'delivered'].includes(order.status) && (
                      <div className="order-info-section delivery-tracking-section">
                        <h4>🚚 Delivery Tracking</h4>
                        <div className="delivery-stepper">
                          {['paid', 'assigned', 'picked_up', 'delivering', 'delivered'].map((step, idx) => {
                            const stepLabels = { paid: 'Order Paid', assigned: 'Driver Assigned', picked_up: 'Picked Up', delivering: 'On The Way', delivered: 'Delivered' };
                            const stepIcons = { paid: '💳', assigned: '👤', picked_up: '📦', delivering: '🚚', delivered: '✅' };
                            const allSteps = ['paid', 'assigned', 'picked_up', 'delivering', 'delivered'];
                            const currentIdx = allSteps.indexOf(order.status);
                            const isActive = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            return (
                              <div key={step} className={`stepper-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}>
                                <span className="stepper-icon">{stepIcons[step]}</span>
                                <span className="stepper-label">{stepLabels[step]}</span>
                                {idx < allSteps.length - 1 && <span className={`stepper-line ${idx < currentIdx ? 'active' : ''}`} />}
                              </div>
                            );
                          })}
                        </div>
                        {order.delivery_address && (
                          <div className="info-row">
                            <span className="info-label">Delivery Address:</span>
                            <span className="info-value">{order.delivery_address}</span>
                          </div>
                        )}
                        {/* Only show chat if order has active delivery job that driver has accepted */}
                        {['assigned', 'picked_up', 'delivering'].includes(order.status) && (
                          <div style={{ marginTop: '15px' }}>
                             <button 
                                className="btn-primary-action" 
                                style={{ backgroundColor: '#10b981', padding: '8px 16px', borderRadius: '4px', color: 'white', border: 'none', cursor: 'pointer' }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    // Make API call to get delivery job ID for this order
                                    const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.GET_JOB_BY_ORDER, { order_id: order.id }));
                                    setActiveChatJobId(response.data.id);
                                  } catch (error) {
                                    toast.error("Could not load chat. Try again later.");
                                  }
                                }}
                             >
                                💬 Chat with Driver
                             </button>
                          </div>
                        )}
                      </div>
                    )}

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
                                  <p>Price: {formatCurrency(item.price)} each</p>
                                  <p className="item-total">Total: {formatCurrency(item.total)}</p>
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
      {activeChatJobId && (
         <DeliveryChatModal
            isOpen={!!activeChatJobId}
            onClose={() => setActiveChatJobId(null)}
            jobId={activeChatJobId}
            token={token}
            currentUserId={currentUserId}
            isDriver={false}
         />
      )}
    </div>
  );
};

export default Orders;
