import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';
import http from '../../services/http';
import { INSTALLMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { buildImageUrl, formatDate, formatDateTime } from '../utils/format';
import { useCurrency } from '../../hooks/useCurrency';
import { usePanelRole } from '../hooks/usePanelRole';

const DOCUMENT_TYPE_KEYS = [
  ['id_front', 'ui.mobile.adminInstallments.docIdFront'],
  ['id_back', 'ui.mobile.adminInstallments.docIdBack'],
  ['selfie_with_id', 'ui.mobile.adminInstallments.docSelfie'],
];

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];

const STATUS_LABEL_KEYS = {
  pending: 'ui.pages.admin.adminInstallments.pending_63a369810e',
  approved: 'ui.pages.admin.adminInstallments.approve_1d97c149aa',
  rejected: 'ui.pages.admin.adminInstallments.reject_b300f1d667',
  cancelled: 'ui.pages.admin.adminInstallments.cancelled_1f3e021548',
  canceled: 'ui.pages.admin.adminInstallments.cancelled_1f3e021548',
  completed: 'ui.pages.admin.adminInstallments.completed_1d0c28c972',
};

const toneForStatus = (status) => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'cancelled':
    case 'canceled':
      return 'danger';
    default:
      return 'default';
  }
};

const AdminInstallmentsScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { language } = useLanguage();
  const { isRtl, textAlign, row } = useRtlLayout();
  const { formatCurrency } = useCurrency();
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [actioning, setActioning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const getStatusLabel = useCallback(
    (status) => {
      const normalized = String(status || 'pending').toLowerCase();
      const key = STATUS_LABEL_KEYS[normalized];
      return key ? tUi(key) : normalized;
    },
    [tUi]
  );

  const getFilterLabel = useCallback(
    (status) => {
      if (status === 'all') {
        return tUi('ui.pages.admin.adminInstallments.all_cbfec376e0');
      }
      return getStatusLabel(status);
    },
    [getStatusLabel, tUi]
  );

  const getAuthConfig = useCallback(async () => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error(tUi('ui.mobile.adminInstallments.failedLoad'));
    }
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }, [tUi]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const authConfig = await getAuthConfig();
      const response = await http.get(INSTALLMENT_ENDPOINTS.ADMIN_REQUESTS, authConfig);
      const nextRequests = response.data || [];
      setAllRequests(nextRequests);
      if (!expandedRequestId && nextRequests.length) {
        setExpandedRequestId(nextRequests[0].id);
      }
    } catch (error) {
      const message = error.message || tUi('ui.mobile.adminInstallments.failedLoad');
      setAllRequests([]);
      setErrorMessage(message);
      Toast.show({ type: 'error', text1: message });
    } finally {
      setLoading(false);
    }
  }, [expandedRequestId, getAuthConfig, tUi]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const filtered = statusFilter === 'all'
      ? allRequests
      : allRequests.filter((req) => (req.status || '').toLowerCase() === statusFilter);
    setRequests(filtered);
  }, [allRequests, statusFilter]);

  const handleApprove = async (requestId) => {
    const approved = await confirmAction(
      tUi('ui.mobile.adminInstallments.approveTitle'),
      tUi('ui.mobile.adminInstallments.approveMessage'),
      tUi('ui.pages.admin.adminInstallments.approve_1d97c149aa'),
      tUi('ui.mobile.common.cancel')
    );
    if (!approved) return;
    setActioning(true);
    try {
      const authConfig = await getAuthConfig();
      await http.patch(
        buildUrl(INSTALLMENT_ENDPOINTS.ADMIN_REVIEW, { request_id: requestId }),
        adminNote.trim() ? { action: 'approve', admin_note: adminNote.trim() } : { action: 'approve' },
        authConfig
      );
      fetchRequests();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.mobile.adminInstallments.failedApprove'),
      });
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async (requestId) => {
    const rejected = await confirmAction(
      tUi('ui.mobile.adminInstallments.rejectTitle'),
      tUi('ui.mobile.adminInstallments.approveMessage'),
      tUi('ui.pages.admin.adminInstallments.reject_b300f1d667'),
      tUi('ui.mobile.common.cancel')
    );
    if (!rejected) return;
    setActioning(true);
    try {
      const authConfig = await getAuthConfig();
      await http.patch(
        buildUrl(INSTALLMENT_ENDPOINTS.ADMIN_REVIEW, { request_id: requestId }),
        adminNote.trim() ? { action: 'reject', admin_note: adminNote.trim() } : { action: 'reject' },
        authConfig
      );
      fetchRequests();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.mobile.adminInstallments.failedReject'),
      });
    } finally {
      setActioning(false);
    }
  };

  const handleCancel = async (requestId) => {
    const cancelled = await confirmAction(
      tUi('ui.mobile.adminInstallments.cancelTitle'),
      tUi('ui.mobile.adminInstallments.approveMessage'),
      tUi('ui.pages.admin.adminInstallments.cancelRequest_a6b7885506'),
      tUi('ui.pages.admin.adminInstallments.keepRequest_6a95cf977a')
    );
    if (!cancelled) return;
    setActioning(true);
    try {
      const authConfig = await getAuthConfig();
      await http.patch(
        buildUrl(INSTALLMENT_ENDPOINTS.ADMIN_CANCEL, { request_id: requestId }),
        adminNote.trim() ? { admin_note: adminNote.trim() } : {},
        authConfig
      );
      fetchRequests();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.message || tUi('ui.mobile.adminInstallments.failedCancel'),
      });
    } finally {
      setActioning(false);
    }
  };

  const selectedRequest = useMemo(
    () => requests.find((req) => req.id === expandedRequestId) || null,
    [expandedRequestId, requests]
  );

  useEffect(() => {
    setAdminNote(selectedRequest?.admin_note || '');
  }, [selectedRequest?.admin_note, selectedRequest?.id]);

  const pendingCount = allRequests.filter((req) => (req.status || '').toLowerCase() === 'pending').length;

  const customerLabel = useCallback(
    (request) => {
      const user = request?.user;
      if (!user) {
        return (
          request?.user_email
          || request?.user_name
          || tUi('ui.pages.admin.adminInstallments.userValue_2bb65a2840', {
            value0: request?.user_id || '-',
          })
        );
      }
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      return (
        user.email
        || fullName
        || tUi('ui.pages.admin.adminInstallments.userValue_2bb65a2840', {
          value0: request.user_id || '-',
        })
      );
    },
    [tUi]
  );

  const processingLabel = tUi('ui.pages.admin.adminInstallments.cancelling_23939436ee');

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.admin.adminInstallments.installmentRequests_2fc67af45f')}
      subtitle={tUi('ui.pages.admin.adminInstallments.subtitle_1a2b3c4d5f')}
      meta={tUi('ui.mobile.adminInstallments.pendingMeta', { value0: pendingCount })}
    >
      <View style={[styles.filterRow, { flexDirection: row }]}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterText,
                { textAlign },
                statusFilter === status && styles.filterTextActive,
              ]}
            >
              {getFilterLabel(status)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={[styles.errorTitle, { textAlign }]}>
            {tUi('ui.mobile.adminInstallments.failedLoad')}
          </Text>
          <Text style={[styles.errorText, { textAlign }]}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={fetchRequests}>
            <Text style={styles.retryText}>{tUi('ui.mobile.common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          {requests.map((request) => (
            <AdminListItem
              key={request.id}
              title={`${tUi('ui.pages.admin.adminInstallments.request_be00a60c8a')}${request.id}`}
              subtitle={`${customerLabel(request)} | ${tUi('ui.pages.admin.adminInstallments.order_49f67d4db8')} #${request.order_id}`}
              meta={`${formatCurrency(request.total_amount || 0)} ${tUi('ui.pages.admin.adminInstallments.total_e06af0484d')} | ${formatCurrency(request.remaining_balance || 0)} ${tUi('ui.pages.admin.adminInstallments.remaining_4f3da92ffc')}`}
              status={getStatusLabel(request.status)}
              statusTone={toneForStatus(request.status)}
              onPress={() =>
                setExpandedRequestId((prev) => (prev === request.id ? null : request.id))
              }
            />
          ))}
          {!requests.length ? (
            <Text style={[styles.emptyText, { textAlign }]}>
              {tUi('ui.pages.admin.adminInstallments.noInstallmentRequestsForThis_a2ec84d62f')}
            </Text>
          ) : null}
        </View>
      )}

      {selectedRequest ? (
        <View style={styles.detailCard}>
          <Text style={[styles.detailTitle, { textAlign }]}>
            {`${tUi('ui.pages.admin.adminInstallments.request_be00a60c8a')}${selectedRequest.id}`}
          </Text>
          <Text style={[styles.detailMeta, { textAlign }]}>
            {`${tUi('ui.pages.admin.adminInstallments.request_be00a60c8a')}${selectedRequest.id} | ${tUi('ui.pages.admin.adminInstallments.order_49f67d4db8')} #${selectedRequest.order_id}`}
          </Text>

          <View style={styles.summaryGrid}>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.customer_6bb072f714')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>{customerLabel(selectedRequest)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.phone_792be90cbb')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {selectedRequest.user?.phone || '—'}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.duration_8a9f6bac49')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {`${selectedRequest.duration_months || 0} ${tUi('ui.pages.admin.adminInstallments.months_194cd42615')}`}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.status_757a85a464')}
              </Text>
              <Text style={[styles.detailValue, { color: colors.primary, textAlign }]}>
                {getStatusLabel(selectedRequest.status)}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.totalAmount_bf522a1f51')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {formatCurrency(selectedRequest.total_amount || 0)}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.remainingBalance_546b92638c')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {formatCurrency(selectedRequest.remaining_balance || 0)}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.monthlyPayment_c6144d075c')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {formatCurrency(selectedRequest.monthly_payment || 0)}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.nextPaymentDate_dd7feff4cb')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {selectedRequest.next_payment_date
                  ? formatDate(selectedRequest.next_payment_date)
                  : tUi('ui.pages.admin.adminInstallments.notScheduled_983560543f')}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.created_bf6813b664')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {formatDateTime(selectedRequest.created_at)}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={[styles.detailLabel, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.approve_1d97c149aa')}
              </Text>
              <Text style={[styles.detailValue, { textAlign }]}>
                {formatDateTime(selectedRequest.reviewed_at)}
              </Text>
            </View>
          </View>

          {selectedRequest.user_note ? (
            <View style={styles.noteBlock}>
              <Text style={[styles.sectionTitle, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.userNote_9a1c56bb0b')}
              </Text>
              <Text style={[styles.noteText, { textAlign }]}>{selectedRequest.user_note}</Text>
            </View>
          ) : null}

          {selectedRequest.admin_note ? (
            <View style={styles.noteBlock}>
              <Text style={[styles.sectionTitle, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.adminNote_ea6470d41f')}
              </Text>
              <Text style={[styles.noteText, { textAlign }]}>{selectedRequest.admin_note}</Text>
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {tUi('ui.pages.admin.adminInstallments.order_49f67d4db8')}
            </Text>
            {(selectedRequest.items || []).length ? (
              selectedRequest.items.map((item) => (
                <View key={item.id} style={[styles.compactRow, { flexDirection: row }]}>
                  <View style={styles.compactMain}>
                    <Text style={[styles.compactTitle, { textAlign }]}>{item.product_name}</Text>
                    <Text style={[styles.compactMeta, { textAlign }]}>
                      {tUi('ui.pages.admin.adminInstallments.value_0e4b2e2dbc', {
                        value0: `${item.quantity} × ${formatCurrency(item.unit_price || 0)}`,
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.compactAmount, { textAlign }]}>
                    {formatCurrency(item.total || 0)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyInline, { textAlign }]}>
                {tUi('ui.mobile.common.noResults')}
              </Text>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {tUi('ui.pages.admin.adminInstallments.verificationDocuments_b2c3d4e5f6')}
            </Text>
            <View style={styles.documentGrid}>
              {DOCUMENT_TYPE_KEYS.map(([type, labelKey]) => {
                const document = (selectedRequest.documents || []).find((doc) => doc.document_type === type);
                return (
                  <View key={type} style={styles.documentCard}>
                    {document?.file_path ? (
                      <Image source={{ uri: buildImageUrl(document.file_path) }} style={styles.documentImage} />
                    ) : (
                      <View style={styles.documentMissing}>
                        <Text style={[styles.documentMissingText, { textAlign }]}>
                          {tUi('ui.pages.admin.adminInstallments.notUploaded_b78a3d1521')}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.documentLabel, { textAlign }]}>{tUi(labelKey)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {(selectedRequest.status || '').toLowerCase() === 'pending' ? (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.adminNote_ea6470d41f')}
              </Text>
              <TextInput
                style={[
                  styles.noteInput,
                  { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' },
                ]}
                value={adminNote}
                onChangeText={setAdminNote}
                multiline
                placeholder={tUi('ui.mobile.adminInstallments.notePlaceholder')}
                placeholderTextColor={colors.muted}
              />
            </View>
          ) : null}
          {(selectedRequest.status || '').toLowerCase() === 'pending' ? (
            <View style={[styles.actionRow, { flexDirection: row }]}>
              <Pressable
                style={[styles.dangerButton, actioning && styles.buttonDisabled]}
                onPress={() => handleReject(selectedRequest.id)}
                disabled={actioning}
              >
                <Text style={styles.buttonText}>
                  {actioning
                    ? processingLabel
                    : tUi('ui.pages.admin.adminInstallments.reject_b300f1d667')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.successButton, actioning && styles.buttonDisabled]}
                onPress={() => handleApprove(selectedRequest.id)}
                disabled={actioning}
              >
                <Text style={styles.buttonText}>
                  {actioning
                    ? processingLabel
                    : tUi('ui.pages.admin.adminInstallments.approve_1d97c149aa')}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {!['approved', 'cancelled', 'canceled', 'completed'].includes(
            (selectedRequest.status || '').toLowerCase()
          ) ? (
            <Pressable
              style={[styles.cancelButton, actioning && styles.buttonDisabled]}
              onPress={() => handleCancel(selectedRequest.id)}
              disabled={actioning}
            >
              <Text style={styles.buttonText}>
                {actioning
                  ? processingLabel
                  : tUi('ui.pages.admin.adminInstallments.cancelRequest_a6b7885506')}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {tUi('ui.pages.admin.adminInstallments.paymentSchedule_779f92e1ea')}
            </Text>
            {(selectedRequest.schedules || []).length ? (
              selectedRequest.schedules.map((schedule) => (
                <View key={schedule.id} style={[styles.compactRow, { flexDirection: row }]}>
                  <View style={styles.compactMain}>
                    <Text style={[styles.compactTitle, { textAlign }]}>
                      {`${tUi('ui.pages.admin.adminInstallments.request_be00a60c8a')}${schedule.installment_number}`}
                    </Text>
                    <Text style={[styles.compactMeta, { textAlign }]}>
                      {`${tUi('ui.pages.admin.adminInstallments.dueDate_b86b269e67')} ${formatDate(schedule.due_date)}`}
                    </Text>
                    <Text style={[styles.compactMeta, { textAlign }]}>
                      {`${tUi('ui.pages.admin.adminInstallments.status_757a85a464')}: ${getStatusLabel(schedule.status)}`}
                    </Text>
                  </View>
                  <View style={styles.amountColumn}>
                    <Text style={[styles.compactAmount, { textAlign }]}>
                      {formatCurrency(schedule.amount_due || 0)}
                    </Text>
                    {Number(schedule.amount_paid || 0) > 0 ? (
                      <Text style={[styles.compactMeta, { textAlign }]}>
                        {`${tUi('ui.pages.admin.adminInstallments.amount_f04179eb75')} ${formatCurrency(schedule.amount_paid || 0)}`}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyInline, { textAlign }]}>
                {tUi('ui.pages.admin.adminInstallments.notScheduled_983560543f')}
              </Text>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {tUi('ui.pages.admin.adminInstallments.paymentHistory_f1eac32837')}
            </Text>
            {(selectedRequest.payments || []).length ? (
              [...(selectedRequest.payments || [])]
                .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                .map((payment) => (
                  <View key={payment.id} style={[styles.compactRow, { flexDirection: row }]}>
                    <View style={styles.compactMain}>
                      <Text style={[styles.compactTitle, { textAlign }]}>
                        {formatDateTime(payment.paid_at)}
                      </Text>
                      {payment.note ? (
                        <Text style={[styles.compactMeta, { textAlign }]}>{payment.note}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.compactAmount, { textAlign }]}>
                      {formatCurrency(payment.amount || 0)}
                    </Text>
                  </View>
                ))
            ) : (
              <Text style={[styles.emptyInline, { textAlign }]}>
                {tUi('ui.mobile.common.noResults')}
              </Text>
            )}
          </View>
        </View>
      ) : null}
    </AdminScreen>
  );
};

const createStyles = ({ colors, isDark }) =>
  StyleSheet.create({
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
    marginEnd: 8,
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
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  errorCard: {
    backgroundColor: isDark ? `${colors.danger}22` : '#FEF2F2',
    borderWidth: 1,
    borderColor: isDark ? colors.danger : '#FECACA',
    borderRadius: 16,
    padding: 16,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  retryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  detailCell: {
    width: '50%',
    paddingEnd: 10,
    marginTop: 12,
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
  sectionBlock: {
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  noteBlock: {
    marginTop: 16,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
  },
  noteText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  noteInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    textAlignVertical: 'top',
  },
  emptyInline: {
    color: colors.muted,
    fontSize: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  compactMain: {
    flex: 1,
    paddingEnd: 10,
  },
  compactTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  compactMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  compactAmount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  amountColumn: {
    alignItems: 'flex-end',
  },
  documentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  documentCard: {
    width: '31%',
  },
  documentImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  documentMissing: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentMissingText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  documentLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dangerButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginEnd: 8,
  },
  successButton: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButton: {
    marginTop: 10,
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  });

export default AdminInstallmentsScreen;
