import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import {
  ADMIN_SETTINGS_ENDPOINTS,
  DELIVERY_ENDPOINTS,
  INSTALLMENT_ENDPOINTS,
  ORDER_ENDPOINTS,
  PRODUCT_ENDPOINTS,
} from '../../config/api';
import { useCurrency } from '../../hooks/useCurrency';
import { usePanelRole } from '../hooks/usePanelRole';
import { filterOrdersByStatus } from '../../utils/orderStatuses';

const AdminDashboardScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row, isRtl } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };
  const arrowIcon = isRtl ? 'arrow-left' : 'arrow-right';

  const navigation = useNavigation();
  const { formatCurrency } = useCurrency();
  const { isOperationsManager, panelKicker } = usePanelRole();

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    activeDeliveries: 0,
    pendingInstallments: 0,
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
          totalRevenue = filterOrdersByStatus(ordersData, 'revenue').reduce(
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

        let pendingInstallments = 0;
        if (isOperationsManager) {
          try {
            const installmentsResponse = await http.get(INSTALLMENT_ENDPOINTS.ADMIN_REQUESTS, {
              params: { status_filter: 'pending' },
            });
            const installmentsData = Array.isArray(installmentsResponse.data)
              ? installmentsResponse.data
              : installmentsResponse.data?.requests || [];
            pendingInstallments = installmentsData.filter(
              (request) => String(request.status || '').toLowerCase() === 'pending'
            ).length;
          } catch (_) {}
        }

        setStats({
          totalProducts: totalProductsCount,
          totalOrders,
          totalRevenue,
          lowStockProducts: lowStock,
          activeDeliveries,
          pendingInstallments,
        });
      } finally {
        setLoading(false);
      }
    },
    [isOperationsManager, lowStockThreshold]
  );

  useEffect(() => {
    const initializeData = async () => {
      if (isOperationsManager) {
        await fetchStats();
        return;
      }
      const threshold = await fetchLowStockThreshold();
      await fetchStats(threshold);
    };
    initializeData();
  }, [fetchLowStockThreshold, fetchStats, isOperationsManager]);

  useEffect(() => {
    if (isOperationsManager || isInitialMount.current) {
      if (isInitialMount.current) {
        isInitialMount.current = false;
      }
      return;
    }
    if (lowStockThreshold > 0) {
      fetchStats();
    }
  }, [lowStockThreshold, fetchStats, isOperationsManager]);

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

  const statCards = useMemo(() => {
    if (isOperationsManager) {
      return [
        {
          key: 'totalOrders',
          title: tUi('ui.pages.admin.operationsManagerDashboard.stat.totalOrders'),
          value: stats.totalOrders,
          icon: 'clipboard',
          target: 'AdminOrders',
        },
        {
          key: 'totalRevenue',
          title: tUi('ui.pages.admin.operationsManagerDashboard.stat.totalRevenue'),
          value: formatCurrency(stats.totalRevenue),
          icon: 'dollar-sign',
          target: 'AdminOrders',
        },
        {
          key: 'activeDeliveries',
          title: tUi('ui.pages.admin.operationsManagerDashboard.stat.activeDeliveries'),
          value: stats.activeDeliveries,
          icon: 'truck',
          target: 'AdminDeliveries',
        },
        {
          key: 'pendingInstallments',
          title: tUi('ui.pages.admin.operationsManagerDashboard.stat.pendingInstallments'),
          value: stats.pendingInstallments,
          icon: 'credit-card',
          target: 'AdminInstallments',
        },
      ];
    }

    return [
      {
        key: 'totalProducts',
        title: tUi('ui.pages.admin.adminDashboard.totalProducts_d457551dae'),
        value: stats.totalProducts,
        icon: 'package',
        target: 'AdminProducts',
        hideForOps: true,
      },
      {
        key: 'totalOrders',
        title: tUi('ui.pages.admin.adminDashboard.totalOrders_3968b1aea2'),
        value: stats.totalOrders,
        icon: 'clipboard',
        target: 'AdminOrders',
      },
      {
        key: 'totalRevenue',
        title: tUi('ui.pages.admin.adminDashboard.totalRevenue_8625d01bf6'),
        value: formatCurrency(stats.totalRevenue),
        icon: 'dollar-sign',
        target: 'AdminOrders',
      },
      {
        key: 'lowStock',
        title: tUi('ui.pages.admin.adminDashboard.lowStockItems_5d20c43c41'),
        value: stats.lowStockProducts,
        icon: 'trending-down',
        target: 'AdminProducts',
        threshold: lowStockThreshold,
        hideForOps: true,
      },
      {
        key: 'activeDeliveries',
        title: tUi('ui.pages.admin.adminDashboard.activeDeliveries_88b2551152'),
        value: stats.activeDeliveries,
        icon: 'truck',
        target: 'AdminDeliveries',
      },
    ];
  }, [formatCurrency, isOperationsManager, lowStockThreshold, stats, tUi]);

  const actionCards = useMemo(() => {
    if (isOperationsManager) {
      return [
        {
          key: 'orders',
          title: tUi('ui.pages.admin.operationsManagerDashboard.action.orders.title'),
          desc: tUi('ui.pages.admin.operationsManagerDashboard.action.orders.desc'),
          icon: 'clipboard',
          target: 'AdminOrders',
        },
        {
          key: 'installments',
          title: tUi('ui.pages.admin.operationsManagerDashboard.action.installments.title'),
          desc: tUi('ui.pages.admin.operationsManagerDashboard.action.installments.desc'),
          icon: 'credit-card',
          target: 'AdminInstallments',
        },
        {
          key: 'deliveries',
          title: tUi('ui.pages.admin.operationsManagerDashboard.action.deliveries.title'),
          desc: tUi('ui.pages.admin.operationsManagerDashboard.action.deliveries.desc'),
          icon: 'truck',
          target: 'AdminDeliveries',
        },
      ];
    }

    return [
      {
        key: 'products',
        title: tUi('ui.pages.admin.adminDashboard.manageProducts_f61663679a'),
        desc: tUi('ui.pages.admin.adminDashboard.addEditOrDeleteProducts_e0122eec91'),
        icon: 'package',
        target: 'AdminProducts',
        hideForOps: true,
      },
      {
        key: 'promotions',
        title: tUi('ui.pages.admin.adminDashboard.managePromotions_48a31a922f'),
        desc: tUi('ui.pages.admin.adminDashboard.createRuleBasedCartAnd_1861c140e1'),
        icon: 'tag',
        target: 'AdminPromotions',
        hideForOps: true,
      },
      {
        key: 'categories',
        title: tUi('ui.pages.admin.adminDashboard.manageCategories_ca9b3bad2a'),
        desc: tUi('ui.pages.admin.adminDashboard.organizeYourProductCategories_4e86f7c153'),
        icon: 'grid',
        target: 'AdminCategories',
        hideForOps: true,
      },
      {
        key: 'orders',
        title: tUi('ui.pages.admin.adminDashboard.viewOrders_9d4d2887cf'),
        desc: tUi('ui.pages.admin.adminDashboard.monitorCustomerOrders_026e4ad4df'),
        icon: 'clipboard',
        target: 'AdminOrders',
      },
      {
        key: 'deliveries',
        title: tUi('ui.pages.admin.adminDashboard.action.deliveries.title'),
        desc: tUi('ui.pages.admin.adminDashboard.action.deliveries.desc'),
        icon: 'truck',
        target: 'AdminDeliveries',
      },
      {
        key: 'pos',
        title: tUi('ui.pages.admin.adminDashboard.action.posAnalytics.title'),
        desc: tUi('ui.pages.admin.adminDashboard.action.posAnalytics.desc'),
        icon: 'bar-chart-2',
        target: 'AdminPosAnalytics',
      },
    ];
  }, [isOperationsManager, tUi]);

  const dashboardTitle = isOperationsManager
    ? tUi('ui.pages.admin.operationsManagerDashboard.title')
    : tUi('ui.pages.admin.adminDashboard.adminDashboard_16654f6473');

  const dashboardSubtitle = isOperationsManager
    ? tUi('ui.pages.admin.operationsManagerDashboard.subtitle')
    : tUi('ui.pages.admin.adminDashboard.subtitle');

  const overviewLabel = isOperationsManager
    ? tUi('ui.pages.admin.operationsManagerDashboard.section.overview')
    : tUi('ui.pages.admin.adminDashboard.section.overview');

  const quickActionsLabel = isOperationsManager
    ? tUi('ui.pages.admin.operationsManagerDashboard.section.quickActions')
    : tUi('ui.pages.admin.adminDashboard.section.quickActions');

  const quickActionsDesc = isOperationsManager
    ? tUi('ui.pages.admin.operationsManagerDashboard.section.quickActionsDesc')
    : tUi('ui.pages.admin.adminDashboard.section.quickActionsDesc');

  return (
    <AdminScreen kicker={panelKicker} title={dashboardTitle} subtitle={dashboardSubtitle}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { textAlign }]}>{overviewLabel}</Text>
          </View>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <Pressable
                key={card.key}
                style={styles.statCard}
                onPress={() => navigation.navigate(card.target)}
              >
                {!isOperationsManager && card.threshold != null ? (
                  <Pressable
                    style={[styles.statConfig, isRtl ? styles.statConfigRtl : null]}
                    onPress={(event) => {
                      event.stopPropagation();
                      setShowThresholdModal(true);
                    }}
                  >
                    <Feather name="settings" size={16} color={colors.muted} />
                  </Pressable>
                ) : null}
                <View style={[styles.statTop, { flexDirection: row }]}>
                  <View style={styles.statMain}>
                    <Text style={[styles.statValue, { textAlign }]}>{card.value}</Text>
                    <Text style={[styles.statLabel, { textAlign }]}>{card.title}</Text>
                    {!isOperationsManager && card.threshold != null ? (
                      <Text style={[styles.statMeta, { textAlign }]}>
                        {tUi('ui.pages.admin.adminDashboard.threshold_5e08be5809')} {'<'} {card.threshold}
                      </Text>
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
            <Text style={[styles.sectionTitle, { textAlign }]}>{quickActionsLabel}</Text>
            <Text style={[styles.sectionSubtitle, { textAlign }]}>{quickActionsDesc}</Text>
          </View>
          <View style={styles.actionsGrid}>
            {actionCards.map((action) => (
              <Pressable
                key={action.key}
                style={[styles.actionCard, { flexDirection: row }]}
                onPress={() => navigation.navigate(action.target)}
              >
                <View style={styles.actionIcon}>
                  <Feather name={action.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { textAlign }]}>{action.title}</Text>
                  <Text style={[styles.actionDesc, { textAlign }]}>{action.desc}</Text>
                </View>
                <Feather name={arrowIcon} size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      {!isOperationsManager ? (
        <Modal transparent visible={showThresholdModal} animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowThresholdModal(false)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {tUi('ui.pages.admin.adminDashboard.configureLowStockThreshold_22dcb80c15')}
              </Text>
              <Text style={styles.modalText}>
                {tUi('ui.pages.admin.adminDashboard.setTheMinimumQuantityThreshold_fe35c5b475')}
              </Text>
              <TextInput
                style={[styles.input, inputRtlStyle]}
                value={thresholdInput}
                onChangeText={setThresholdInput}
                keyboardType="numeric"
                placeholder={tUi('ui.pages.admin.adminDashboard.enterThreshold_219f1692b7')}
                placeholderTextColor={colors.muted}
              />
              <Pressable
                style={[styles.modalButton, updatingThreshold && styles.modalButtonDisabled]}
                onPress={handleUpdateThreshold}
                disabled={updatingThreshold}
              >
                <Text style={styles.modalButtonText}>
                  {updatingThreshold
                    ? tUi('ui.pages.admin.adminDashboard.updating_6f3aa97175')
                    : tUi('ui.pages.admin.adminDashboard.update_9caf0051b0')}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
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
    statConfigRtl: {
      right: undefined,
      left: 12,
    },
    statTop: {
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
      backgroundColor: isDark ? `${colors.primary}22` : '#EEF2FF',
    },
    actionsGrid: {
      marginBottom: 12,
    },
    actionCard: {
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
      backgroundColor: isDark ? `${colors.primary}22` : '#E0F2FE',
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
      backgroundColor: colors.overlay,
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
