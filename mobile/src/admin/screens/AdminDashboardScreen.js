import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import AdminScreen from '../components/AdminScreen';
import { colors, shadow } from '../styles/theme';
import http from '../../services/http';
import {
  ADMIN_SETTINGS_ENDPOINTS,
  DELIVERY_ENDPOINTS,
  ORDER_ENDPOINTS,
  PRODUCT_ENDPOINTS,
} from '../../config/api';
import { AuthContext } from '../../context/AuthContext';
import { useCurrency } from '../../hooks/useCurrency';

const AdminDashboardScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { formatCurrency } = useCurrency();
  const isOperationsManager = user?.role === 'operations_manager';

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    activeDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [thresholdInput, setThresholdInput] = useState('');
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [updatingThreshold, setUpdatingThreshold] = useState(false);
  const isInitialMount = useRef(true);

  const panelKicker = isOperationsManager ? 'Operations Panel' : 'Admin Panel';

  const fetchLowStockThreshold = useCallback(async () => {
    try {
      const response = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
      const threshold = response.data.threshold;
      setLowStockThreshold(threshold);
      setThresholdInput(String(threshold));
      return threshold;
    } catch (_) {
      setLowStockThreshold(10);
      setThresholdInput('10');
      return 10;
    }
  }, []);

  const fetchStats = useCallback(
    async (thresholdOverride = null) => {
      const effectiveThreshold = Number.isFinite(Number(thresholdOverride))
        ? Number(thresholdOverride)
        : Number(lowStockThreshold);
      setLoading(true);

      try {
        let totalProductsCount = 0;
        let lowStock = 0;
        if (!isOperationsManager) {
          try {
            const productsResponse = await http.get(PRODUCT_ENDPOINTS.ALL_ADMIN);
            const products = productsResponse.data || [];
            totalProductsCount = products.length;
            lowStock = products.filter((p) => p.quantity < effectiveThreshold).length;
          } catch (_) {}
        }

        let totalOrders = 0;
        let totalRevenue = 0;
        try {
          const ordersResponse = await http.get(ORDER_ENDPOINTS.ALL_ORDERS);
          const ordersData = Array.isArray(ordersResponse.data)
            ? ordersResponse.data
            : ordersResponse.data?.orders || [];
          totalOrders = ordersData.length;
          const revenueOrders = ordersData.filter((order) =>
            ['paid', 'shipped', 'delivered'].includes(order.status)
          );
          totalRevenue = revenueOrders.reduce(
            (sum, order) => sum + (parseFloat(order.total_amount) || 0),
            0
          );
        } catch (_) {}

        let activeDeliveries = 0;
        try {
          const deliveriesResponse = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
          const deliveriesData = Array.isArray(deliveriesResponse.data)
            ? deliveriesResponse.data
            : [];
          activeDeliveries = deliveriesData.filter((job) =>
            ['available', 'assigned', 'picked_up', 'delivering'].includes(job.status)
          ).length;
        } catch (_) {}

        setStats({
          totalProducts: totalProductsCount,
          totalOrders,
          totalRevenue,
          lowStockProducts: lowStock,
          activeDeliveries,
        });
      } finally {
        setLoading(false);
      }
    },
    [isOperationsManager, lowStockThreshold]
  );

  useEffect(() => {
    const initializeData = async () => {
      const threshold = await fetchLowStockThreshold();
      await fetchStats(threshold);
    };
    initializeData();
  }, [fetchLowStockThreshold, fetchStats]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (lowStockThreshold > 0) {
      fetchStats();
    }
  }, [lowStockThreshold, fetchStats]);

  const handleUpdateThreshold = async () => {
    const newThreshold = parseInt(thresholdInput, 10);
    if (Number.isNaN(newThreshold) || newThreshold < 1) {
      return;
    }

    setUpdatingThreshold(true);
    try {
      await http.put(ADMIN_SETTINGS_ENDPOINTS.UPDATE_LOW_STOCK_THRESHOLD, {
        threshold: newThreshold,
      });
      setLowStockThreshold(newThreshold);
      setShowThresholdModal(false);
      await fetchStats(newThreshold);
    } finally {
      setUpdatingThreshold(false);
    }
  };

  const statCards = useMemo(
    () =>
      [
        {
          key: 'totalProducts',
          title: 'Total Products',
          value: stats.totalProducts,
          icon: 'package',
          target: 'AdminProducts',
          hideForOps: true,
        },
        {
          key: 'totalOrders',
          title: 'Total Orders',
          value: stats.totalOrders,
          icon: 'clipboard',
          target: 'AdminOrders',
        },
        {
          key: 'totalRevenue',
          title: 'Total Revenue',
          value: formatCurrency(stats.totalRevenue),
          icon: 'dollar-sign',
          target: 'AdminOrders',
        },
        {
          key: 'lowStock',
          title: 'Low Stock Items',
          value: stats.lowStockProducts,
          icon: 'trending-down',
          target: 'AdminProducts',
          threshold: lowStockThreshold,
          hideForOps: true,
        },
        {
          key: 'activeDeliveries',
          title: 'Active Deliveries',
          value: stats.activeDeliveries,
          icon: 'truck',
          target: 'AdminDeliveries',
        },
      ].filter((card) => !(isOperationsManager && card.hideForOps)),
    [formatCurrency, isOperationsManager, lowStockThreshold, stats]
  );

  const actionCards = useMemo(
    () =>
      [
        {
          key: 'products',
          title: 'Manage Products',
          desc: 'Add, edit, or delete products',
          icon: 'package',
          target: 'AdminProducts',
          hideForOps: true,
        },
        {
          key: 'promotions',
          title: 'Manage Promotions',
          desc: 'Create rule-based cart promotions',
          icon: 'tag',
          target: 'AdminPromotions',
          hideForOps: true,
        },
        {
          key: 'categories',
          title: 'Manage Categories',
          desc: 'Organize product categories',
          icon: 'grid',
          target: 'AdminCategories',
          hideForOps: true,
        },
        {
          key: 'orders',
          title: 'View Orders',
          desc: 'Monitor customer orders',
          icon: 'clipboard',
          target: 'AdminOrders',
        },
        {
          key: 'deliveries',
          title: 'Delivery Jobs',
          desc: 'Track active deliveries',
          icon: 'truck',
          target: 'AdminDeliveries',
        },
        {
          key: 'pos',
          title: 'POS Analytics',
          desc: 'Review today\'s POS performance',
          icon: 'bar-chart-2',
          target: 'AdminPosAnalytics',
        },
      ].filter((card) => !(isOperationsManager && card.hideForOps)),
    [isOperationsManager]
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title="Admin Dashboard"
      subtitle="Overview of store performance and operations"
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Overview</Text>
          </View>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <Pressable
                key={card.key}
                style={styles.statCard}
                onPress={() => navigation.navigate(card.target)}
              >
                {card.threshold != null ? (
                  <Pressable
                    style={styles.statConfig}
                    onPress={(event) => {
                      event.stopPropagation();
                      setShowThresholdModal(true);
                    }}
                  >
                    <Feather name="settings" size={16} color={colors.muted} />
                  </Pressable>
                ) : null}
                <View style={styles.statTop}>
                  <View style={styles.statMain}>
                    <Text style={styles.statValue}>{card.value}</Text>
                    <Text style={styles.statLabel}>{card.title}</Text>
                    {card.threshold != null ? (
                      <Text style={styles.statMeta}>Threshold: {'<'} {card.threshold}</Text>
                    ) : null}
                  </View>
                  <View style={styles.statIcon}>
                    <Feather name={card.icon} size={24} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSubtitle}>Jump straight into key admin workflows.</Text>
          </View>
          <View style={styles.actionsGrid}>
            {actionCards.map((action) => (
              <Pressable
                key={action.key}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.target)}
              >
                <View style={styles.actionIcon}>
                  <Feather name={action.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDesc}>{action.desc}</Text>
                </View>
                <Feather name="arrow-right" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Modal transparent visible={showThresholdModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowThresholdModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Low Stock Threshold</Text>
            <Text style={styles.modalText}>
              Set the minimum inventory quantity before a product is flagged as low stock.
            </Text>
            <TextInput
              style={styles.input}
              value={thresholdInput}
              onChangeText={setThresholdInput}
              keyboardType="numeric"
              placeholder="Enter a number"
              placeholderTextColor={colors.muted}
            />
            <Pressable
              style={[styles.modalButton, updatingThreshold && styles.modalButtonDisabled]}
              onPress={handleUpdateThreshold}
              disabled={updatingThreshold}
            >
              <Text style={styles.modalButtonText}>
                {updatingThreshold ? 'Updating...' : 'Update Threshold'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  sectionHeader: {
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    ...shadow,
    marginBottom: 12,
  },
  statConfig: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
    zIndex: 2,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statMain: {
    flex: 1,
    paddingRight: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  statMeta: {
    marginTop: 6,
    fontSize: 11,
    color: colors.muted,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  actionsGrid: {
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
    marginBottom: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    marginRight: 12,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  actionDesc: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
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
  },
  modalText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.muted,
  },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    color: colors.surface,
    fontWeight: '700',
  },
});

export default AdminDashboardScreen;
