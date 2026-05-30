import React, { useCallback, useEffect, useState } from 'react';
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
import { WAREHOUSE_ENDPOINTS, buildUrl } from '../../config/api';
import { buildImageUrl, formatDateTime } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';
import { useWarehouseApprovalCount } from '../../hooks/useWarehouseApprovalCount';

const WarehouseApprovalsScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { formatCurrency } = useCurrency();
  const { panelKicker } = usePanelRole();
  const { textAlign, row } = useRtlLayout();
  const { refresh: refreshApprovalCount } = useWarehouseApprovalCount();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get(WAREHOUSE_ENDPOINTS.PACKED_REVIEW);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouse.warehouseApprovals.toast.failedToLoad'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = async (orderId) => {
    setApprovingId(orderId);
    try {
      await http.patch(buildUrl(WAREHOUSE_ENDPOINTS.APPROVE_ORDER, { order_id: orderId }));
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.warehouse.warehouseApprovals.toast.approved'),
      });
      setExpandedOrder(null);
      fetchOrders();
      refreshApprovalCount();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.warehouse.warehouseApprovals.toast.failedToApprove'),
      });
    } finally {
      setApprovingId(null);
    }
  };

  const orderCountLabel =
    orders.length === 1
      ? tUi('ui.pages.warehouse.warehouseApprovals.orderCountOne')
      : tUi('ui.pages.warehouse.warehouseApprovals.orderCountMany');

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.warehouse.warehouseApprovals.title')}
      subtitle={tUi('ui.pages.warehouse.warehouseApprovals.subtitle')}
      meta={
        <Text style={styles.countMeta}>
          <Text style={styles.countStrong}>{orders.length}</Text> {orderCountLabel}
        </Text>
      }
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <Text style={[styles.emptyText, { textAlign }]}>
          {tUi('ui.pages.warehouse.warehouseApprovals.empty')}
        </Text>
      ) : (
        orders.map((order) => {
          const orderItems = order.items || order.orderitems || [];
          const isExpanded = expandedOrder === order.id;

          return (
            <View key={order.id} style={styles.orderCard}>
              <Pressable
                style={[styles.orderHeader, { flexDirection: row }]}
                onPress={() => setExpandedOrder(isExpanded ? null : order.id)}
              >
                <View style={styles.orderMain}>
                  <Text style={[styles.orderId, { textAlign }]}>
                    {tUi('ui.pages.warehouse.warehouseApprovals.orderId', { id: order.id })}
                  </Text>
                  <Text style={[styles.orderMeta, { textAlign }]}>
                    {tUi('ui.pages.warehouse.warehouseApprovals.itemsCount', {
                      count: orderItems.length,
                    })}{' '}
                    · {formatDateTime(order.created_at)}
                  </Text>
                </View>
                <View style={styles.orderEnd}>
                  <Text style={styles.orderTotal}>{formatCurrency(order.total_amount)}</Text>
                  <Text style={styles.statusPill}>
                    {tUi('ui.pages.orders.status.packed')}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.approveButton}
                onPress={() => handleApprove(order.id)}
                disabled={approvingId === order.id}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.approveButtonText}>
                  {approvingId === order.id
                    ? tUi('ui.pages.warehouse.warehouseApprovals.approving')
                    : tUi('ui.pages.warehouse.warehouseApprovals.approve')}
                </Text>
              </Pressable>

              {isExpanded ? (
                <View style={styles.details}>
                  {orderItems.map((item) => {
                    const imageSrc = item.product?.images?.[0]
                      ? buildImageUrl(item.product.images[0])
                      : null;
                    return (
                      <View key={item.id} style={[styles.itemRow, { flexDirection: row }]}>
                        {imageSrc ? (
                          <Image source={{ uri: imageSrc }} style={styles.itemImage} />
                        ) : (
                          <View style={styles.itemImagePlaceholder}>
                            <Feather name="package" size={16} color={colors.muted} />
                          </View>
                        )}
                        <View style={styles.itemBody}>
                          <Text style={[styles.itemName, { textAlign }]}>
                            {item.product?.name || '—'}
                          </Text>
                          <Text style={[styles.itemMeta, { textAlign }]}>
                            {tUi('ui.pages.warehouse.warehouseApprovals.qty')}: {item.quantity} ×{' '}
                            {formatCurrency(item.price)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {order.user ? (
                    <Text style={[styles.customerLine, { textAlign }]}>
                      <Text style={styles.customerLabel}>
                        {tUi('ui.pages.warehouse.warehouseApprovals.customer')}:
                      </Text>{' '}
                      {[order.user.first_name, order.user.last_name].filter(Boolean).join(' ')} —{' '}
                      {order.user.email}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    countMeta: {
      fontSize: 12,
      color: colors.muted,
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
      marginBottom: 12,
      overflow: 'hidden',
      ...shadow,
    },
    orderHeader: {
      alignItems: 'center',
      padding: 14,
      gap: 10,
    },
    orderMain: {
      flex: 1,
    },
    orderEnd: {
      alignItems: 'flex-end',
    },
    orderId: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    orderMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    orderTotal: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    statusPill: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: isDark ? `${colors.primary}22` : '#EEF2FF',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    approveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 14,
      marginBottom: 14,
      backgroundColor: '#16a34a',
      borderRadius: 999,
      paddingVertical: 12,
    },
    approveButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    details: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 14,
      gap: 10,
    },
    itemRow: {
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
    itemBody: {
      flex: 1,
    },
    itemName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    itemMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.muted,
    },
    customerLine: {
      marginTop: 6,
      fontSize: 12,
      color: colors.muted,
    },
    customerLabel: {
      fontWeight: '700',
      color: colors.text,
    },
  });

export default WarehouseApprovalsScreen;
