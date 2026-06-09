import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import AdminScreen from '../components/AdminScreen';
import DeliveryChatModal from '../components/DeliveryChatModal';
import OrderMapTracker from '../components/OrderMapTracker';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { buildImageUrl, formatDateTime } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useDriverActiveJobCount } from '../../hooks/useDriverJobCounts';
import { getDeliveryStatusLabel, getDeliveryStatusTone } from '../../utils/driverDeliveryStatus';

const ISSUE_TYPES = [
  { value: 'customer_not_home', labelKey: 'ui.pages.driver.issueTypes.customerNotHome' },
  { value: 'incorrect_address', labelKey: 'ui.pages.driver.issueTypes.incorrectAddress' },
  { value: 'damaged_items', labelKey: 'ui.pages.driver.issueTypes.damagedItems' },
  { value: 'other', labelKey: 'ui.pages.driver.issueTypes.other' },
];

const STATUS_STEP_KEYS = ['assigned', 'picked_up', 'delivering', 'delivered'];

const DriverActiveJobScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { textAlign, row, isRtl } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };
  const { refresh: refreshActiveCount } = useDriverActiveJobCount();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [expandedTab, setExpandedTab] = useState('overview');
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPhotoType, setDeletingPhotoType] = useState(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issuePhotoAsset, setIssuePhotoAsset] = useState(null);
  const [pendingPickupAsset, setPendingPickupAsset] = useState(null);
  const [pendingDeliveryAsset, setPendingDeliveryAsset] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [issueMessages, setIssueMessages] = useState([]);
  const [issueMessageText, setIssueMessageText] = useState('');
  const [issueChatLoading, setIssueChatLoading] = useState(false);
  const [issueSending, setIssueSending] = useState(false);

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === expandedJobId) || null,
    [expandedJobId, jobs]
  );

  useDriverLocation(Boolean(activeJob));

  const fetchActiveJobs = useCallback(async () => {
    try {
      const response = await http.get(DELIVERY_ENDPOINTS.ACTIVE_JOBS);
      const activeJobs = Array.isArray(response.data) ? response.data : [];
      setJobs(activeJobs);
      setExpandedJobId((prev) => {
        if (activeJobs.length === 0) return null;
        if (prev && activeJobs.some((job) => job.id === prev)) return prev;
        return prev;
      });
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveJobs();
    const interval = setInterval(fetchActiveJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveJobs]);

  useEffect(() => {
    if (!expandedJobId) return;
    setPendingPickupAsset(null);
    setPendingDeliveryAsset(null);
    setIssuePhotoAsset(null);
    setExpandedTab('overview');
  }, [expandedJobId]);

  const fetchIssueMessages = useCallback(async (jobId) => {
    if (!jobId) return;
    setIssueChatLoading(true);
    try {
      const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.ISSUE_MESSAGES, { job_id: jobId }));
      setIssueMessages(Array.isArray(response.data) ? response.data : []);
    } catch (_) {
      setIssueMessages([]);
    } finally {
      setIssueChatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeJob?.id && activeJob?.issue_type) {
      fetchIssueMessages(activeJob.id);
      return;
    }
    setIssueMessages([]);
  }, [activeJob?.id, activeJob?.issue_type, fetchIssueMessages]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.adminProducts.photoPermission') });
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return null;
    return result.assets?.[0] || null;
  };

  const buildUploadFile = (asset) => {
    const filename = asset.fileName || asset.uri.split('/').pop() || `proof-${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = asset.mimeType || (match ? `image/${match[1]}` : 'image/jpeg');
    return { uri: asset.uri, name: filename, type };
  };

  const handlePhotoUpload = async (type, asset) => {
    if (!activeJob || !asset) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', buildUploadFile(asset));
      await http.post(
        `${buildUrl(DELIVERY_ENDPOINTS.UPLOAD_PHOTO, { job_id: activeJob.id })}?photo_type=${type}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      Toast.show({
        type: 'success',
        text1:
          type === 'pickup'
            ? tUi('ui.pages.driver.driverActiveJob.pickupPhotoUploaded_a3f8c2d901')
            : tUi('ui.pages.driver.driverActiveJob.deliveryPhotoUploaded_b4e9d3e012'),
      });
      if (type === 'pickup') setPendingPickupAsset(null);
      else setPendingDeliveryAsset(null);
      await fetchActiveJobs();
      refreshActiveCount();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.pages.driver.driverActiveJob.failedToUploadPhoto_b4e8c2d3fb'),
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoDelete = (type) => {
    if (!activeJob) return;
    const proofLabel =
      type === 'pickup'
        ? tUi('ui.pages.driver.driverActiveJob.pickupProof_d91ee33534')
        : tUi('ui.pages.driver.driverActiveJob.deliveryProof_554ad921e3');

    Alert.alert(
      tUi('ui.pages.driver.driverActiveJob.deletePhotoTitle_c8a1f3e902'),
      tUi('ui.pages.driver.driverActiveJob.deletePhotoMessage_d9b2e4f103', { value0: proofLabel }),
      [
        { text: tUi('ui.pages.driver.driverActiveJob.cancelPhotoDelete_e5f6a7b890'), style: 'cancel' },
        {
          text: tUi('ui.pages.driver.driverActiveJob.deletePhoto_c7d8e9f012'),
          style: 'destructive',
          onPress: async () => {
            setDeletingPhotoType(type);
            try {
              await http.delete(
                `${buildUrl(DELIVERY_ENDPOINTS.DELETE_PHOTO, { job_id: activeJob.id })}?photo_type=${type}`
              );
              Toast.show({ type: 'success', text1: tUi('ui.pages.driver.driverActiveJob.photoDeleted_e1f2a3b456') });
              await fetchActiveJobs();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: error.response?.data?.detail || error.message || tUi('ui.pages.driver.driverActiveJob.failedToDeletePhoto_b4e8c2d3fc'),
              });
            } finally {
              setDeletingPhotoType(null);
            }
          },
        },
      ]
    );
  };

  const handlePickup = async () => {
    if (!activeJob) return;
    setUpdating(true);
    try {
      const response = await http.patch(buildUrl(DELIVERY_ENDPOINTS.PICKUP_JOB, { job_id: activeJob.id }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.driver.driverActiveJob.orderMarkedAsPickedUp_de1a5b6c99') });
      setJobs((prev) => prev.map((job) => (job.id === response.data.id ? response.data : job)));
      await fetchActiveJobs();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.pages.driver.driverActiveJob.failedToUpdate_b4e8c2d3fd'),
      });
      await fetchActiveJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handleDeliver = async () => {
    if (!activeJob) return;
    setUpdating(true);
    try {
      await http.patch(buildUrl(DELIVERY_ENDPOINTS.DELIVER_JOB, { job_id: activeJob.id }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.driver.driverActiveJob.orderDeliveredSuccessfully_4c4dd3d526') });
      setExpandedJobId(null);
      await fetchActiveJobs();
      refreshActiveCount();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.pages.driver.driverActiveJob.failedToUpdate_b4e8c2d3fd'),
      });
      await fetchActiveJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handleReportIssue = async () => {
    if (!activeJob || !issueType) return;
    try {
      const formData = new FormData();
      formData.append('issue_type', issueType);
      formData.append('description', issueDescription || '');
      if (issuePhotoAsset) {
        formData.append('photo', buildUploadFile(issuePhotoAsset));
      }
      await http.post(buildUrl(DELIVERY_ENDPOINTS.REPORT_ISSUE, { job_id: activeJob.id }), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Toast.show({ type: 'success', text1: tUi('ui.pages.driver.driverActiveJob.issueReported_63b95b7715') });
      setShowIssueModal(false);
      setIssueType('');
      setIssueDescription('');
      setIssuePhotoAsset(null);
      await fetchActiveJobs();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.pages.driver.driverActiveJob.failedToReportIssue_b4e8c2d3fe'),
      });
    }
  };

  const handleSendIssueMessage = async () => {
    if (!activeJob?.id || !issueMessageText.trim()) return;
    setIssueSending(true);
    try {
      const response = await http.post(
        buildUrl(DELIVERY_ENDPOINTS.ISSUE_MESSAGES, { job_id: activeJob.id }),
        { message: issueMessageText.trim() }
      );
      setIssueMessages((prev) => [...prev, response.data]);
      setIssueMessageText('');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.components.supportTicketChatModal.sendFailed_c3d4e5f6a7'),
      });
    } finally {
      setIssueSending(false);
    }
  };

  const getIssueTypeLabel = (type) => {
    const match = ISSUE_TYPES.find((item) => item.value === type);
    return match ? tUi(match.labelKey) : String(type || '').replace(/_/g, ' ');
  };

  const statusStyle = (status) => {
    const tone = getDeliveryStatusTone(status);
    if (tone === 'assigned') return styles.statusAssigned;
    if (tone === 'picked_up') return styles.statusPickedUp;
    if (tone === 'delivering') return styles.statusDelivering;
    return styles.statusDefault;
  };

  const renderProofSlot = ({
    type,
    titleKey,
    photos,
    checked,
    pendingAsset,
    setPendingAsset,
    canUpload,
    lockedMessageKey,
  }) => {
    const uploadedPhoto = photos[0] || null;
    const status = photos.length === 0 ? 'waiting' : checked ? 'approved' : 'pending';
    const canDelete = Boolean(uploadedPhoto) && !checked;
    const isDeleting = deletingPhotoType === type;

    return (
      <View style={styles.proofSlot}>
        <View style={[styles.proofHeader, { flexDirection: row }]}>
          <Text style={[styles.proofTitle, { textAlign }]}>{tUi(titleKey)}</Text>
          <Text style={styles.proofStatus}>
            {status === 'waiting'
              ? tUi('ui.pages.driver.driverActiveJob.noPhotoYet_3c57d3e62c')
              : status === 'approved'
                ? tUi('ui.pages.driver.driverActiveJob.markedOk_ed9c22f906')
                : tUi('ui.pages.driver.driverActiveJob.pendingAdminCheck_370751e858')}
          </Text>
        </View>

        {uploadedPhoto ? (
          <>
            <Image source={{ uri: buildImageUrl(uploadedPhoto.image_path) }} style={styles.proofImage} />
            {canDelete ? (
              <Pressable
                style={styles.deleteBtn}
                onPress={() => handlePhotoDelete(type)}
                disabled={isDeleting}
              >
                <Text style={styles.deleteBtnText}>
                  {isDeleting
                    ? tUi('ui.pages.driver.driverActiveJob.deletingPhoto_f6a7b8c901')
                    : tUi('ui.pages.driver.driverActiveJob.deletePhoto_c7d8e9f012')}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : pendingAsset ? (
          <>
            <Image source={{ uri: pendingAsset.uri }} style={styles.proofImage} />
            <View style={[styles.proofActions, { flexDirection: row }]}>
              <Pressable style={styles.secondaryBtn} onPress={() => setPendingAsset(null)} disabled={uploading}>
                <Text style={styles.secondaryBtnText}>
                  {tUi('ui.pages.driver.driverActiveJob.cancelPhotoDelete_e5f6a7b890')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, uploading && styles.btnDisabled]}
                onPress={() => handlePhotoUpload(type, pendingAsset)}
                disabled={uploading}
              >
                <Text style={styles.primaryBtnText}>
                  {uploading
                    ? tUi('ui.pages.driver.driverActiveJob.uploadingPhoto_g7h8i9j012')
                    : tUi('ui.pages.driver.driverActiveJob.confirmUpload_h8i9j0k123')}
                </Text>
              </Pressable>
            </View>
          </>
        ) : canUpload ? (
          <Pressable
            style={styles.uploadZone}
            onPress={async () => {
              const asset = await pickImage();
              if (asset) setPendingAsset(asset);
            }}
          >
            <Feather name="camera" size={22} color={colors.primary} />
            <Text style={[styles.uploadTitle, { textAlign }]}>
              {tUi('ui.pages.driver.driverActiveJob.choosePhoto_i9j0k1l234')}
            </Text>
            <Text style={[styles.uploadHint, { textAlign }]}>
              {tUi('ui.pages.driver.driverActiveJob.choosePhotoHint_j0k1l2m345')}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.uploadZoneLocked}>
            <Text style={[styles.uploadTitle, { textAlign }]}>
              {tUi('ui.pages.driver.driverActiveJob.uploadLocked_k1l2m3n456')}
            </Text>
            <Text style={[styles.uploadHint, { textAlign }]}>{tUi(lockedMessageKey)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderJobDetail = (job) => {
    const allPhotos = Array.isArray(job.photos) ? job.photos : [];
    const pickupPhotos = allPhotos.filter((photo) => photo.photo_type === 'pickup');
    const deliveryPhotos = allPhotos.filter((photo) => photo.photo_type === 'delivery');
    const issuePhotos = allPhotos.filter((photo) => photo.photo_type === 'issue');
    const pickupChecked = !!job.pickup_photo_checked;
    const deliveryChecked = !!job.delivery_photo_checked;
    const canMarkPickup = job.status === 'assigned' && pickupPhotos.length > 0 && pickupChecked;
    const canMarkDelivered =
      (job.status === 'picked_up' || job.status === 'delivering') &&
      deliveryPhotos.length > 0 &&
      deliveryChecked;
    const canUploadDeliveryProof = job.status === 'picked_up' || job.status === 'delivering';
    const currentStepIdx = STATUS_STEP_KEYS.indexOf(job.status);

    return (
      <View style={styles.detailWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepper}>
          {STATUS_STEP_KEYS.map((key, idx) => (
            <View key={key} style={[styles.stepItem, { flexDirection: row }]}>
              <View
                style={[
                  styles.stepCircle,
                  idx <= currentStepIdx && styles.stepCircleDone,
                  idx === currentStepIdx && styles.stepCircleCurrent,
                ]}
              >
                <Text style={styles.stepCircleText}>{idx <= currentStepIdx ? '✓' : idx + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, { textAlign }]}>{getDeliveryStatusLabel(key, tUi)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.tabRow, { flexDirection: row }]}>
          {['overview', 'map'].map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabChip, expandedTab === tab && styles.tabChipActive]}
              onPress={() => setExpandedTab(tab)}
            >
              <Text style={[styles.tabChipText, expandedTab === tab && styles.tabChipTextActive]}>
                {tab === 'overview'
                  ? tUi('ui.pages.driver.list.tabManage')
                  : tUi('ui.pages.driver.list.tabMap')}
              </Text>
            </Pressable>
          ))}
        </View>

        {expandedTab === 'map' ? (
          <View style={styles.mapWrap}>
            <OrderMapTracker deliveryJob={job} />
          </View>
        ) : (
          <>
            <View style={styles.routeCard}>
              <Text style={[styles.routeTitle, { textAlign }]}>
                {tUi('ui.pages.driver.driverActiveJob.order_4b245b25fc')}
                {job.order_id}
              </Text>
              <Text style={[styles.routeLabel, { textAlign }]}>
                {tUi('ui.pages.driver.driverActiveJob.pickup_8822545cf7')}
              </Text>
              <Text style={[styles.routeValue, { textAlign }]}>
                {job.pickup_address || tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}
              </Text>
              <Text style={[styles.routeLabel, { textAlign }]}>
                {tUi('ui.pages.driver.driverActiveJob.delivery_6992613df3')}
              </Text>
              <Text style={[styles.routeValue, { textAlign }]}>
                {job.delivery_address || tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}
              </Text>
              {job.customer ? (
                <Text style={[styles.routeValue, { textAlign }]}>
                  {job.customer.first_name} {job.customer.last_name}
                  {job.customer.phone
                    ? tUi('ui.pages.driver.driverActiveJob.value_0fb34ea1e8', { value0: job.customer.phone })
                    : ''}
                </Text>
              ) : null}
            </View>

            {renderProofSlot({
              type: 'pickup',
              titleKey: 'ui.pages.driver.driverActiveJob.pickupProof_d91ee33534',
              photos: pickupPhotos,
              checked: pickupChecked,
              pendingAsset: pendingPickupAsset,
              setPendingAsset: setPendingPickupAsset,
              canUpload: pickupPhotos.length === 0,
              lockedMessageKey: 'ui.pages.driver.driverActiveJob.pickupAlreadyUploaded_71dfe59cdc',
            })}
            {renderProofSlot({
              type: 'delivery',
              titleKey: 'ui.pages.driver.driverActiveJob.deliveryProof_554ad921e3',
              photos: deliveryPhotos,
              checked: deliveryChecked,
              pendingAsset: pendingDeliveryAsset,
              setPendingAsset: setPendingDeliveryAsset,
              canUpload: deliveryPhotos.length === 0 && canUploadDeliveryProof,
              lockedMessageKey: 'ui.pages.driver.driverActiveJob.finishPickupFirst_40d56dd056',
            })}

            {job.issue_type ? (
              <View style={styles.issueCard}>
                <Text style={[styles.issueTitle, { textAlign }]}>
                  {tUi('ui.pages.driver.driverActiveJob.reportedIssue_be909d9dd2')}
                </Text>
                <Text style={[styles.routeValue, { textAlign }]}>{getIssueTypeLabel(job.issue_type)}</Text>
                {job.issue_description ? (
                  <Text style={[styles.routeValue, { textAlign }]}>{job.issue_description}</Text>
                ) : null}
                {issuePhotos.map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: buildImageUrl(photo.image_path) }}
                    style={styles.proofImage}
                  />
                ))}
                <Text style={[styles.routeLabel, { textAlign }]}>
                  {tUi('ui.pages.driver.driverActiveJob.issueDiscussionAdminDriver_20a6cecfc6')}
                </Text>
                {issueChatLoading ? (
                  <Text style={[styles.mutedText, { textAlign }]}>
                    {tUi('ui.pages.driver.driverActiveJob.loadingDiscussion_3385e5044c')}
                  </Text>
                ) : issueMessages.length === 0 ? (
                  <Text style={[styles.mutedText, { textAlign }]}>
                    {tUi('ui.pages.driver.driverActiveJob.noMessagesYet_5dc9c8c5d1')}
                  </Text>
                ) : (
                  issueMessages.map((msg) => (
                    <View
                      key={msg.id}
                      style={[
                        styles.issueMessage,
                        String(msg.sender_id) === String(user?.id) && styles.issueMessageMine,
                      ]}
                    >
                      <Text style={styles.issueMessageMeta}>
                        {msg.sender_name || tUi('ui.pages.driver.driverActiveJob.user_472cb0a9b5')} ·{' '}
                        {formatDateTime(msg.created_at)}
                      </Text>
                      <Text style={styles.issueMessageText}>{msg.message}</Text>
                    </View>
                  ))
                )}
                {!job.issue_resolved && (
                  <View style={[styles.issueInputRow, { flexDirection: row }]}>
                    <TextInput
                      style={[styles.issueInput, inputRtlStyle]}
                      value={issueMessageText}
                      onChangeText={setIssueMessageText}
                      placeholder={tUi('ui.pages.driver.driverActiveJob.writeAMessageToAdmin_a96d3938ba')}
                      placeholderTextColor={colors.muted}
                    />
                    <Pressable
                      style={[styles.sendIssueBtn, issueSending && styles.btnDisabled]}
                      onPress={handleSendIssueMessage}
                      disabled={issueSending || !issueMessageText.trim()}
                    >
                      <Text style={styles.sendIssueBtnText}>
                        {issueSending
                          ? tUi('ui.pages.driver.driverActiveJob.sending_a6441250fe')
                          : tUi('ui.pages.driver.driverActiveJob.send_b8a99b8547')}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.actionsGrid}>
              <Pressable style={styles.actionBtn} onPress={() => setShowChat(true)}>
                <Feather name="message-circle" size={18} color={colors.primary} />
                <Text style={styles.actionBtnText}>
                  {tUi('ui.pages.driver.driverActiveJob.chatWithCustomer_f2dc21eb4f')}
                </Text>
              </Pressable>
              {job.status === 'assigned' && (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnPrimary, (!canMarkPickup || updating) && styles.btnDisabled]}
                  onPress={handlePickup}
                  disabled={!canMarkPickup || updating}
                >
                  <Feather name="package" size={18} color="#fff" />
                  <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
                    {updating
                      ? tUi('ui.pages.driver.driverActiveJob.updating_aef6cc41f2')
                      : tUi('ui.pages.driver.driverActiveJob.markAsPickedUp_a0c8f3df13')}
                  </Text>
                </Pressable>
              )}
              {(job.status === 'picked_up' || job.status === 'delivering') && (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnPrimary, (!canMarkDelivered || updating) && styles.btnDisabled]}
                  onPress={handleDeliver}
                  disabled={!canMarkDelivered || updating}
                >
                  <Feather name="truck" size={18} color="#fff" />
                  <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
                    {updating
                      ? tUi('ui.pages.driver.driverActiveJob.updating_aef6cc41f2')
                      : tUi('ui.pages.driver.driverActiveJob.markAsDelivered_0559504313')}
                  </Text>
                </Pressable>
              )}
              <Pressable style={styles.actionBtn} onPress={() => setShowIssueModal(true)}>
                <Feather name="alert-triangle" size={18} color="#d97706" />
                <Text style={styles.actionBtnText}>
                  {tUi('ui.pages.driver.driverActiveJob.reportIssue_fc5eeeabe9')}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  };

  const headerPill =
    jobs.length > 0 ? (
      <View style={styles.headerPill}>
        <Text style={styles.headerPillText}>
          {jobs.length} {tUi('ui.pages.driver.list.activeCount')}
        </Text>
      </View>
    ) : null;

  if (loading) {
    return (
      <AdminScreen kicker={panelKicker} title={tUi('ui.pages.driver.driverActiveJob.activeDelivery_29af547736')}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AdminScreen>
    );
  }

  if (jobs.length === 0) {
    return (
      <AdminScreen
        kicker={panelKicker}
        title={tUi('ui.pages.driver.driverActiveJob.noActiveDelivery_4321221a6f')}
        subtitle={tUi('ui.pages.driver.active.subtitle')}
      >
        <View style={styles.emptyWrap}>
          <Feather name="truck" size={36} color={colors.muted} />
          <Text style={[styles.emptyText, { textAlign }]}>
            {tUi('ui.pages.driver.driverActiveJob.youDonTHaveAny_36a11095cf')}
          </Text>
          <Pressable style={styles.primaryBtnStandalone} onPress={() => navigation.navigate('DriverMap')}>
            <Text style={styles.primaryBtnText}>
              {tUi('ui.pages.driver.driverActiveJob.findAvailableJobs_e12cd068e4')}
            </Text>
          </Pressable>
        </View>
      </AdminScreen>
    );
  }

  return (
    <>
      <AdminScreen
        kicker={panelKicker}
        title={tUi('ui.pages.driver.driverActiveJob.activeDelivery_29af547736')}
        subtitle={tUi('ui.pages.driver.active.subtitle')}
        action={headerPill}
      >
        {jobs.map((job) => {
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
                      {tUi('ui.pages.driver.driverActiveJob.order_4b245b25fc')}
                      {job.order_id}
                    </Text>
                    <Text style={[styles.jobMeta, { textAlign }]} numberOfLines={1}>
                      {customerName || tUi('ui.pages.driver.driverActiveJob.nA_db8e99dc32')}
                    </Text>
                  </View>
                  <Text style={[styles.statusBadge, statusStyle(job.status)]}>
                    {getDeliveryStatusLabel(job.status, tUi)}
                  </Text>
                </View>
              </Pressable>
              {isExpanded ? renderJobDetail(job) : null}
            </View>
          );
        })}
      </AdminScreen>

      <DeliveryChatModal visible={showChat} onClose={() => setShowChat(false)} jobId={activeJob?.id} />

      <Modal visible={showIssueModal} animationType="slide" transparent onRequestClose={() => setShowIssueModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { textAlign }]}>
              {tUi('ui.pages.driver.driverActiveJob.reportAnIssue_2a314befe7')}
            </Text>
            <View style={[styles.issueTypeRow, { flexDirection: row }]}>
              {ISSUE_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  style={[styles.issueTypeChip, issueType === type.value && styles.issueTypeChipActive]}
                  onPress={() => setIssueType(type.value)}
                >
                  <Text
                    style={[
                      styles.issueTypeChipText,
                      issueType === type.value && styles.issueTypeChipTextActive,
                    ]}
                  >
                    {tUi(type.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.issueDescription, inputRtlStyle]}
              multiline
              placeholder={tUi('ui.pages.driver.driverActiveJob.describeTheIssue_16722c25ec')}
              placeholderTextColor={colors.muted}
              value={issueDescription}
              onChangeText={setIssueDescription}
            />
            <Pressable
              style={styles.secondaryBtn}
              onPress={async () => {
                const asset = await pickImage();
                if (asset) setIssuePhotoAsset(asset);
              }}
            >
              <Text style={styles.secondaryBtnText}>
                {tUi('ui.pages.driver.driverActiveJob.optionalPhoto_3348d1161f')}
              </Text>
            </Pressable>
            {issuePhotoAsset ? (
              <Image source={{ uri: issuePhotoAsset.uri }} style={styles.proofImage} />
            ) : null}
            <Pressable
              style={[styles.dangerBtn, !issueType && styles.btnDisabled]}
              onPress={handleReportIssue}
              disabled={!issueType}
            >
              <Text style={styles.dangerBtnText}>
                {tUi('ui.pages.driver.driverActiveJob.submitReport_a2a57073d5')}
              </Text>
            </Pressable>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowIssueModal(false)}>
              <Text style={styles.secondaryBtnText}>
                {tUi('ui.pages.driver.driverActiveJob.cancelPhotoDelete_e5f6a7b890')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    loadingWrap: { paddingVertical: 40, alignItems: 'center' },
    headerPill: {
      backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    headerPillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
    emptyText: { color: colors.muted, fontSize: 14 },
    primaryBtnStandalone: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
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
    statusAssigned: { color: '#2563eb', backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE' },
    statusPickedUp: { color: '#d97706', backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7' },
    statusDelivering: { color: '#7c3aed', backgroundColor: isDark ? 'rgba(124,58,237,0.15)' : '#EDE9FE' },
    statusDefault: { color: colors.muted, backgroundColor: colors.background },
    detailWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    stepper: { marginBottom: 12 },
    stepItem: { alignItems: 'center', marginRight: 16 },
    stepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    stepCircleDone: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
    stepCircleCurrent: { borderColor: colors.primary },
    stepCircleText: { fontSize: 11, fontWeight: '700', color: colors.text },
    stepLabel: { marginTop: 4, fontSize: 10, color: colors.muted, maxWidth: 72 },
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
    mapWrap: { height: 260, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
    routeCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    routeTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
    routeLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 6 },
    routeValue: { marginTop: 2, fontSize: 13, color: colors.text },
    proofSlot: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    proofHeader: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    proofTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
    proofStatus: { fontSize: 11, fontWeight: '600', color: colors.muted },
    proofImage: { width: '100%', height: 180, borderRadius: 12, marginTop: 8, backgroundColor: colors.border },
    proofActions: { gap: 8, marginTop: 10 },
    uploadZone: {
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      marginTop: 8,
      gap: 6,
    },
    uploadZoneLocked: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surface : '#F8FAFC',
      marginTop: 8,
    },
    uploadTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    uploadHint: { fontSize: 12, color: colors.muted },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    secondaryBtn: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryBtnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    deleteBtn: { marginTop: 8, alignSelf: 'flex-start' },
    deleteBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
    issueCard: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(217,119,6,0.3)' : '#FDE68A',
      backgroundColor: isDark ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
    },
    issueTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
    mutedText: { fontSize: 12, color: colors.muted, marginVertical: 4 },
    issueMessage: {
      marginTop: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    issueMessageMine: { borderColor: colors.primary },
    issueMessageMeta: { fontSize: 10, color: colors.muted, marginBottom: 4 },
    issueMessageText: { fontSize: 13, color: colors.text },
    issueInputRow: { gap: 8, marginTop: 10, alignItems: 'flex-end' },
    issueInput: {
      flex: 1,
      minHeight: 42,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      color: colors.text,
    },
    sendIssueBtn: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    sendIssueBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    actionsGrid: { gap: 8 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
    actionBtnTextPrimary: { color: '#fff' },
    btnDisabled: { opacity: 0.5 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.45)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '85%',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
    issueTypeRow: { flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    issueTypeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    issueTypeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    issueTypeChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    issueTypeChipTextActive: { color: '#fff' },
    issueDescription: {
      minHeight: 90,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
      color: colors.text,
      marginBottom: 12,
    },
    dangerBtn: {
      backgroundColor: '#dc2626',
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    dangerBtnText: { color: '#fff', fontWeight: '700' },
    modalCloseBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  });

export default DriverActiveJobScreen;
