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
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import { colors } from '../styles/theme';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { buildImageUrl, formatDate, formatDateTime } from '../utils/format';
import { useCurrency } from '../../hooks/useCurrency';

const STATUS_FILTERS = [
  'all',
  'available',
  'assigned',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
];

const statusToneMap = {
  available: 'default',
  assigned: 'warning',
  picked_up: 'warning',
  delivering: 'warning',
  delivered: 'success',
  cancelled: 'danger',
};

const AdminDeliveriesScreen = () => {
  const { formatCurrency } = useCurrency();
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
    if (!assignModalJob || !selectedDriverId) return;
    await http.patch(buildUrl(DELIVERY_ENDPOINTS.ASSIGN_DRIVER, { job_id: assignModalJob.id }), {
      driver_id: Number(selectedDriverId),
    });
    setAssignModalJob(null);
    setSelectedDriverId('');
    fetchJobs();
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
    await http.patch(buildUrl(DELIVERY_ENDPOINTS.RESOLVE_ISSUE, { job_id: jobId }));
    fetchJobs();
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
    if (lat == null || lng == null) return 'Coordinates unavailable';
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return 'Coordinates unavailable';
    return `(${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
  };

  const customerName = (customer) => {
    if (!customer) return 'N/A';
    return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Customer';
  };

  const photosByType = (job, type) => (job.photos || []).filter((photo) => photo.photo_type === type);

  const renderPhotoGroup = (job, type, label, checked) => {
    const photos = photosByType(job, type);
    if (!photos.length) {
      return (
        <View style={styles.photoGroup}>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Text style={styles.emptyInline}>No {label.toLowerCase()} photos uploaded.</Text>
        </View>
      );
    }

    const reviewKey = `${job.id}-${type}`;
    return (
      <View style={styles.photoGroup}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Pressable
            style={[styles.smallActionButton, checked && styles.smallActionButtonDisabled]}
            disabled={checked || reviewingPhotoType === reviewKey}
            onPress={() => handleReviewPhoto(job.id, type)}
          >
            <Text style={styles.smallActionText}>
              {checked ? 'Checked OK' : reviewingPhotoType === reviewKey ? 'Saving...' : 'Mark OK'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.photoGrid}>
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
      <View style={styles.jobHeader}>
        <View>
          <Text style={styles.detailTitle}>Job #{job.id}</Text>
          <Text style={styles.detailMeta}>{`Order #${job.order_id}`}</Text>
        </View>
        <Text style={[styles.statusBadge, styles[`status_${(job.status || 'available').toLowerCase()}`]]}>
          {(job.status || 'available').replace(/_/g, ' ')}
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCell}>
          <Text style={styles.detailLabel}>Payment</Text>
          <Text style={styles.detailValue}>{formatCurrency(job.payment_amount || 0)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.detailLabel}>Driver</Text>
          <Text style={styles.detailValue}>{job.driver_name || 'Not assigned'}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>{formatDate(job.created_at)}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {[
          ['overview', 'Overview'],
          ['tracking', 'Live tracking'],
          ['proof', 'Delivery Proof Photos'],
          ...(job.issue_type ? [['issue', 'Issue']] : []),
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
          <View style={styles.detailGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Pickup</Text>
              <Text style={styles.infoText}>{job.pickup_address || 'TBD'}</Text>
              <Text style={styles.coordsText}>
                {formatCoords(job.pickup_latitude, job.pickup_longitude)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Delivery</Text>
              <Text style={styles.infoText}>{job.delivery_address || 'TBD'}</Text>
              <Text style={styles.coordsText}>
                {formatCoords(job.delivery_latitude, job.delivery_longitude)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Customer</Text>
              <Text style={styles.infoText}>
                {customerName(job.customer)}
                {job.customer?.phone ? ` | ${job.customer.phone}` : ''}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Driver</Text>
              <Text style={styles.infoText}>{job.driver_name || 'Not assigned'}</Text>
              {['available', 'assigned'].includes((job.status || '').toLowerCase()) ? (
                <Pressable style={styles.assignInlineButton} onPress={() => setAssignModalJob(job)}>
                  <Text style={styles.assignInlineText}>
                    {job.driver_id ? 'Reassign driver' : 'Assign driver'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Items</Text>
            {(job.items || []).length ? (
              <View style={styles.itemWrap}>
                {job.items.map((item, index) => (
                  <Text key={item.id || index} style={styles.itemPill}>
                    {item.product?.name || item.product_name || 'Item'} x{item.quantity}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyInline}>No item data.</Text>
            )}
          </View>
        </View>
      ) : null}

      {expandedJobTab === 'tracking' ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Live tracking</Text>
          {['delivered', 'cancelled'].includes((job.status || '').toLowerCase()) ? (
            <View style={styles.trackingDoneCard}>
              <Text style={styles.trackingDoneTitle}>
                {job.status === 'delivered' ? 'Delivery completed' : 'Delivery cancelled'}
              </Text>
              <Text style={styles.trackingDoneText}>
                {job.status === 'delivered'
                  ? 'This order has been delivered. Live map tracking is no longer active.'
                  : 'This delivery was cancelled. Live map tracking is inactive.'}
              </Text>
            </View>
          ) : null}
          <View style={styles.trackingCard}>
            <Text style={styles.infoTitle}>Pickup</Text>
            <Text style={styles.infoText}>{job.pickup_address || 'TBD'}</Text>
            <Text style={styles.coordsText}>
              {formatCoords(job.pickup_latitude, job.pickup_longitude)}
            </Text>
            <Text style={[styles.infoTitle, styles.trackingDeliveryTitle]}>Delivery</Text>
            <Text style={styles.infoText}>{job.delivery_address || 'TBD'}</Text>
            <Text style={styles.coordsText}>
              {formatCoords(job.delivery_latitude, job.delivery_longitude)}
            </Text>
            <View style={styles.mapPreview}>
              <Text style={styles.mapMarker}>P</Text>
              <View style={styles.mapLine} />
              <Text style={styles.mapMarker}>D</Text>
            </View>
            <Pressable style={styles.mapButton} onPress={() => openRouteInMaps(job)}>
              <Text style={styles.mapButtonText}>Open route in Google Maps</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {expandedJobTab === 'proof' ? (
        <View style={styles.sectionBlock}>
          {renderPhotoGroup(job, 'pickup', 'Pickup Proof', job.pickup_photo_checked)}
          {renderPhotoGroup(job, 'delivery', 'Delivery Proof', job.delivery_photo_checked)}
        </View>
      ) : null}

      {expandedJobTab === 'issue' && job.issue_type ? (
        <View style={styles.issueCard}>
          <Text style={styles.issueTitle}>{job.issue_type}</Text>
          <Text style={styles.issueBody}>{job.issue_description || 'No description'}</Text>
          {photosByType(job, 'issue').length ? (
            <View style={styles.photoGrid}>
              {photosByType(job, 'issue').map((photo) => (
                <Image key={photo.id} source={{ uri: buildImageUrl(photo.image_path) }} style={styles.proofImage} />
              ))}
            </View>
          ) : null}
          <View style={styles.threadBox}>
            <Text style={styles.threadTitle}>Issue thread</Text>
            {issueMessagesLoading ? (
              <Text style={styles.threadMeta}>Loading messages...</Text>
            ) : issueMessages.length ? (
              issueMessages.map((msg) => (
                <View key={msg.id} style={styles.threadMessage}>
                  <Text style={styles.threadMeta}>
                    {msg.sender?.email || msg.sender_email || 'Team'} | {formatDateTime(msg.created_at)}
                  </Text>
                  <Text style={styles.threadText}>{msg.message}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.threadMeta}>No messages yet.</Text>
            )}
            {!job.issue_resolved ? (
              <View style={styles.messageForm}>
                <TextInput
                  style={styles.messageInput}
                  value={issueMessageText}
                  onChangeText={setIssueMessageText}
                  placeholder="Write an issue update"
                  placeholderTextColor={colors.muted}
                  multiline
                />
                <Pressable style={styles.sendButton} onPress={handleSendIssueMessage}>
                  <Text style={styles.sendButtonText}>Send</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          {!job.issue_resolved ? (
            <Pressable style={styles.resolveButton} onPress={() => handleResolveIssue(job.id)}>
              <Text style={styles.resolveButtonText}>Mark Resolved</Text>
            </Pressable>
          ) : (
            <Text style={styles.resolvedBadge}>Resolved</Text>
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <AdminScreen
      title="Deliveries"
      subtitle="Assign drivers, review photos, and manage issues."
      meta={`Issues: ${issueCount} | Photos: ${proofCount}`}
    >
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[styles.filterText, statusFilter === status && styles.filterTextActive]}
            >
              {status}
            </Text>
          </Pressable>
        ))}
      </View>

      {issueCount > 0 || proofCount > 0 ? (
        <View style={styles.alertCard}>
          {issueCount > 0 ? (
            <Text style={styles.alertText}>{issueCount} issue(s) need attention</Text>
          ) : null}
          {proofCount > 0 ? (
            <Text style={styles.alertText}>{proofCount} photo(s) need review</Text>
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
                  title={`Job #${job.id}`}
                  subtitle={`${job.customer?.first_name || 'Customer'} → ${job.delivery_address || 'TBD'}`}
                  meta={meta}
                  status={status}
                  statusTone={statusToneMap[status] || 'default'}
                  onPress={() =>
                    setExpandedJobId((prev) => (prev === job.id ? null : job.id))
                  }
                  right={
                    <Text style={styles.inlineButton}>
                      {expandedJobId === job.id ? 'Hide' : 'Details'}
                    </Text>
                  }
                />
                {expandedJobId === job.id ? renderJobDetails(selectedJob || job) : null}
              </View>
            );
          })}
          {!jobs.length ? (
            <Text style={styles.emptyText}>No deliveries found.</Text>
          ) : null}
        </View>
      )}

      {false && selectedJob ? (
        <View style={styles.detailCard}>
          <View style={styles.jobHeader}>
            <View>
              <Text style={styles.detailTitle}>Job #{selectedJob.id}</Text>
              <Text style={styles.detailMeta}>{`Order #${selectedJob.order_id}`}</Text>
            </View>
            <Text style={[styles.statusBadge, styles[`status_${(selectedJob.status || 'available').toLowerCase()}`]]}>
              {(selectedJob.status || 'available').replace(/_/g, ' ')}
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.detailLabel}>Payment</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedJob.payment_amount || 0)}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.detailLabel}>Driver</Text>
              <Text style={styles.detailValue}>{selectedJob.driver_name || 'Not assigned'}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>{formatDate(selectedJob.created_at)}</Text>
            </View>
          </View>

          <View style={styles.tabRow}>
            {[
              ['overview', 'Overview'],
              ['tracking', 'Live tracking'],
              ['proof', 'Delivery Proof Photos'],
              ...(selectedJob.issue_type ? [['issue', 'Issue']] : []),
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
              <View style={styles.detailGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Pickup</Text>
                  <Text style={styles.infoText}>{selectedJob.pickup_address || 'TBD'}</Text>
                  <Text style={styles.coordsText}>
                    {formatCoords(selectedJob.pickup_latitude, selectedJob.pickup_longitude)}
                  </Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Delivery</Text>
                  <Text style={styles.infoText}>{selectedJob.delivery_address || 'TBD'}</Text>
                  <Text style={styles.coordsText}>
                    {formatCoords(selectedJob.delivery_latitude, selectedJob.delivery_longitude)}
                  </Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Customer</Text>
                  <Text style={styles.infoText}>
                    {customerName(selectedJob.customer)}
                    {selectedJob.customer?.phone ? ` | ${selectedJob.customer.phone}` : ''}
                  </Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Driver</Text>
                  <Text style={styles.infoText}>{selectedJob.driver_name || 'Not assigned'}</Text>
                  {['available', 'assigned'].includes((selectedJob.status || '').toLowerCase()) ? (
                    <Pressable style={styles.assignInlineButton} onPress={() => setAssignModalJob(selectedJob)}>
                      <Text style={styles.assignInlineText}>
                        {selectedJob.driver_id ? 'Reassign driver' : 'Assign driver'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Items</Text>
                {(selectedJob.items || []).length ? (
                  <View style={styles.itemWrap}>
                    {selectedJob.items.map((item, index) => (
                      <Text key={item.id || index} style={styles.itemPill}>
                        {item.product?.name || item.product_name || 'Item'} x{item.quantity}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyInline}>No item data.</Text>
                )}
              </View>
            </View>
          ) : null}

          {expandedJobTab === 'tracking' ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Live tracking</Text>
              {['delivered', 'cancelled'].includes((selectedJob.status || '').toLowerCase()) ? (
                <View style={styles.trackingDoneCard}>
                  <Text style={styles.trackingDoneTitle}>
                    {selectedJob.status === 'delivered' ? 'Delivery completed' : 'Delivery cancelled'}
                  </Text>
                  <Text style={styles.trackingDoneText}>
                    {selectedJob.status === 'delivered'
                      ? 'This order has been delivered. Live map tracking is no longer active.'
                      : 'This delivery was cancelled. Live map tracking is inactive.'}
                  </Text>
                </View>
              ) : null}
              <View style={styles.trackingCard}>
                <Text style={styles.infoTitle}>Pickup</Text>
                <Text style={styles.infoText}>{selectedJob.pickup_address || 'TBD'}</Text>
                <Text style={styles.coordsText}>
                  {formatCoords(selectedJob.pickup_latitude, selectedJob.pickup_longitude)}
                </Text>
                <Text style={[styles.infoTitle, styles.trackingDeliveryTitle]}>Delivery</Text>
                <Text style={styles.infoText}>{selectedJob.delivery_address || 'TBD'}</Text>
                <Text style={styles.coordsText}>
                  {formatCoords(selectedJob.delivery_latitude, selectedJob.delivery_longitude)}
                </Text>
                <View style={styles.mapPreview}>
                  <Text style={styles.mapMarker}>P</Text>
                  <View style={styles.mapLine} />
                  <Text style={styles.mapMarker}>D</Text>
                </View>
                <Pressable style={styles.mapButton} onPress={() => openRouteInMaps(selectedJob)}>
                  <Text style={styles.mapButtonText}>Open route in Google Maps</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {expandedJobTab === 'proof' ? (
            <View style={styles.sectionBlock}>
              {renderPhotoGroup(selectedJob, 'pickup', 'Pickup Proof', selectedJob.pickup_photo_checked)}
              {renderPhotoGroup(selectedJob, 'delivery', 'Delivery Proof', selectedJob.delivery_photo_checked)}
            </View>
          ) : null}

          {expandedJobTab === 'issue' && selectedJob.issue_type ? (
            <View style={styles.issueCard}>
              <Text style={styles.issueTitle}>{selectedJob.issue_type}</Text>
              <Text style={styles.issueBody}>{selectedJob.issue_description || 'No description'}</Text>
              {photosByType(selectedJob, 'issue').length ? (
                <View style={styles.photoGrid}>
                  {photosByType(selectedJob, 'issue').map((photo) => (
                    <Image key={photo.id} source={{ uri: buildImageUrl(photo.image_path) }} style={styles.proofImage} />
                  ))}
                </View>
              ) : null}
              <View style={styles.threadBox}>
                <Text style={styles.threadTitle}>Issue thread</Text>
                {issueMessagesLoading ? (
                  <Text style={styles.threadMeta}>Loading messages...</Text>
                ) : issueMessages.length ? (
                  issueMessages.map((msg) => (
                    <View key={msg.id} style={styles.threadMessage}>
                      <Text style={styles.threadMeta}>
                        {msg.sender?.email || msg.sender_email || 'Team'} | {formatDateTime(msg.created_at)}
                      </Text>
                      <Text style={styles.threadText}>{msg.message}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.threadMeta}>No messages yet.</Text>
                )}
                {!selectedJob.issue_resolved ? (
                  <View style={styles.messageForm}>
                    <TextInput
                      style={styles.messageInput}
                      value={issueMessageText}
                      onChangeText={setIssueMessageText}
                      placeholder="Write an issue update"
                      placeholderTextColor={colors.muted}
                      multiline
                    />
                    <Pressable style={styles.sendButton} onPress={handleSendIssueMessage}>
                      <Text style={styles.sendButtonText}>Send</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {!selectedJob.issue_resolved ? (
                <Pressable style={styles.resolveButton} onPress={() => handleResolveIssue(selectedJob.id)}>
                  <Text style={styles.resolveButtonText}>Mark Resolved</Text>
                </Pressable>
              ) : (
                <Text style={styles.resolvedBadge}>Resolved</Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal transparent visible={!!assignModalJob} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAssignModalJob(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Assign driver</Text>
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
              <Text style={styles.primaryButtonText}>Assign</Text>
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
