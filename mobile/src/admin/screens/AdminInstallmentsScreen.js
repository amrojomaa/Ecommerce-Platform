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
import { colors } from '../styles/theme';
import http from '../../services/http';
import { INSTALLMENT_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { buildImageUrl, formatDate, formatDateTime } from '../utils/format';
import { useCurrency } from '../../hooks/useCurrency';

const DOCUMENT_TYPES = [
  ['id_front', 'ID Front'],
  ['id_back', 'ID Back'],
  ['selfie_with_id', 'Selfie With ID'],
];

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
  const { formatCurrency } = useCurrency();
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [actioning, setActioning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const getAuthConfig = async () => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error('Session missing. Please sign in again.');
    }
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

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
      const message = error.message || 'Failed to load installment requests';
      setAllRequests([]);
      setErrorMessage(message);
      Toast.show({ type: 'error', text1: message });
    } finally {
      setLoading(false);
    }
  }, [expandedRequestId]);

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
      'Approve Request?',
      'This action cannot be undone.',
      'Approve'
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
      Toast.show({ type: 'error', text1: error.message || 'Failed to approve request' });
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async (requestId) => {
    const rejected = await confirmAction(
      'Reject Request?',
      'This action cannot be undone.',
      'Reject'
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
      Toast.show({ type: 'error', text1: error.message || 'Failed to reject request' });
    } finally {
      setActioning(false);
    }
  };

  const handleCancel = async (requestId) => {
    const cancelled = await confirmAction(
      'Cancel Request?',
      'Cancelled installment requests cannot be restored.',
      'Cancel Request'
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
      Toast.show({ type: 'error', text1: error.message || 'Failed to cancel request' });
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

  const customerLabel = (request) => {
    const user = request?.user;
    if (!user) return request?.user_email || request?.user_name || `User #${request?.user_id || '-'}`;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return user.email || fullName || `User #${request.user_id || '-'}`;
  };

  return (
    <AdminScreen
      title="Installments"
      subtitle="Review and approve installment requests."
      meta={`Pending: ${pendingCount}`}
    >
      <View style={styles.filterRow}>
        {['all', 'pending', 'approved', 'rejected', 'cancelled', 'completed'].map((status) => (
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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not load installments</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={fetchRequests}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          {requests.map((request) => (
            <AdminListItem
              key={request.id}
              title={`Request #${request.id}`}
              subtitle={`${customerLabel(request)} | Order #${request.order_id}`}
              meta={`${formatCurrency(request.total_amount || 0)} total | ${formatCurrency(request.remaining_balance || 0)} remaining`}
              status={request.status || 'pending'}
              statusTone={toneForStatus(request.status)}
              onPress={() =>
                setExpandedRequestId((prev) => (prev === request.id ? null : request.id))
              }
            />
          ))}
          {!requests.length ? (
            <Text style={styles.emptyText}>No installment requests found.</Text>
          ) : null}
        </View>
      )}

      {selectedRequest ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Request Details</Text>
          <Text style={styles.detailMeta}>{`Request #${selectedRequest.id} | Order #${selectedRequest.order_id}`}</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Customer</Text>
              <Text style={styles.detailValue}>{customerLabel(selectedRequest)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{selectedRequest.user?.phone || 'N/A'}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{selectedRequest.duration_months || 0} months</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>
                {selectedRequest.status || 'pending'}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Total Amount</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedRequest.total_amount || 0)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Remaining</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedRequest.remaining_balance || 0)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Monthly Payment</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedRequest.monthly_payment || 0)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Next Payment</Text>
              <Text style={styles.detailValue}>
                {selectedRequest.next_payment_date ? formatDate(selectedRequest.next_payment_date) : 'Not scheduled'}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>{formatDateTime(selectedRequest.created_at)}</Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Reviewed</Text>
              <Text style={styles.detailValue}>{formatDateTime(selectedRequest.reviewed_at)}</Text>
            </View>
          </View>

          {selectedRequest.user_note ? (
            <View style={styles.noteBlock}>
              <Text style={styles.sectionTitle}>User Note</Text>
              <Text style={styles.noteText}>{selectedRequest.user_note}</Text>
            </View>
          ) : null}

          {selectedRequest.admin_note ? (
            <View style={styles.noteBlock}>
              <Text style={styles.sectionTitle}>Admin Note</Text>
              <Text style={styles.noteText}>{selectedRequest.admin_note}</Text>
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Items</Text>
            {(selectedRequest.items || []).length ? (
              selectedRequest.items.map((item) => (
                <View key={item.id} style={styles.compactRow}>
                  <View style={styles.compactMain}>
                    <Text style={styles.compactTitle}>{item.product_name}</Text>
                    <Text style={styles.compactMeta}>Qty {item.quantity} | Unit {formatCurrency(item.unit_price || 0)}</Text>
                  </View>
                  <Text style={styles.compactAmount}>{formatCurrency(item.total || 0)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyInline}>No item data.</Text>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Verification Documents</Text>
            <View style={styles.documentGrid}>
              {DOCUMENT_TYPES.map(([type, label]) => {
                const document = (selectedRequest.documents || []).find((doc) => doc.document_type === type);
                return (
                  <View key={type} style={styles.documentCard}>
                    {document?.file_path ? (
                      <Image source={{ uri: buildImageUrl(document.file_path) }} style={styles.documentImage} />
                    ) : (
                      <View style={styles.documentMissing}>
                        <Text style={styles.documentMissingText}>Missing</Text>
                      </View>
                    )}
                    <Text style={styles.documentLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {(selectedRequest.status || '').toLowerCase() === 'pending' ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Admin Note</Text>
              <TextInput
                style={styles.noteInput}
                value={adminNote}
                onChangeText={setAdminNote}
                multiline
                placeholder="Optional note for approval, rejection, or cancellation"
                placeholderTextColor={colors.muted}
              />
            </View>
          ) : null}
          {(selectedRequest.status || '').toLowerCase() === 'pending' ? (
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.dangerButton, actioning && styles.buttonDisabled]}
                onPress={() => handleReject(selectedRequest.id)}
                disabled={actioning}
              >
                <Text style={styles.buttonText}>{actioning ? 'Processing...' : 'Reject'}</Text>
              </Pressable>
              <Pressable
                style={[styles.successButton, actioning && styles.buttonDisabled]}
                onPress={() => handleApprove(selectedRequest.id)}
                disabled={actioning}
              >
                <Text style={styles.buttonText}>{actioning ? 'Processing...' : 'Approve'}</Text>
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
              <Text style={styles.buttonText}>{actioning ? 'Processing...' : 'Cancel Request'}</Text>
            </Pressable>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Payment Schedule</Text>
            {(selectedRequest.schedules || []).length ? (
              selectedRequest.schedules.map((schedule) => (
                <View key={schedule.id} style={styles.compactRow}>
                  <View style={styles.compactMain}>
                    <Text style={styles.compactTitle}>Installment #{schedule.installment_number}</Text>
                    <Text style={styles.compactMeta}>Due {formatDate(schedule.due_date)}</Text>
                    <Text style={styles.compactMeta}>Status: {schedule.status || 'pending'}</Text>
                  </View>
                  <View style={styles.amountColumn}>
                    <Text style={styles.compactAmount}>{formatCurrency(schedule.amount_due || 0)}</Text>
                    {Number(schedule.amount_paid || 0) > 0 ? (
                      <Text style={styles.compactMeta}>Paid {formatCurrency(schedule.amount_paid || 0)}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyInline}>No schedule generated.</Text>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            {(selectedRequest.payments || []).length ? (
              [...(selectedRequest.payments || [])]
                .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                .map((payment) => (
                  <View key={payment.id} style={styles.compactRow}>
                    <View style={styles.compactMain}>
                      <Text style={styles.compactTitle}>{formatDateTime(payment.paid_at)}</Text>
                      {payment.note ? <Text style={styles.compactMeta}>{payment.note}</Text> : null}
                    </View>
                    <Text style={styles.compactAmount}>{formatCurrency(payment.amount || 0)}</Text>
                  </View>
                ))
            ) : (
              <Text style={styles.emptyInline}>No payment history.</Text>
            )}
          </View>
        </View>
      ) : null}
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
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
    paddingRight: 10,
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
    paddingRight: 10,
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
    marginRight: 8,
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
