import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDateTime } from '../../admin/utils/format';
import { confirmAction } from '../../admin/utils/confirm';
import http from '../../services/http';
import { INSTALLMENT_ENDPOINTS, ORDER_ENDPOINTS, buildUrl } from '../../config/api';

const DURATION_OPTIONS = [3, 6, 9, 12];

const InstallmentsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl, textAlign, row } = useRtlLayout();
  const { formatCurrency } = useCurrency();
  const inputRtl = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(route.params?.orderId || null);
  const [durationMonths, setDurationMonths] = useState(6);
  const [userNote, setUserNote] = useState('');
  const [docFiles, setDocFiles] = useState({ id_front: null, id_back: null, selfie_with_id: null });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(INSTALLMENT_ENDPOINTS.MY_REQUESTS);
      setRequests(response.data || []);
    } catch (error) {
      setRequests([]);
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.pages.installments.failedToFetchRequests_b4e8c2d3f3'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  const fetchEligibleOrders = useCallback(async () => {
    try {
      const response = await http.get(ORDER_ENDPOINTS.MY_ORDERS);
      const eligible = (response.data || []).filter(
        (o) => o.total_amount > 0 && !['cancelled', 'canceled'].includes(String(o.status).toLowerCase())
      );
      setOrders(eligible);
      if (!selectedOrderId && eligible.length) {
        setSelectedOrderId(eligible[0].id);
      }
    } catch (error) {
      setOrders([]);
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.pages.installments.failedToFetchOrders_b4e8c2d3f4'),
      });
    }
  }, [selectedOrderId, tUi]);

  useEffect(() => {
    fetchRequests();
    fetchEligibleOrders();
  }, [fetchRequests, fetchEligibleOrders]);

  useEffect(() => {
    if (route.params?.orderId) {
      setSelectedOrderId(route.params.orderId);
      setShowCreate(true);
    }
  }, [route.params?.orderId]);

  const pickDoc = async (type) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setDocFiles((prev) => ({
      ...prev,
      [type]: {
        uri: asset.uri,
        name: asset.fileName || `${type}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedOrderId) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.installments.orderSelectPlaceholder_b4e8c2d3ef') });
      return;
    }
    if (!docFiles.id_front || !docFiles.id_back || !docFiles.selfie_with_id) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.installments.allVerificationDocumentsAreRequired_bcfa92ae42') });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('order_id', String(selectedOrderId));
      formData.append('duration_months', String(durationMonths));
      formData.append('use_down_payment', 'false');
      if (userNote.trim()) formData.append('user_note', userNote.trim());
      if (!(user?.phone || '').trim()) {
        Toast.show({
          type: 'error',
          text1: tUi('ui.pages.installments.pleaseAddYourPhoneNumber_a88335d685'),
        });
        setSubmitting(false);
        return;
      }
      ['id_front', 'id_back', 'selfie_with_id'].forEach((key) => {
        const file = docFiles[key];
        formData.append(key, {
          uri: file.uri,
          name: file.name,
          type: file.type,
        });
      });

      await http.post(INSTALLMENT_ENDPOINTS.CREATE_REQUEST, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Toast.show({ type: 'success', text1: tUi('ui.pages.installments.installmentRequestSubmittedSuccessfully_8b973f374e') });
      setShowCreate(false);
      setUserNote('');
      setDocFiles({ id_front: null, id_back: null, selfie_with_id: null });
      fetchRequests();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.response?.data?.detail || error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId) => {
    const confirmed = await confirmAction(
      tUi('ui.pages.installments.cancelRequest_ac8b2c6262'),
      tUi('ui.pages.installments.cancelInstallmentRequest_d0153ff51b'),
      tUi('ui.pages.installments.cancelRequest_8ed95dc39e'),
      tUi('ui.pages.recommendations.cancel_5a0d97a8e1')
    );
    if (!confirmed) return;
    try {
      await http.patch(buildUrl(INSTALLMENT_ENDPOINTS.MY_CANCEL, { request_id: requestId }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.installments.installmentRequestCancelled_348c4c2825') });
      fetchRequests();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.response?.data?.detail || error.message });
    }
  };

  const paySchedule = (request, schedule) => {
    navigation.navigate('Payment', {
      amount: schedule.amount,
      orderId: request.order_id,
      installmentRequestId: request.id,
      installmentScheduleId: schedule.id,
    });
  };

  return (
    <CustomerScreen
      showBack
      title={tUi('ui.mobile.customer.account.installments')}
      subtitle={tUi('ui.pages.installments.requestAPlanUploadYour_362dac0d89')}
      action={
        <Pressable onPress={() => setShowCreate((v) => !v)}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {showCreate
              ? tUi('ui.pages.recommendations.cancel_5a0d97a8e1')
              : tUi('ui.pages.installments.newInstallmentRequest_d768e2332d')}
          </Text>
        </Pressable>
      }
    >
      {showCreate ? (
        <View style={[styles.formBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.muted, textAlign }]}>{tUi('ui.pages.installments.order_362b958f76')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {orders.map((order) => (
              <Pressable
                key={order.id}
                style={[
                  styles.chip,
                  selectedOrderId === order.id && { backgroundColor: colors.primary },
                  { borderColor: colors.border, marginRight: 8 },
                ]}
                onPress={() => setSelectedOrderId(order.id)}
              >
                <Text style={{ color: selectedOrderId === order.id ? '#fff' : colors.text, fontSize: 12 }}>
                  #{order.id} · {formatCurrency(order.total_amount)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.muted, textAlign }]}>{tUi('ui.pages.installments.durationMonths_4816202198')}</Text>
          <View style={[styles.durationRow, { flexDirection: row }]}>
            {DURATION_OPTIONS.map((months) => (
              <Pressable
                key={months}
                style={[
                  styles.chip,
                  durationMonths === months && { backgroundColor: colors.primary },
                  { borderColor: colors.border },
                ]}
                onPress={() => setDurationMonths(months)}
              >
                <Text style={{ color: durationMonths === months ? '#fff' : colors.text }}>{months}m</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.input, styles.textArea, inputRtl, { borderColor: colors.border, color: colors.text }]}
            placeholder={tUi('ui.pages.installments.addExtraDetailsForAdmin_25d686c776')}
            placeholderTextColor={colors.muted}
            value={userNote}
            onChangeText={setUserNote}
            multiline
          />

          {['id_front', 'id_back', 'selfie_with_id'].map((docType) => (
            <Pressable
              key={docType}
              style={[styles.docBtn, { borderColor: colors.border }]}
              onPress={() => pickDoc(docType)}
            >
              <Text style={{ color: colors.text }}>
                {tUi('ui.pages.installments.chooseFile_09bcb9ed31')} ({docType.replace(/_/g, ' ')})
                {docFiles[docType] ? ' ✓' : ''}
              </Text>
            </Pressable>
          ))}

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.primaryBtnText}>
              {submitting ? tUi('ui.pages.installments.submitting_3eccdd056d') : tUi('ui.pages.installments.submitRequest_60d31e50ea')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : requests.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign, marginTop: 16 }}>—</Text>
      ) : (
        requests.map((request) => (
          <View
            key={request.id}
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {tUi('ui.pages.installments.order_1aa126a282')}{request.order_id}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {request.status} · {formatDateTime(request.created_at)}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {tUi('ui.pages.installments.duration_b94d9fd57c')} {request.duration_months}m
            </Text>

            {request.schedules?.map((schedule) => (
              <View key={schedule.id} style={[styles.scheduleRow, { flexDirection: row }]}>
                <Text style={{ color: colors.text, flex: 1 }}>
                  #{schedule.installment_number} · {formatCurrency(schedule.amount)} · {schedule.status}
                </Text>
                {schedule.status !== 'paid' && request.status === 'approved' ? (
                  <Pressable onPress={() => paySchedule(request, schedule)}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      {tUi('ui.pages.installments.payWithStripe_1e1b16dbd9')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {['pending', 'approved'].includes(String(request.status).toLowerCase()) ? (
              <Pressable onPress={() => handleCancel(request.id)}>
                <Text style={{ color: colors.danger, fontWeight: '600', marginTop: 8 }}>
                  {tUi('ui.pages.installments.cancelRequest_8ed95dc39e')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </CustomerScreen>
  );
};

const createStyles = ({ shadow }) =>
  StyleSheet.create({
    formBox: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16, gap: 10, ...shadow },
    label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    durationRow: { flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    docBtn: { borderWidth: 1, borderRadius: 12, padding: 12 },
    primaryBtn: { borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    primaryBtnText: { color: '#fff', fontWeight: '700' },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12, ...shadow },
    scheduleRow: { marginTop: 8, alignItems: 'center', gap: 8 },
  });

export default InstallmentsScreen;
