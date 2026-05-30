import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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
  PRODUCT_ENDPOINTS,
  WAREHOUSE_ENDPOINTS,
} from '../../config/api';
import { usePanelRole } from '../hooks/usePanelRole';

const WarehouseManagerDashboardScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row, isRtl } = useRtlLayout();
  const arrowIcon = isRtl ? 'arrow-left' : 'arrow-right';
  const navigation = useNavigation();
  const { panelKicker } = usePanelRole();

  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    packedQueue: 0,
    openIssues: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let threshold = 10;
      try {
        const threshRes = await http.get(ADMIN_SETTINGS_ENDPOINTS.GET_LOW_STOCK_THRESHOLD);
        threshold = threshRes.data.threshold;
        setLowStockThreshold(threshold);
      } catch (_) {}

      const [productsRes, packedRes, issuesRes] = await Promise.all([
        http.get(PRODUCT_ENDPOINTS.ALL_ADMIN),
        http.get(WAREHOUSE_ENDPOINTS.PACKED_REVIEW),
        http.get(`${WAREHOUSE_ENDPOINTS.ALL_ISSUES}?status_filter=open`),
      ]);

      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const packed = Array.isArray(packedRes.data) ? packedRes.data : [];
      const issues = Array.isArray(issuesRes.data) ? issuesRes.data : [];
      const lowStock = products.filter((p) => p.quantity > 0 && p.quantity < threshold);
      const outOfStock = products.filter((p) => p.quantity === 0);

      setLowStockItems([...outOfStock, ...lowStock].slice(0, 8));
      setStats({
        totalProducts: products.length,
        lowStock: lowStock.length,
        outOfStock: outOfStock.length,
        packedQueue: packed.length,
        openIssues: issues.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = useMemo(
    () => [
      {
        key: 'totalProducts',
        title: tUi('ui.pages.warehouse.warehouseDashboard.stat.totalProducts'),
        value: stats.totalProducts,
        icon: 'package',
        target: 'WarehouseInventory',
        params: {},
      },
      {
        key: 'lowStock',
        title: tUi('ui.pages.warehouse.warehouseDashboard.stat.lowStock'),
        value: stats.lowStock,
        icon: 'trending-down',
        target: 'WarehouseInventory',
        params: { stock: 'low' },
        threshold: lowStockThreshold,
      },
      {
        key: 'outOfStock',
        title: tUi('ui.pages.warehouse.warehouseDashboard.stat.outOfStock'),
        value: stats.outOfStock,
        icon: 'slash',
        target: 'WarehouseInventory',
        params: { stock: 'out' },
      },
      {
        key: 'awaitingApproval',
        title: tUi('ui.pages.warehouse.warehouseDashboard.stat.awaitingApproval'),
        value: stats.packedQueue,
        icon: 'check-circle',
        target: 'WarehouseApprovals',
        params: {},
      },
      {
        key: 'openIssues',
        title: tUi('ui.pages.warehouse.warehouseDashboard.stat.openIssues'),
        value: stats.openIssues,
        icon: 'alert-triangle',
        target: 'WarehouseIssues',
        params: { filter: 'open' },
      },
    ],
    [lowStockThreshold, stats, tUi]
  );

  const actionCards = useMemo(
    () => [
      {
        key: 'inventory',
        title: tUi('ui.pages.warehouse.warehouseDashboard.action.inventory.title'),
        desc: tUi('ui.pages.warehouse.warehouseDashboard.action.inventory.desc'),
        icon: 'package',
        target: 'WarehouseInventory',
      },
      {
        key: 'approvals',
        title: tUi('ui.pages.warehouse.warehouseDashboard.action.approvals.title'),
        desc: tUi('ui.pages.warehouse.warehouseDashboard.action.approvals.desc'),
        icon: 'check-circle',
        target: 'WarehouseApprovals',
      },
      {
        key: 'issues',
        title: tUi('ui.pages.warehouse.warehouseDashboard.action.issues.title'),
        desc: tUi('ui.pages.warehouse.warehouseDashboard.action.issues.desc'),
        icon: 'alert-triangle',
        target: 'WarehouseIssues',
      },
    ],
    [tUi]
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.warehouse.warehouseDashboard.title')}
      subtitle={tUi('ui.pages.warehouse.warehouseDashboard.subtitle')}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.warehouse.warehouseDashboard.section.overview')}
          </Text>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <Pressable
                key={card.key}
                style={styles.statCard}
                onPress={() => navigation.navigate(card.target, card.params)}
              >
                <View style={[styles.statTop, { flexDirection: row }]}>
                  <View style={styles.statMain}>
                    <Text style={[styles.statValue, { textAlign }]}>{card.value}</Text>
                    <Text style={[styles.statLabel, { textAlign }]}>{card.title}</Text>
                    {card.threshold != null ? (
                      <Text style={[styles.statMeta, { textAlign }]}>
                        {`${tUi('ui.pages.warehouse.warehouseDashboard.thresholdLabel')} < ${card.threshold}`}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.statIcon}>
                    <Feather name={card.icon} size={22} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.warehouse.warehouseDashboard.section.quickActions')}
          </Text>
          <Text style={[styles.sectionSubtitle, { textAlign }]}>
            {tUi('ui.pages.warehouse.warehouseDashboard.section.quickActionsDesc')}
          </Text>
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

          {(lowStockItems.length > 0 || stats.totalProducts > 0) && (
            <>
              <Text style={[styles.sectionTitle, { textAlign }]}>
                {tUi('ui.pages.warehouse.warehouseDashboard.section.stockAlerts')}
              </Text>
              {lowStockItems.length ? (
                lowStockItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.alertItem,
                      item.quantity === 0 ? styles.alertCritical : styles.alertWarn,
                    ]}
                    onPress={() =>
                      navigation.navigate('WarehouseInventory', {
                        stock: item.quantity === 0 ? 'out' : 'low',
                      })
                    }
                  >
                    <Text style={[styles.alertTitle, { textAlign }]}>{item.name}</Text>
                    <Text style={[styles.alertMeta, { textAlign }]}>
                      {item.quantity === 0
                        ? tUi('ui.pages.warehouse.warehouseDashboard.stock.outOfStock')
                        : tUi('ui.pages.warehouse.warehouseDashboard.stock.lowRemaining', {
                            count: item.quantity,
                          })}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.alertOk}>
                  <Text style={[styles.alertTitle, { textAlign }]}>
                    {tUi('ui.pages.warehouse.warehouseDashboard.stock.allGood')}
                  </Text>
                  <Text style={[styles.alertMeta, { textAlign }]}>
                    {tUi('ui.pages.warehouse.warehouseDashboard.stock.allGoodDesc', {
                      count: lowStockThreshold,
                    })}
                  </Text>
                </View>
              )}
            </>
          )}
        </>
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    loadingWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      marginTop: 6,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    statCard: {
      flexBasis: '48%',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      ...shadow,
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
      marginTop: 4,
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
      marginBottom: 12,
      ...shadow,
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
    alertItem: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
    },
    alertCritical: {
      backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEF2F2',
      borderColor: isDark ? 'rgba(220,38,38,0.35)' : '#FECACA',
    },
    alertWarn: {
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FFFBEB',
      borderColor: isDark ? 'rgba(217,119,6,0.35)' : '#FDE68A',
    },
    alertOk: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(22,163,74,0.3)' : '#BBF7D0',
    },
    alertTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    alertMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
  });

export default WarehouseManagerDashboardScreen;
