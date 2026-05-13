import { tUi } from "../i18n/uiText";import React, { useState, useEffect } from 'react';
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
  canceled: 'ui.pages.orders.status.cancelled',
  failed: 'ui.pages.orders.status.failed',
  refunded: 'ui.pages.orders.status.refunded',
};

const DELIVERY_STEP_LABEL_KEYS = {
  paid: 'ui.pages.orders.deliveryStep.paid',
  assigned: 'ui.pages.orders.deliveryStep.assigned',
  picked_up: 'ui.pages.orders.deliveryStep.pickedUp',
  delivering: 'ui.pages.orders.deliveryStep.delivering',
  delivered: 'ui.pages.orders.deliveryStep.delivered',
};

const getOrderStatusLabel = (status) => {
  const normalizedStatus = String(status || 'created').toLowerCase();
  const key = ORDER_STATUS_LABEL_KEYS[normalizedStatus];
  return key ? tUi(key) : normalizedStatus.replace(/_/g, ' ');
};

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
        toast.error(tUi("ui.pages.orders.networkErrorUnableToConnect_96335b514f"));
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
      title: tUi("ui.pages.orders.cancelOrder_8a957aa9d2"),
      message: `Are you sure you want to cancel Order #${orderId}?`,
      confirmText: tUi("ui.pages.orders.cancelOrder_8a957aa9d2"),
      cancelText: tUi("ui.pages.orders.keepOrder_49c5b284e1")
    });

    if (!confirmed) {
      return;
    }

    setCancellingOrderId(orderId);
    try {
      const cancelUrl = ORDER_ENDPOINTS.CANCEL.replace('{order_id}', orderId);
      await http.patch(cancelUrl);

      // Update the order in the list with new status
      setOrders((prevOrders) =>
      prevOrders.map((order) =>
      order.id === orderId ? { ...order, status: 'cancelled' } : order
      )
      );

      // If the cancelled order was expanded, refresh it
      if (expandedOrderId === orderId) {
        setExpandedOrderId(null);
      }
      toast.success(tUi("ui.pages.orders.orderCancelledSuccessfully_5a659ac4b5"));
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
      </div>);

  }

  return (
    <div className="orders-page">
      <h1>{tUi("ui.pages.orders.myOrders_9215f6342b")}</h1>
      
      {orders.length === 0 ?
      <div className="empty-orders">
          <p>{tUi("ui.pages.orders.youHavenTPlacedAny_7ac4ec05af")}</p>
          <Link to="/products" className="shop-link">{tUi("ui.pages.orders.startShopping_aea59217fe")}

        </Link>
        </div> :

      <div className="orders-list">
          {orders.map((order, index) => {
          // Safety check: skip if order is invalid
          if (!order || !order.id) {
            return null;
          }

          const isExpanded = expandedOrderId === order.id;
          // Debug: Log order structure
          if (isExpanded) {
            console.log("Order data:", order);
            console.log("Order items:", order.items);
            console.log("Order orderitems:", order.orderitems);
          }
          // Use items or orderitems as fallback
          const orderItems = order.items || order.orderitems || [];
          return (
            <div
              key={order.id}
              className="order-card">
              
                <div className="order-header-container">
                  <div
                  className="order-header clickable"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                  
                    <div>
                      <h3>{tUi("ui.pages.orders.order_38ea576ed6")}{order.id}</h3>
                      <p className="order-date">{tUi("ui.pages.orders.createdAt_c1c945138d")}
                      {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="order-header-right">
                      <div className="order-status-badge">
                        <span className={`status-badge status-${order.status || 'created'}`}>
                          {getOrderStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="order-total">{tUi("ui.pages.orders.total_0b209e736b")}
                      {formatCurrency(order.total_amount)}
                      </div>
                      <span className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>
                  <div className="order-actions">
                    {order.status === "created" &&
                  <button
                    className="payment-order-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestInstallment(order.id);
                    }}
                    title={tUi("ui.pages.orders.requestInstallmentPlan_b342be35bd")}>{tUi("ui.pages.orders.installments_4c5bfead63")}


                  </button>
                  }
                    {order.status === "created" &&
                  <button
                    className="payment-order-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePayment(order);
                    }}
                    title={tUi("ui.pages.orders.payForOrder_975c7daf9a")}>{tUi("ui.pages.orders.payNow_d00d5b40a5")}


                  </button>
                  }
                    {order.status === "created" &&
                  <button
                    className="cancel-order-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelOrder(order.id);
                    }}
                    disabled={cancellingOrderId === order.id}
                    title={tUi("ui.pages.orders.cancelOrder_8a957aa9d2")}>
                    
                        {cancellingOrderId === order.id ? tUi("ui.pages.orders.cancelling_cc8321f695") : tUi("ui.pages.orders.cancel_65fb3d7ea4")}
                      </button>
                  }
                  </div>
                </div>

                {isExpanded &&
              <div className="order-details">
                    <div className="order-info-section">
                      <h4>{tUi("ui.pages.orders.orderInformation_f464cbfbf9")}</h4>
                      <div className="info-row">
                        <span className="info-label">{tUi("ui.pages.orders.createdAt_4bb4a07af1")}</span>
                        <span className="info-value">{formatDate(order.created_at)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">{tUi("ui.pages.orders.totalAmount_35b3b02116")}</span>
                        <span className="info-value">{formatCurrency(order.total_amount)}</span>
                      </div>
                    </div>

                    {/* Delivery Tracking (for orders in delivery flow) */}
                    {["paid", "assigned", "picked_up", "delivering", "delivered"].includes(order.status) &&
                <div className="order-info-section delivery-tracking-section">
                        <h4>{tUi("ui.pages.orders.deliveryTracking_2f98b3646f")}</h4>
                        <div className="delivery-stepper">
                          {["paid", "assigned", "picked_up", "delivering", "delivered"].map((step, idx) => {
                      const stepIcons = { paid: '💳', assigned: '👤', picked_up: '📦', delivering: '🚚', delivered: '✅' };
                      const allSteps = ["paid", "assigned", "picked_up", "delivering", "delivered"];
                      const currentIdx = allSteps.indexOf(order.status);
                      const isActive = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <div key={step} className={`stepper-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}>
                                <span className="stepper-icon">{stepIcons[step]}</span>
                                <span className="stepper-label">{tUi(DELIVERY_STEP_LABEL_KEYS[step])}</span>
                                {idx < allSteps.length - 1 && <span className={`stepper-line ${idx < currentIdx ? 'active' : ''}`} />}
                              </div>);

                    })}
                        </div>
                        {order.delivery_address &&
                  <div className="info-row">
                            <span className="info-label">{tUi("ui.pages.orders.deliveryAddress_45393d8d55")}</span>
                            <span className="info-value">{order.delivery_address}</span>
                          </div>
                  }
                        {/* Only show chat if order has active delivery job that driver has accepted */}
                        {["assigned", "picked_up", "delivering"].includes(order.status) &&
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
                          toast.error(tUi("ui.pages.orders.couldNotLoadChatTry_4843980c57"));
                        }
                      }}>{tUi("ui.pages.orders.chatWithDriver_3f7e508f43")}


                    </button>
                          </div>
                  }
                      </div>
                }

                    <div className="order-products-section">
                      <h4>{tUi("ui.pages.orders.products_625ccbdcaa")}{orderItems.length})</h4>
                      <div className="order-items">
                        {orderItems.length === 0 ?
                    <p className="no-items">{tUi("ui.pages.orders.noProductsFoundInThis_be568ee99b")}</p> :

                    orderItems.map((item) => {
                      const productImage = item.product?.images && item.product.images.length > 0 ? `${
                      API_BASE_URL}/${item.product.images[0]}` : `${
                      API_BASE_URL}/images/placeholder.jpg`;
                      const productName = item.product?.name || "Product";

                      return (
                        <div key={item.id} className="order-item">
                                <Link
                            to={`/products/${encodeURIComponent(productName)}`}
                            className="order-item-image-link"
                            onClick={(e) => e.stopPropagation()}>
                            
                                  <img
                              src={productImage}
                              alt={productName}
                              className="order-item-image"
                              onError={(e) => {
                                e.target.src = `${API_BASE_URL}/images/placeholder.jpg`;
                              }} />
                            
                                </Link>
                                <div className="order-item-info">
                                  <Link
                              to={`/products/${encodeURIComponent(productName)}`}
                              onClick={(e) => e.stopPropagation()}>
                              
                                    <h4>{productName}</h4>
                                  </Link>
                                  <p>{tUi("ui.pages.orders.quantity_0d9a3fd69e")}{item.quantity}</p>
                                </div>
                                <div className="order-item-price">
                                  <p>{tUi("ui.pages.orders.price_c9e823260b")}{formatCurrency(item.price)}{tUi("ui.pages.orders.each_4552f18ca7")}</p>
                                  <p className="item-total">{tUi("ui.pages.orders.total_0b209e736b")}{formatCurrency(item.total)}</p>
                                </div>
                              </div>);

                    })
                    }
                      </div>
                    </div>
                  </div>
              }
              </div>);

        })}
        </div>
      }
      {activeChatJobId &&
      <DeliveryChatModal
        isOpen={!!activeChatJobId}
        onClose={() => setActiveChatJobId(null)}
        jobId={activeChatJobId}
        token={token}
        currentUserId={currentUserId}
        isDriver={false} />

      }
    </div>);

};

export default Orders;
