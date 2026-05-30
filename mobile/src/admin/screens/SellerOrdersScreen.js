import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCurrency } from '../../hooks/useCurrency';
import http from '../../services/http';
import { SELLER_ENDPOINTS, buildUrl } from '../../config/api';
import { buildImageUrl, formatDateTime } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';
import { useSellerPaidOrderCount } from '../../hooks/useSellerPaidOrderCount';

const ORDER_STATUS_LABEL_KEYS = {
  paid: 'ui.pages.orders.status.paid',
  preparing: 'ui.pages.orders.status.preparing',
};

const ORDER_STATUS_FILTERS = ['all', 'paid', 'preparing'];
const SELLER_VISIBLE_STATUSES = new Set(['paid', 'preparing']);

const SellerOrdersScreen = () => {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { formatCurrency } = useCurrency();
  const { panelKicker } = usePanelRole();
  const { textAlign, row } = useRtlLayout();
  const { refresh: refreshPaidCount } = useSellerPaidOrderCount();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = route.params?.filter;
    return ORDER_STATUS_FILTERS.includes(filter) ? filter : 'all';
  });
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  useEffect(() => {
    const filter = route.params?.filter;
    if (ORDER_STATUS_FILTERS.includes(filter)) {
      setActiveTab(filter);
    }
  }, [route.params?.filter]);

  const getOrderStatusLabel = useCallback(
    (status) => {
      const normalized = String(status || 'paid').toLowerCase();
      const key = ORDER_STATUS_LABEL_KEYS[normalized];
      return key ? tUi(key) : normalized.replace(/_/g, ' ');
    },
    [tUi]
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get(SELLER_ENDPOINTS.ORDERS);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (_) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.seller.sellerOrders.loadFailed_a1b2c3d4e5'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const sellerOrders = useMemo(
    () =>
      orders.filter((order) =>
        SELLER_VISIBLE_STATUSES.has(String(order.status || '').toLowerCase())
      ),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return sellerOrders;
    return sellerOrders.filter(
      (order) => String(order.status || '').toLowerCase() === activeTab
    );
  }, [activeTab, sellerOrders]);

  const formatFilterLabel = useCallback(
    (value) => {
      if (value === 'all') return tUi('ui.pages.seller.sellerOrders.tabAll_t6u7v8w9x0');
      if (value === 'paid') return tUi('ui.pages.seller.sellerOrders.tabPaid_j6k7l8m9n0');
      if (value === 'preparing') return tUi('ui.pages.seller.sellerOrders.tabPreparing_o1p2q3r4s5');
      return getOrderStatusLabel(value);
    },
    [getOrderStatusLabel, tUi]
  );

  const emptyMessage = useMemo(() => {
    if (activeTab === 'all') {
      return tUi('ui.pages.seller.sellerOrders.emptyAll_u1v2w3x4y5');
    }
    return tUi('ui.pages.seller.sellerOrders.emptyFiltered_p6q7r8s9t0', {
      value0: formatFilterLabel(activeTab),
    });
  }, [activeTab, formatFilterLabel, tUi]);

  const handleStartPreparing = async (orderId) => {
    setUpdatingOrderId(orderId);
    try {
      await http.patch(buildUrl(SELLER_ENDPOINTS.UPDATE_STATUS, { order_id: orderId }), {
        status: 'preparing',
      });
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.seller.sellerOrders.markedPreparing_f6g7h8i9j0'),
      });
      await fetchOrders();
      refreshPaidCount();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || 'Failed to update order',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const tabBar = (
    <View style={[styles.tabRow, { flexDirection: row }]}>
      {ORDER_STATUS_FILTERS.map((value) => (
        <Pressable
          key={value}
          style={[styles.tabChip, activeTab === value && styles.tabChipActive]}
          onPress={() => setActiveTab(value)}
        >
          <Text style={[styles.tabChipText, activeTab === value && styles.tabChipTextActive]}>
            {formatFilterLabel(value)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const orderCountLabel =
    filteredOrders.length === 1
      ? tUi('ui.pages.seller.sellerOrders.orderCountOne_h1i2j3k4l5')
      : tUi('ui.pages.seller.sellerOrders.orderCountMany_m6n7o8p9q0');

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.seller.sellerOrders.title_z6a7b8c9d0')}
      subtitle={tUi('ui.pages.seller.sellerOrders.subtitle_e1f2g3h4i5')}
      action={tabBar}
    >
      <Text style={[styles.countMeta, { textAlign }]}>
        <Text style={styles.countStrong}>{filteredOrders.length}</Text> {orderCountLabel}
      </Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredOrders.length === 0 ? (
        <Text style={[styles.emptyText, { textAlign }]}>{emptyMessage}</Text>
      ) : (
        filteredOrders.map((order) => {
          const orderItems = order.items || order.orderitems || [];
          const orderStatus = String(order.status || 'paid').toLowerCase();
          const isExpanded = expandedOrderId === order.id;
          const customerName =
            order.user?.first_name && order.user?.last_name
              ? `${order.user.first_name} ${order.user.last_name}`
              : order.customer_name || order.user?.email || '—';

          return (
            <View key={order.id} style={styles.orderCard}>
              <Pressable onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                <View style={[styles.orderHeader, { flexDirection: row }]}>
                  <View style={styles.orderMain}>
                    <Text style={[styles.orderId, { textAlign }]}>#{order.id}</Text>
                    <Text style={[styles.orderMeta, { textAlign }]} numberOfLines={1}>
                      {customerName}
                    </Text>
                    <Text style={[styles.orderMeta, { textAlign }]}>
                      {formatDateTime(order.created_at)} · {orderItems.length}{' '}
                      {tUi('ui.pages.seller.sellerOrders.colItems_n5o6p7q8r9').toLowerCase()}
                    </Text>
                  </View>
                  <View style={styles.orderAside}>
                    <Text style={[styles.orderTotal, { textAlign }]}>{formatCurrency(order.total_amount)}</Text>
                    <Text
                      style={[
                        styles.statusBadge,
                        orderStatus === 'paid' && styles.statusPaid,
                        orderStatus === 'preparing' && styles.statusPreparing,
                      ]}
                    >
                      {getOrderStatusLabel(order.status)}
                    </Text>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.muted}
                    />
                  </View>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.orderDetails}>
                  {orderItems.map((item) => {
                    const imageSrc = item.product?.images?.[0]
                      ? buildImageUrl(item.product.images[0])
                      : null;
                    return (
                      <View key={item.id} style={[styles.orderItem, { flexDirection: row }]}>
                        {imageSrc ? (
                          <Image source={{ uri: imageSrc }} style={styles.itemImage} />
                        ) : (
                          <View style={styles.itemImagePlaceholder}>
                            <Feather name="package" size={16} color={colors.muted} />
                          </View>
                        )}
                        <View style={styles.itemCopy}>
                          <Text style={[styles.itemTitle, { textAlign }]}>
                            {item.product?.name ||
                              tUi('ui.pages.seller.sellerOrders.productFallback_b1c2d3e4f5')}
                          </Text>
                          <Text style={[styles.itemMeta, { textAlign }]}>
                            {tUi('ui.pages.seller.sellerOrders.itemMeta_g6h7i8j9k0', {
                              value0: item.quantity,
                              value1: formatCurrency(item.price),
                              value2: formatCurrency(item.total),
                            })}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={[styles.orderActions, { flexDirection: row }]}>
                {order.status === 'paid' ? (
                  <Pressable
                    style={[styles.primaryBtn, updatingOrderId === order.id && styles.btnDisabled]}
                    onPress={() => handleStartPreparing(order.id)}
                    disabled={updatingOrderId === order.id}
                  >
                    <Text style={styles.primaryBtnText}>
                      {updatingOrderId === order.id
                        ? tUi('ui.pages.seller.sellerOrders.starting_m0n1o2p3q4')
                        : tUi('ui.pages.seller.sellerOrders.startPreparing_r5s6t7u8v9')}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.inProgressLabel, { textAlign }]}>
                    {tUi('ui.pages.seller.sellerOrders.inProgress_w0x1y2z3a4')}
                  </Text>
                )}
              </View>
            </View>
          );
        })
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    tabRow: {
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'flex-end',
      maxWidth: 360,
    },
    tabChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    tabChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    tabChipTextActive: {
      color: '#fff',
    },
    countMeta: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 12,
    },
    countStrong: {
      fontWeight: '700',
      color: colors.text,
    },
    loadingWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      paddingVertical: 20,
    },
    orderCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
      ...shadow,
    },
    orderHeader: {
      alignItems: 'flex-start',
      gap: 12,
    },
    orderMain: {
      flex: 1,
    },
    orderId: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    orderMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    orderAside: {
      alignItems: 'flex-end',
      gap: 6,
    },
    orderTotal: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    statusBadge: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    statusPaid: {
      color: '#2563eb',
      backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE',
    },
    statusPreparing: {
      color: '#d97706',
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7',
    },
    orderDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    orderItem: {
      alignItems: 'center',
      gap: 10,
    },
    itemImage: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.border,
    },
    itemImagePlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: isDark ? colors.background : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemCopy: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    itemMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.muted,
    },
    orderActions: {
      marginTop: 12,
      alignItems: 'center',
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    btnDisabled: {
      opacity: 0.6,
    },
    primaryBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    inProgressLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
  });

export default SellerOrdersScreen;
