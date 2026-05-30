import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import OrderMapTracker from '../components/OrderMapTracker';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { buildImageUrl, formatDate, formatDateTime } from '../utils/format';
import { useCurrency } from '../../hooks/useCurrency';
import { usePanelRole } from '../hooks/usePanelRole';

const STATUS_FILTERS = [
  'all',
  'available',
  'assigned',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
];

const DELIVERY_STATUS_LABEL_KEYS = {
  available: 'ui.pages.admin.adminDeliveries.available_66883aa01e',
  assigned: 'ui.pages.orders.status.assigned',
  picked_up: 'ui.pages.orders.status.pickedUp',
  delivering: 'ui.pages.orders.status.delivering',
  delivered: 'ui.pages.admin.adminDeliveries.delivered_7131e29334',
  cancelled: 'ui.pages.orders.status.cancelled',
};

const PHOTO_TYPE_LABEL_KEYS = {
  pickup: 'ui.pages.admin.adminDeliveries.pickupProof_de18bafb10',
  delivery: 'ui.pages.admin.adminDeliveries.deliveryProof_8e26a61d41',
};

const statusToneMap = {
  available: 'default',
  assigned: 'warning',
  picked_up: 'warning',
  delivering: 'warning',
  delivered: 'success',
  cancelled: 'danger',
};

const AdminDeliveriesScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { isRtl, textAlign, row, alignSelfEnd, alignSelfStart } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const { formatCurrency } = useCurrency();

  const mapLabels = useMemo(
    () => ({
      unavailable: tUi('ui.mobile.mapTracker.unavailable'),
      coordsUnavailable: tUi('ui.mobile.mapTracker.coordsUnavailable'),
      pickup: tUi('ui.mobile.mapTracker.pickupLocation'),
      delivery: tUi('ui.mobile.mapTracker.deliveryLocation'),
      driver: tUi('ui.mobile.mapTracker.driverLocation'),
      live: tUi('ui.mobile.mapTracker.liveTracking'),
      deliveryCompleted: tUi('ui.mobile.adminDeliveries.deliveryCompleted'),
      deliveryCancelled: tUi('ui.mobile.adminDeliveries.deliveryCancelled'),
      trackingDeliveredInactive: tUi('ui.mobile.adminDeliveries.trackingDeliveredInactive'),
      trackingCancelledInactive: tUi('ui.mobile.adminDeliveries.trackingCancelledInactive'),
    }),
    [tUi]
  );

  const getStatusLabel = useCallback(
    (status) => {
      const normalized = String(status || '').toLowerCase();
      const key = DELIVERY_STATUS_LABEL_KEYS[normalized];
      if (key) return tUi(key);
      return normalized.replace(/_/g, ' ');
    },
    [tUi]
  );

  const getStatusFilterLabel = useCallback(
    (status) => {
      if (status === 'all') {
        return tUi('ui.pages.admin.adminDeliveries.all_37e6961373');
      }
      return getStatusLabel(status);
    },
    [getStatusLabel, tUi]
  );

  const getPhotoTypeLabel = useCallback(
    (type) => {
      const key = PHOTO_TYPE_LABEL_KEYS[type];
      return key ? tUi(key) : type;
    },
    [tUi]
  );
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [assignModalJob, setAssignModalJob] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [reviewingPhotoType, setReviewingPhotoType] = useState(null);
  const [expandedJobTab, setExpandedJobTab] = useState('overview');
  const [issueMessages, setIssueMessages] = useState([]);
  const [issueMessagesLoading, setIssueMessagesLoading] = useState(false);
  const [issueMessageText, setIssueMessageText] = useState('');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ALL_JOBS);
      setAllJobs(response.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.DRIVERS);
      setDrivers(response.data || []);
    } catch (_) {
      setDrivers([]);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchDrivers();
  }, [fetchDrivers, fetchJobs]);

  useEffect(() => {
    const filtered = statusFilter === 'all'
      ? allJobs
      : allJobs.filter((job) => (job.status || '').toLowerCase() === statusFilter);
    setJobs(filtered);
  }, [allJobs, statusFilter]);

  const handleAssignDriver = async () => {
    if (!assignModalJob) return;
    if (!selectedDriverId) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.admin.adminDeliveries.pleaseSelectADriverFirst_409da1b2f7'),
      });
      return;
    }
    try {
      await http.patch(buildUrl(DELIVERY_ENDPOINTS.ASSIGN_DRIVER, { job_id: assignModalJob.id }), {
        driver_id: Number(selectedDriverId),
      });
      setAssignModalJob(null);
      setSelectedDriverId('');
      fetchJobs();
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.admin.adminDeliveries.driverAssignedSuccessfully_d1e7b8c241'),
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.toast.operationFailed'),
      });
    }
  };

  const handleReviewPhoto = async (jobId, photoType) => {
    setReviewingPhotoType(`${jobId}-${photoType}`);
    try {
      const url = buildUrl(DELIVERY_ENDPOINTS.REVIEW_PHOTO, { job_id: jobId });
      const response = await http.post(`${url}?photo_type=${photoType}`);
      const updated = response.data;
      setAllJobs((prev) => prev.map((job) => (job.id === jobId ? updated : job)));
    } finally {
      setReviewingPhotoType(null);
    }
  };

  const handleResolveIssue = async (jobId) => {
    const confirmed = await confirmAction(
      tUi('ui.pages.admin.adminDeliveries.markAsSolved_d73588c2d7'),
      tUi('ui.pages.admin.adminDeliveries.issueClosedByAdmin_a88a36322d'),
      tUi('ui.mobile.common.confirm'),
      tUi('ui.mobile.common.cancel')
    );
    if (!confirmed) return;
    try {
      await http.patch(buildUrl(DELIVERY_ENDPOINTS.RESOLVE_ISSUE, { job_id: jobId }));
      fetchJobs();
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.admin.adminDeliveries.issueMarkedAsSolved_9610dc7d9b'),
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.toast.operationFailed'),
      });
    }
  };

  const fetchIssueMessages = useCallback(async (jobId) => {
    if (!jobId) return;
    setIssueMessagesLoading(true);
    try {
      const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.ISSUE_MESSAGES, { job_id: jobId }));
      setIssueMessages(response.data || []);
    } finally {
      setIssueMessagesLoading(false);
    }
  }, []);

  const handleSendIssueMessage = async () => {
    if (!expandedJobId || !issueMessageText.trim()) return;
    await http.post(buildUrl(DELIVERY_ENDPOINTS.ISSUE_MESSAGES, { job_id: expandedJobId }), {
      message: issueMessageText.trim(),
    });
    setIssueMessageText('');
    fetchIssueMessages(expandedJobId);
  };

  const selectedJob = useMemo(
    () => allJobs.find((job) => job.id === expandedJobId) || null,
    [allJobs, expandedJobId]
  );

  useEffect(() => {
    setIssueMessages([]);
    setIssueMessageText('');
    setExpandedJobTab('overview');
    if (selectedJob?.issue_type) {
      fetchIssueMessages(selectedJob.id);
    }
  }, [fetchIssueMessages, selectedJob?.id, selectedJob?.issue_type]);

  const issueCount = allJobs.filter((job) => job.issue_type && !job.issue_resolved).length;
  const proofCount = allJobs.filter((job) => {
    const status = (job.status || '').toLowerCase();
    if (['cancelled', 'delivered'].includes(status)) return false;
    const photos = job.photos || [];
    const hasPickup = photos.some((p) => p.photo_type === 'pickup');
    const hasDelivery = photos.some((p) => p.photo_type === 'delivery');
    const needsPickupReview = hasPickup && !job.pickup_photo_checked;
    const needsDeliveryReview = hasDelivery && !job.delivery_photo_checked;
    return needsPickupReview || needsDeliveryReview;
  }).length;

  const formatCoords = (lat, lng) => {
    const unavailable = tUi('ui.mobile.adminDeliveries.coordinatesUnavailable');
    if (lat == null || lng == null) return unavailable;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return unavailable;
    return `(${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
  };

  const customerName = (customer) => {
    if (!customer) return tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e');
    return (
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
      tUi('ui.pages.admin.adminUsers.customer_68c8b84985')
    );
  };

  const photosByType = (job, type) => (job.photos || []).filter((photo) => photo.photo_type === type);

  const renderPhotoGroup = (job, type, checked) => {
    const label = getPhotoTypeLabel(type);
    const photos = photosByType(job, type);
    if (!photos.length) {
      return (
        <View style={styles.photoGroup}>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Text style={styles.emptyInline}>
            {tUi('ui.pages.admin.adminInstallments.notUploaded_b78a3d1521')}
          </Text>
        </View>
      );
    }

    const reviewKey = `${job.id}-${type}`;
    return (
      <View style={styles.photoGroup}>
        <View style={[styles.sectionHeaderRow, { flexDirection: row }]}>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Pressable
            style={[styles.smallActionButton, checked && styles.smallActionButtonDisabled]}
            disabled={checked || reviewingPhotoType === reviewKey}
            onPress={() => handleReviewPhoto(job.id, type)}
          >
            <Text style={styles.smallActionText}>
              {checked
                ? tUi('ui.pages.admin.adminDeliveries.checkedOk_c8b794882a')
                : reviewingPhotoType === reviewKey
                  ? tUi('ui.pages.admin.adminDeliveries.saving_3400c1bb21')
                  : tUi('ui.pages.admin.adminDeliveries.markOk_245791044e')}
            </Text>
          </Pressable>
        </View>
        <View style={[styles.photoGrid, { flexDirection: row }]}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.proofCard}>
              <Image source={{ uri: buildImageUrl(photo.image_path) }} style={styles.proofImage} />
              <Text style={styles.proofDate}>{formatDate(photo.created_at)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const openRouteInMaps = async (job) => {
    const pickupLat = Number(job.pickup_latitude);
    const pickupLng = Number(job.pickup_longitude);
    const deliveryLat = Number(job.delivery_latitude);
    const deliveryLng = Number(job.delivery_longitude);

    if (
      Number.isNaN(pickupLat) ||
      Number.isNaN(pickupLng) ||
      Number.isNaN(deliveryLat) ||
      Number.isNaN(deliveryLng)
    ) {
      return;
    }

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${pickupLat},${pickupLng}` +
      `&destination=${deliveryLat},${deliveryLng}` +
      `&travelmode=driving`;
    await Linking.openURL(url);
  };

  const renderJobDetails = (job) => (
    <View style={styles.detailCard}>
      <View style={[styles.jobHeader, { flexDirection: row }]}>
        <View>
          <Text style={styles.detailTitle}>
            {tUi('ui.pages.admin.adminDeliveries.jobDetails_7a8b9c0d1e', { value0: job.id })}
          </Text>
          <Text style={styles.detailMeta}>
            {tUi('ui.pages.admin.adminDeliveries.orderTitle_8e5d31f868', { value0: job.order_id })}
          </Text>
        </View>
        <Text style={[styles.statusBadge, styles[`status_${(job.status || 'available').toLowerCase()}`]]}>
          {getStatusLabel(job.status || 'available')}
        </Text>
      </View>

      <View style={[styles.summaryGrid, { flexDirection: row }]}>
        <View style={styles.summaryCell}>
          <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminDeliveries.payment_ca9b9e5f35')}</Text>
          <Text style={styles.detailValue}>{formatCurrency(job.payment_amount || 0)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminDeliveries.driver_98ea19431c')}</Text>
          <Text style={styles.detailValue}>
            {job.driver_name || tUi('ui.pages.admin.adminDeliveries.notAssigned_128e07a7a1')}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminDeliveries.created_138ce7b7fa')}</Text>
          <Text style={styles.detailValue}>{formatDate(job.created_at)}</Text>
        </View>
      </View>

      <View style={[styles.tabRow, { flexDirection: row }]}>
        {[
          ['overview', tUi('ui.pages.admin.adminDeliveries.tabOverview_9c0d1e2f3a')],
          ['tracking', tUi('ui.pages.admin.adminDeliveries.tabTracking_0d1e2f3a4b')],
          ['proof', tUi('ui.pages.admin.adminDeliveries.deliveryProofPhotos_2ec00d3e69')],
          ...(job.issue_type ? [['issue', tUi('ui.mobile.adminDeliveries.tabIssue')]] : []),
        ].map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tabButton, expandedJobTab === key && styles.tabButtonActive]}
            onPress={() => setExpandedJobTab(key)}
          >
            <Text style={[styles.tabText, expandedJobTab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {expandedJobTab === 'overview' ? (
        <View>
          <View style={[styles.detailGrid, { flexDirection: row }]}>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{tUi('ui.pages.admin.adminDeliveries.pickup_b758cea6c8')}</Text>
              <Text style={styles.infoText}>
                {job.pickup_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}
              </Text>
              <Text style={styles.coordsText}>
                {formatCoords(job.pickup_latitude, job.pickup_longitude)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{tUi('ui.pages.admin.adminDeliveries.delivery_e0a72301c9')}</Text>
              <Text style={styles.infoText}>
                {job.delivery_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}
              </Text>
              <Text style={styles.coordsText}>
                {formatCoords(job.delivery_latitude, job.delivery_longitude)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{tUi('ui.pages.admin.adminDeliveries.customer_6ce1add7ce')}</Text>
              <Text style={styles.infoText}>
                {customerName(job.customer)}
                {job.customer?.phone ? ` | ${job.customer.phone}` : ''}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{tUi('ui.pages.admin.adminDeliveries.driver_98ea19431c')}</Text>
              <Text style={styles.infoText}>
                {job.driver_name || tUi('ui.pages.admin.adminDeliveries.notAssigned_128e07a7a1')}
              </Text>
              {['available', 'assigned'].includes((job.status || '').toLowerCase()) ? (
                <Pressable
                  style={[styles.assignInlineButton, { alignSelf: alignSelfStart }]}
                  onPress={() => setAssignModalJob(job)}
                >
                  <Text style={styles.assignInlineText}>
                    {job.driver_id
                      ? tUi('ui.mobile.adminDeliveries.reassignDriver')
                      : tUi('ui.pages.admin.adminDeliveries.assignDriver_a52d732a9a')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{tUi('ui.pages.admin.adminDeliveries.items_fa39ea7cbb')}</Text>
            {(job.items || []).length ? (
              <View style={[styles.itemWrap, { flexDirection: row }]}>
                {job.items.map((item, index) => (
                  <Text key={item.id || index} style={styles.itemPill}>
                    {item.product?.name || item.product_name || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}{' '}
                    x{item.quantity}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyInline}>{tUi('ui.mobile.adminDeliveries.noItemData')}</Text>
            )}
          </View>
        </View>
      ) : null}

      {expandedJobTab === 'tracking' ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{tUi('ui.pages.admin.adminDeliveries.tabTracking_0d1e2f3a4b')}</Text>
          <OrderMapTracker deliveryJob={job} labels={mapLabels} />
          <View style={[styles.trackingCard, { marginTop: 12 }]}>
            <Text style={styles.infoTitle}>{tUi('ui.pages.admin.adminDeliveries.pickup_b758cea6c8')}</Text>
            <Text style={styles.infoText}>
              {job.pickup_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}
            </Text>
            <Text style={styles.coordsText}>
              {formatCoords(job.pickup_latitude, job.pickup_longitude)}
            </Text>
            <Text style={[styles.infoTitle, styles.trackingDeliveryTitle]}>
              {tUi('ui.pages.admin.adminDeliveries.delivery_e0a72301c9')}
            </Text>
            <Text style={styles.infoText}>
              {job.delivery_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}
            </Text>
            <Text style={styles.coordsText}>
              {formatCoords(job.delivery_latitude, job.delivery_longitude)}
            </Text>
            <Pressable style={styles.mapButton} onPress={() => openRouteInMaps(job)}>
              <Text style={styles.mapButtonText}>{tUi('ui.mobile.adminDeliveries.openRouteInMaps')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {expandedJobTab === 'proof' ? (
        <View style={styles.sectionBlock}>
          {renderPhotoGroup(job, 'pickup', job.pickup_photo_checked)}
          {renderPhotoGroup(job, 'delivery', job.delivery_photo_checked)}
        </View>
      ) : null}

      {expandedJobTab === 'issue' && job.issue_type ? (
        <View style={styles.issueCard}>
          <Text style={styles.issueTitle}>{job.issue_type}</Text>
          <Text style={styles.issueBody}>
            {job.issue_description || tUi('ui.mobile.adminDeliveries.noDescription')}
          </Text>
          {photosByType(job, 'issue').length ? (
            <View style={[styles.photoGrid, { flexDirection: row }]}>
              {photosByType(job, 'issue').map((photo) => (
                <Image key={photo.id} source={{ uri: buildImageUrl(photo.image_path) }} style={styles.proofImage} />
              ))}
            </View>
          ) : null}
          <View style={styles.threadBox}>
            <Text style={styles.threadTitle}>{tUi('ui.mobile.adminDeliveries.issueThread')}</Text>
            {issueMessagesLoading ? (
              <Text style={styles.threadMeta}>{tUi('ui.pages.admin.adminDeliveries.loadingDiscussion_a617f0a9e2')}</Text>
            ) : issueMessages.length ? (
              issueMessages.map((msg) => (
                <View key={msg.id} style={styles.threadMessage}>
                  <Text style={styles.threadMeta}>
                    {msg.sender?.email || msg.sender_email || tUi('ui.pages.admin.adminDeliveries.user_78896fd17c')}{' '}
                    | {formatDateTime(msg.created_at)}
                  </Text>
                  <Text style={styles.threadText}>{msg.message}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.threadMeta}>{tUi('ui.pages.admin.adminDeliveries.noMessagesYet_3b81b04428')}</Text>
            )}
            {!job.issue_resolved ? (
              <View style={styles.messageForm}>
                <TextInput
                  style={[styles.messageInput, inputRtlStyle]}
                  value={issueMessageText}
                  onChangeText={setIssueMessageText}
                  placeholder={tUi('ui.mobile.adminDeliveries.issueUpdatePlaceholder')}
                  placeholderTextColor={colors.muted}
                  multiline
                />
                <Pressable
                  style={[styles.sendButton, { alignSelf: alignSelfEnd }]}
                  onPress={handleSendIssueMessage}
                >
                  <Text style={styles.sendButtonText}>{tUi('ui.pages.admin.adminDeliveries.send_50281357f3')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          {!job.issue_resolved ? (
            <Pressable style={styles.resolveButton} onPress={() => handleResolveIssue(job.id)}>
              <Text style={styles.resolveButtonText}>
                {tUi('ui.pages.admin.adminDeliveries.markAsSolved_d73588c2d7')}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.resolvedBadge}>{tUi('ui.mobile.adminDeliveries.resolvedBadge')}</Text>
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.admin.adminDeliveries.deliveryManagement_51f1bfe811')}
      subtitle={tUi('ui.pages.admin.adminDeliveries.subtitle_1a2b3c4d5g')}
      meta={`${tUi('ui.pages.admin.adminDeliveries.issueReport_8c535704c0')}: ${issueCount} | ${tUi('ui.pages.admin.adminDeliveries.deliveryProofPhotos_2ec00d3e69')}: ${proofCount}`}
    >
      <View style={[styles.filterRow, { flexDirection: row }]}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[styles.filterText, statusFilter === status && styles.filterTextActive]}
            >
              {getStatusFilterLabel(status)}
            </Text>
          </Pressable>
        ))}
      </View>

      {issueCount > 0 || proofCount > 0 ? (
        <View style={styles.alertCard}>
          {issueCount > 0 ? (
            <Text style={styles.alertText}>
              {issueCount} {tUi('ui.pages.admin.adminDeliveries.delivery_8e33d75337')}{' '}
              {issueCount === 1
                ? tUi('ui.pages.admin.adminDeliveries.issueReportNeeds_9d4a2961c3')
                : tUi('ui.pages.admin.adminDeliveries.issueReportsNeed_06c771831a')}{' '}
              {tUi('ui.pages.admin.adminDeliveries.adminAttention_5a79bc3bce')}
            </Text>
          ) : null}
          {proofCount > 0 ? (
            <Text style={styles.alertText}>
              {proofCount} {tUi('ui.pages.admin.adminDeliveries.delivery_8e33d75337')}{' '}
              {proofCount === 1
                ? tUi('ui.pages.admin.adminDeliveries.jobHas_b7c5f7c5de')
                : tUi('ui.pages.admin.adminDeliveries.jobsHave_aa577eee49')}{' '}
              {tUi('ui.pages.admin.adminDeliveries.proofPhotosUploadedByDrivers_6d35ed5c58')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {jobs.map((job) => {
            const status = job.status || 'available';
            const meta = `${formatCurrency(job.payment_amount || 0)} | ${formatDateTime(
              job.created_at
            )}`;
            return (
              <View key={job.id}>
                <AdminListItem
                  title={tUi('ui.pages.admin.adminDeliveries.jobDetails_7a8b9c0d1e', { value0: job.id })}
                  subtitle={`${job.customer?.first_name || tUi('ui.pages.admin.adminUsers.customer_68c8b84985')} → ${job.delivery_address || tUi('ui.pages.admin.adminDeliveries.nA_201b30d45e')}`}
                  meta={meta}
                  status={getStatusLabel(status)}
                  statusTone={statusToneMap[status] || 'default'}
                  onPress={() =>
                    setExpandedJobId((prev) => (prev === job.id ? null : job.id))
                  }
                  right={
                    <Text style={styles.inlineButton}>
                      {expandedJobId === job.id
                        ? tUi('ui.pages.admin.adminDeliveries.closeDetails_8b9c0d1e2f')
                        : tUi('ui.mobile.adminOrders.orderDetails')}
                    </Text>
                  }
                />
                {expandedJobId === job.id ? renderJobDetails(selectedJob || job) : null}
              </View>
            );
          })}
          {!jobs.length ? (
            <Text style={styles.emptyText}>
              {statusFilter === 'all'
                ? tUi('ui.pages.admin.adminDeliveries.noDeliveryJobsFound_80dac255bf')
                : tUi('ui.pages.admin.adminDeliveries.noDeliveryJobsWithStatus_64e7ce84ea', {
                    value0: getStatusFilterLabel(statusFilter),
                  })}
            </Text>
          ) : null}
        </View>
      )}

      <Modal transparent visible={!!assignModalJob} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAssignModalJob(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {assignModalJob?.driver_id
                ? tUi('ui.mobile.adminDeliveries.reassignDriver')
                : tUi('ui.pages.admin.adminDeliveries.assignDriver_a52d732a9a')}
            </Text>
            {drivers.map((driver) => (
              <Pressable
                key={driver.id}
                style={styles.modalOption}
                onPress={() => setSelectedDriverId(String(driver.id))}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedDriverId === String(driver.id) && styles.modalOptionTextActive,
                  ]}
                >
                  {driver.first_name} {driver.last_name}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.primaryButton} onPress={handleAssignDriver}>
              <Text style={styles.primaryButtonText}>
                {assignModalJob?.driver_id
                  ? tUi('ui.mobile.adminDeliveries.reassignDriver')
                  : tUi('ui.pages.admin.adminDeliveries.assignDriver_a52d732a9a')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
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
  alertCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  alertText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
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
  detailRow: {
    marginTop: 12,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  detailValue: {
    marginTop: 4,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    textTransform: 'capitalize',
    color: colors.muted,
    backgroundColor: colors.surfaceAlt,
  },
  status_delivered: {
    color: colors.success,
  },
  status_cancelled: {
    color: colors.danger,
  },
  status_assigned: {
    color: colors.primary,
  },
  status_picked_up: {
    color: colors.primary,
  },
  status_delivering: {
    color: colors.primary,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  summaryCell: {
    width: '50%',
    paddingRight: 10,
    marginTop: 10,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
  },
  tabButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.surface,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  infoCard: {
    width: '48%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  infoText: {
    color: colors.text,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  coordsText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
  },
  assignInlineButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  assignInlineText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionBlock: {
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyInline: {
    color: colors.muted,
    fontSize: 12,
  },
  itemWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemPill: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  trackingCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trackingDoneCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  trackingDoneTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  trackingDoneText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  trackingDeliveryTitle: {
    marginTop: 14,
  },
  mapPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    color: colors.surface,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
    overflow: 'hidden',
  },
  mapLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.55,
    marginHorizontal: 8,
  },
  mapButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mapButtonText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  photoGroup: {
    marginTop: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  proofCard: {
    width: '31%',
  },
  proofImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  proofDate: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  smallActionButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallActionButtonDisabled: {
    opacity: 0.65,
  },
  smallActionText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '700',
  },
  issueCard: {
    marginTop: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  issueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  issueBody: {
    marginTop: 6,
    fontSize: 12,
    color: colors.muted,
  },
  threadBox: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  threadTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  threadMessage: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  threadMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  threadText: {
    color: colors.text,
    fontSize: 12,
    marginTop: 4,
  },
  messageForm: {
    marginTop: 10,
  },
  messageInput: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceAlt,
  },
  sendButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  resolveButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  resolveButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  resolvedBadge: {
    marginTop: 8,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  photoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  photoRowAlert: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  photoLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  photoStatus: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  photoStatusOk: {
    fontSize: 11,
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
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 10,
  },
  modalOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  modalOptionTextActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700',
  },
});

export default AdminDeliveriesScreen;
