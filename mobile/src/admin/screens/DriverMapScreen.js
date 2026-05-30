import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import OrderMapTracker from '../components/OrderMapTracker';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { usePanelRole } from '../hooks/usePanelRole';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useDriverAvailableJobCount } from '../../hooks/useDriverJobCounts';
import { getDeliveryStatusLabel, getDeliveryStatusTone } from '../../utils/driverDeliveryStatus';

const DriverMapScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { textAlign, row } = useRtlLayout();
  const { refresh: refreshAvailableCount } = useDriverAvailableJobCount();
  useDriverLocation(true);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [expandedTab, setExpandedTab] = useState('overview');
  const [acceptingId, setAcceptingId] = useState(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.AVAILABLE_JOBS);
      setJobs(Array.isArray(response.data) ? response.data : []);
    } catch (_) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.driver.driverMap.noDeliveryJobsAvailableRight_53630e0d5a'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleAccept = async (jobId) => {
    setAcceptingId(jobId);
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.ACCEPT_JOB, { job_id: jobId }));
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.driver.driverMap.jobAcceptedSuccessfully_f36ff52c4a'),
      });
      setExpandedJobId(null);
      await fetchJobs();
      refreshAvailableCount();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || 'Failed to accept job',
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = async (jobId) => {
    try {
      await http.post(buildUrl(DELIVERY_ENDPOINTS.DECLINE_JOB, { job_id: jobId }));
      Toast.show({ type: 'info', text1: tUi('ui.pages.driver.driverMap.jobDeclined_9191aaa2f6') });
      setExpandedJobId(null);
      await fetchJobs();
      refreshAvailableCount();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.message || 'Failed to decline job' });
    }
  };

  const headerPill = (
    <View style={styles.headerPill}>
      <Text style={styles.headerPillText}>
        {jobs.length}
        {tUi('ui.pages.driver.driverMap.available_9488931dee')}
      </Text>
    </View>
  );

  const statusStyle = (status) => {
    const tone = getDeliveryStatusTone(status);
    if (tone === 'available') return styles.statusAvailable;
    if (tone === 'assigned') return styles.statusAssigned;
    if (tone === 'delivered') return styles.statusDelivered;
    if (tone === 'cancelled') return styles.statusCancelled;
    return styles.statusDefault;
  };

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.driver.driverMap.findDeliveryJobs_cfe3d4c660')}
      subtitle={tUi('ui.pages.driver.map.subtitle')}
      action={headerPill}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : jobs.length === 0 ? (
        <Text style={[styles.emptyText, { textAlign }]}>
          {tUi('ui.pages.driver.driverMap.noDeliveryJobsAvailableRight_53630e0d5a')}
        </Text>
      ) : (
        jobs.map((job) => {
          const isExpanded = expandedJobId === job.id;
          const customerName = job.customer
            ? `${job.customer.first_name} ${job.customer.last_name}`.trim()
            : null;

          return (
            <View key={job.id} style={styles.jobCard}>
              <Pressable
                onPress={() => {
                  setExpandedTab('overview');
                  setExpandedJobId(isExpanded ? null : job.id);
                }}
              >
                <View style={[styles.jobHeader, { flexDirection: row }]}>
                  <View style={styles.jobMain}>
                    <Text style={[styles.jobId, { textAlign }]}>
                      {tUi('ui.pages.driver.list.jobId')} #{job.id}
                    </Text>
                    <Text style={[styles.jobMeta, { textAlign }]}>
                      {tUi('ui.pages.driver.driverMap.order_78ea594e7c')}
                      {job.order_id}
                    </Text>
                    <Text style={[styles.jobMeta, { textAlign }]} numberOfLines={2}>
                      {job.pickup_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                    </Text>
                  </View>
                  <Text style={[styles.statusBadge, statusStyle(job.status)]}>
                    {getDeliveryStatusLabel(job.status, tUi)}
                  </Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.detailWrap}>
                  <View style={[styles.tabRow, { flexDirection: row }]}>
                    {['overview', 'map'].map((tab) => (
                      <Pressable
                        key={tab}
                        style={[styles.tabChip, expandedTab === tab && styles.tabChipActive]}
                        onPress={() => setExpandedTab(tab)}
                      >
                        <Text
                          style={[styles.tabChipText, expandedTab === tab && styles.tabChipTextActive]}
                        >
                          {tab === 'overview'
                            ? tUi('ui.pages.driver.list.tabOverview')
                            : tUi('ui.pages.driver.list.tabMap')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {expandedTab === 'overview' ? (
                    <>
                      <View style={styles.detailCard}>
                        <Text style={[styles.detailLabel, { textAlign }]}>
                          {tUi('ui.pages.driver.driverMap.pickup_d73f705138')}
                        </Text>
                        <Text style={[styles.detailValue, { textAlign }]}>
                          {job.pickup_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                        </Text>
                      </View>
                      <View style={styles.detailCard}>
                        <Text style={[styles.detailLabel, { textAlign }]}>
                          {tUi('ui.pages.driver.driverMap.delivery_08ebebf690')}
                        </Text>
                        <Text style={[styles.detailValue, { textAlign }]}>
                          {job.delivery_address || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                        </Text>
                      </View>
                      <View style={styles.detailCard}>
                        <Text style={[styles.detailLabel, { textAlign }]}>
                          {tUi('ui.pages.driver.driverMap.customer_d9db49ed61')}
                        </Text>
                        <Text style={[styles.detailValue, { textAlign }]}>
                          {customerName || tUi('ui.pages.driver.driverMap.nA_de3570823c')}
                        </Text>
                      </View>
                      {job.items?.length > 0 && (
                        <View style={[styles.tagsRow, { flexDirection: row }]}>
                          {job.items.map((item, idx) => (
                            <Text key={idx} style={styles.itemTag}>
                              {item.product?.name} x{item.quantity}
                            </Text>
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.mapWrap}>
                      <OrderMapTracker deliveryJob={job} />
                    </View>
                  )}

                  <View style={[styles.actionsRow, { flexDirection: row }]}>
                    <Pressable
                      style={[styles.acceptBtn, acceptingId === job.id && styles.btnDisabled]}
                      onPress={() => handleAccept(job.id)}
                      disabled={acceptingId === job.id}
                    >
                      <Text style={styles.acceptBtnText}>
                        {acceptingId === job.id
                          ? tUi('ui.pages.driver.driverMap.accepting_40f0cb67bc')
                          : tUi('ui.pages.driver.driverMap.acceptJob_83dec8187c')}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.declineBtn} onPress={() => handleDecline(job.id)}>
                      <Text style={styles.declineBtnText}>
                        {tUi('ui.pages.driver.driverMap.decline_7e736d807b')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    headerPill: {
      backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    headerPillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    loadingWrap: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { color: colors.muted, fontSize: 14, paddingVertical: 20 },
    jobCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
      ...shadow,
    },
    jobHeader: { alignItems: 'flex-start', gap: 12 },
    jobMain: { flex: 1 },
    jobId: { fontSize: 16, fontWeight: '700', color: colors.text },
    jobMeta: { marginTop: 4, fontSize: 12, color: colors.muted },
    statusBadge: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    statusAvailable: { color: '#16a34a', backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#DCFCE7' },
    statusAssigned: { color: '#2563eb', backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE' },
    statusDelivered: { color: '#16a34a', backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#DCFCE7' },
    statusCancelled: { color: '#dc2626', backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2' },
    statusDefault: { color: colors.muted, backgroundColor: colors.background },
    detailWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    tabRow: { flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    tabChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    tabChipTextActive: { color: '#fff' },
    detailCard: { marginBottom: 10 },
    detailLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
    detailValue: { marginTop: 4, fontSize: 14, color: colors.text },
    tagsRow: { flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    itemTag: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    mapWrap: { height: 260, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
    actionsRow: { gap: 8 },
    acceptBtn: {
      flex: 1,
      backgroundColor: '#16a34a',
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
    },
    acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    declineBtn: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    declineBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
    btnDisabled: { opacity: 0.6 },
  });

export default DriverMapScreen;
