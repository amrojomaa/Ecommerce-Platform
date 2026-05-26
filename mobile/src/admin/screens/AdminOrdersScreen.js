import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import { colors } from '../styles/theme';
import http from '../../services/http';
import { ORDER_ENDPOINTS } from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDateTime } from '../utils/format';

const STATUS_FILTERS = [
  'all',
  'revenue',
  'pos',
  'created',
  'paid',
  'assigned',
  'picked_up',
  'delivering',
  'shipped',
  'delivered',
  'cancelled',
];

const statusToneMap = {
  paid: 'success',
  shipped: 'success',
  delivered: 'success',
  assigned: 'warning',
  picked_up: 'warning',
  delivering: 'warning',
  pending: 'warning',
  created: 'default',
  cancelled: 'danger',
};

const AdminOrdersScreen = () => {
  const { formatCurrency } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
      const data = Array.isArray(response.data) ? response.data : response.data?.orders || [];
      setAllOrders(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    let list = [...allOrders];
    if (statusFilter === 'revenue') {
      list = list.filter((order) => ['paid', 'shipped', 'delivered'].includes(order.status));
    } else if (statusFilter === 'pos') {
      list = list.filter((order) => order.sale_channel === 'pos');
    } else if (statusFilter !== 'all') {
      list = list.filter((order) => (order.status || 'created') === statusFilter);
    }

    const term = searchQuery.trim().toLowerCase();
    if (term) {
      list = list.filter((order) => {
        const id = String(order.id || order.order_id || '').toLowerCase();
        const customer = String(order.customer_name || order.user?.email || '').toLowerCase();
        return id.includes(term) || customer.includes(term);
      });
    }

    setOrders(list);
  }, [allOrders, searchQuery, statusFilter]);

  const handleUpdateStatus = async (order, newStatus) => {
    if (!order || !newStatus) return;
    setUpdatingStatus(true);
    try {
      await http.patch(ORDER_ENDPOINTS.UPDATE_STATUS.replace('{order_id}', order.id), {
        status: newStatus,
      });
      const next = allOrders.map((item) =>
        item.id === order.id ? { ...item, status: newStatus } : item
      );
      setAllOrders(next);
      setStatusModalOrder(null);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getAvailableStatuses = (status) => {
    if (status === 'paid') return ['shipped', 'cancelled'];
    if (status === 'shipped') return ['delivered', 'cancelled'];
    if (['assigned', 'picked_up', 'delivering'].includes(status)) return ['cancelled'];
    return ['cancelled'];
  };

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === expandedOrderId) || null,
    [expandedOrderId, orders]
  );

  return (
    <AdminScreen title="Orders" subtitle="Track, filter, and update order status.">
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text
              style={[styles.filterText, statusFilter === filter && styles.filterTextActive]}
            >
              {filter.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search order or customer"
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {orders.map((order) => {
            const status = order.status || 'created';
            const meta = `${formatCurrency(order.total_amount || 0)} | ${formatDateTime(
              order.created_at
            )}`;
            return (
              <AdminListItem
                key={order.id}
                title={`Order #${order.id}`}
                subtitle={
                  order.sale_channel === 'pos'
                    ? order.customer_name || 'POS Order'
                    : order.user?.email || 'Customer'
                }
                meta={meta}
                status={status}
                statusTone={statusToneMap[status] || 'default'}
                onPress={() =>
                  setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                }
                right={
                  <Pressable onPress={() => setStatusModalOrder(order)}>
                    <Text style={styles.inlineButton}>Update</Text>
                  </Pressable>
                }
              />
            );
          })}
          {!orders.length ? (
            <Text style={styles.emptyText}>No orders found.</Text>
          ) : null}
        </View>
      )}

      {selectedOrder ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Order Details</Text>
          <Text style={styles.detailMeta}>{`Order #${selectedOrder.id}`}</Text>
          <Text style={styles.detailMeta}>{formatDateTime(selectedOrder.created_at)}</Text>
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Items</Text>
            {(selectedOrder.items || selectedOrder.orderitems || []).map((item) => (
              <View key={item.id} style={styles.detailRow}>
                <Text style={styles.detailValue}>
                  {item.product?.name || `Item #${item.product_id}`}
                </Text>
                <Text style={styles.detailValue}>{`${item.quantity} x ${formatCurrency(
                  item.price
                )}`}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Modal transparent visible={!!statusModalOrder} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setStatusModalOrder(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Update status</Text>
            {statusModalOrder &&
              getAvailableStatuses(statusModalOrder.status || 'created').map((status) => (
                <Pressable
                  key={status}
                  style={styles.modalOption}
                  onPress={() => handleUpdateStatus(statusModalOrder, status)}
                  disabled={updatingStatus}
                >
                  <Text style={styles.modalOptionText}>{status.replace('_', ' ')}</Text>
                </Pressable>
              ))}
            <Pressable style={styles.secondaryButton} onPress={() => setStatusModalOrder(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.surface,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  inlineButton: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  detailMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  detailSection: {
    marginTop: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 10,
  },
  modalOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
});

export default AdminOrdersScreen;
