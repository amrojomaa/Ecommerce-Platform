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
import { DELIVERY_ENDPOINTS } from '../../config/api';
import { usePanelRole } from '../hooks/usePanelRole';

const DriverDashboardScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign, row, isRtl } = useRtlLayout();
  const arrowIcon = isRtl ? 'arrow-left' : 'arrow-right';
  const navigation = useNavigation();
  const { panelKicker } = usePanelRole();

  const [activeCount, setActiveCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, availableRes] = await Promise.all([
        http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS),
        http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS),
      ]);
      setActiveCount(Array.isArray(activeRes.data) ? activeRes.data.length : 0);
      setAvailableCount(Array.isArray(availableRes.data) ? availableRes.data.length : 0);
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
        key: 'active',
        title: tUi('ui.pages.driver.driverDashboard.activeDeliveries_b212236f76'),
        value: activeCount,
        icon: 'truck',
        target: 'DriverActiveJob',
      },
      {
        key: 'available',
        title: tUi('ui.pages.driver.driverDashboard.availableJobs_cc23afe56a'),
        value: availableCount,
        icon: 'package',
        target: 'DriverMap',
      },
    ],
    [activeCount, availableCount, tUi]
  );

  const actionCards = useMemo(
    () => [
      {
        key: 'map',
        title: tUi('ui.pages.driver.driverDashboard.findJobs_d0c3b5a149'),
        desc: tUi('ui.pages.driver.driverDashboard.viewAvailableDeliveryRequestsOn_aa9ad5470b'),
        icon: 'map-pin',
        target: 'DriverMap',
      },
      {
        key: 'active',
        title: tUi('ui.pages.driver.driverDashboard.activeDelivery_dbf7ad5b46'),
        desc: tUi('ui.pages.driver.driverDashboard.trackAndManageYourCurrent_e78d8342ac'),
        icon: 'truck',
        target: 'DriverActiveJob',
      },
      {
        key: 'history',
        title: tUi('ui.pages.driver.driverDashboard.deliveryHistory_853624d313'),
        desc: tUi('ui.pages.driver.driverDashboard.viewYourCompletedDeliveries_5595c582d7'),
        icon: 'clipboard',
        target: 'DriverJobHistory',
      },
    ],
    [tUi]
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.driver.driverDashboard.driverDashboard_6764ab49f0')}
      subtitle={tUi('ui.pages.driver.dashboard.subtitle')}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.driver.dashboard.section.overview')}
          </Text>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <Pressable
                key={card.key}
                style={styles.statCard}
                onPress={() => navigation.navigate(card.target)}
              >
                <View style={[styles.statTop, { flexDirection: row }]}>
                  <View style={styles.statMain}>
                    <Text style={[styles.statValue, { textAlign }]}>{card.value}</Text>
                    <Text style={[styles.statLabel, { textAlign }]}>{card.title}</Text>
                  </View>
                  <View style={styles.statIcon}>
                    <Feather name={card.icon} size={22} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { textAlign }]}>
            {tUi('ui.pages.driver.dashboard.section.quickActions')}
          </Text>
          <Text style={[styles.sectionSubtitle, { textAlign }]}>
            {tUi('ui.pages.driver.dashboard.section.quickActionsDesc')}
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
        </>
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    loadingWrap: { paddingVertical: 40, alignItems: 'center' },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      marginTop: 6,
    },
    sectionSubtitle: { fontSize: 13, color: colors.muted, marginBottom: 12 },
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
    statTop: { justifyContent: 'space-between' },
    statMain: { flex: 1, paddingRight: 8 },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
    statLabel: { marginTop: 4, fontSize: 13, color: colors.muted },
    statIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? `${colors.primary}22` : '#EEF2FF',
    },
    actionsGrid: { marginBottom: 12 },
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
    actionBody: { flex: 1 },
    actionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    actionDesc: { marginTop: 4, fontSize: 12, color: colors.muted },
  });

export default DriverDashboardScreen;
