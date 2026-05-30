import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdminScreen from '../components/AdminScreen';
import AdminListItem from '../components/AdminListItem';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { formatDateTime } from '../utils/format';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { usePanelRole } from '../hooks/usePanelRole';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];

const TICKET_STATUS_LABEL_KEYS = {
  Open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  'In Progress': 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6',
  Resolved: 'ui.pages.admin.adminTickets.resolved_696eb2f977',
  Closed: 'ui.pages.admin.adminTickets.closed_5b72d42e4a',
};

const AdminTicketsScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { markAsViewed } = useUnreadTickets();
  const { isRtl, textAlign } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const getTicketStatusLabel = useCallback(
    (status) => {
      const key = TICKET_STATUS_LABEL_KEYS[status];
      return key ? tUi(key) : status;
    },
    [tUi]
  );

  const getStatusFilterLabel = useCallback(
    (status) => {
      if (status === 'all') {
        return tUi('ui.pages.admin.adminTickets.all_89e88f8e70');
      }
      return getTicketStatusLabel(status);
    },
    [getTicketStatusLabel, tUi]
  );

  const [tickets, setTickets] = useState([]);
  const [supportAgents, setSupportAgents] = useState([]);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [assignModalTicket, setAssignModalTicket] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const selectedResponses = useMemo(() => {
    if (!selectedTicket?.responses) return [];
    return selectedTicket.responses.filter((response) => !response.is_chat);
  }, [selectedTicket]);

  const getResponseAuthor = (response) => {
    const user = response?.user;
    if (!user) return tUi('ui.mobile.adminInstallments.unknownUser');
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || user.email || tUi('ui.mobile.adminInstallments.unknownUser');
  };

  const fetchTicketDetails = useCallback(async (ticketId) => {
    try {
      const response = await http.get(buildUrl(TICKET_ENDPOINTS.BY_ID, { ticket_id: ticketId }));
      if (response.data?.id) {
        setSelectedTicket(response.data);
        setTickets((prev) =>
          prev.map((ticket) => (ticket.id === response.data.id ? response.data : ticket))
        );
      }
    } catch (_) {}
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.ALL);
      setTickets(response.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSupportAgents = useCallback(async () => {
    try {
      const response = await http.get(USER_ENDPOINTS.ALL, { params: { role: 'support_agent' } });
      setSupportAgents(response.data || []);
    } catch (_) {
      setSupportAgents([]);
    }
  }, []);

  const fetchPendingDeletes = useCallback(async () => {
    try {
      const response = await http.get(TICKET_ENDPOINTS.PENDING_DELETES);
      setPendingDeletes(response.data || []);
    } catch (_) {
      setPendingDeletes([]);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchSupportAgents();
    fetchPendingDeletes();
  }, [fetchPendingDeletes, fetchSupportAgents, fetchTickets]);

  useFocusEffect(
    useCallback(() => {
      markAsViewed();
    }, [markAsViewed])
  );

  const filtered = useMemo(() => {
    let list = [...tickets];
    if (statusFilter !== 'all') {
      list = list.filter((ticket) => ticket.status === statusFilter);
    }
    if (assignedFilter === 'unassigned') {
      list = list.filter((ticket) => !ticket.employee_id);
    } else if (assignedFilter !== 'all') {
      list = list.filter((ticket) => String(ticket.employee_id) === assignedFilter);
    }
    return list;
  }, [assignedFilter, statusFilter, tickets]);

  const handleAssign = async () => {
    if (!assignModalTicket || !selectedAgentId) return;
    await http.patch(buildUrl(TICKET_ENDPOINTS.ASSIGN, { ticket_id: assignModalTicket.id }), {
      employee_id: Number(selectedAgentId),
    });
    setAssignModalTicket(null);
    setSelectedAgentId('');
    fetchTickets();
  };

  const handleUpdateStatus = async (ticketId, status) => {
    await http.patch(buildUrl(TICKET_ENDPOINTS.UPDATE_STATUS, { ticket_id: ticketId }), { status });
    setSelectedTicket((prev) => (prev && prev.id === ticketId ? { ...prev, status } : prev));
    fetchTickets();
  };

  const handleAddResponse = async (ticketId) => {
    if (!responseMessage.trim()) return;
    await http.post(buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId }), {
      message: responseMessage.trim(),
    });
    setResponseMessage('');
    fetchTicketDetails(ticketId);
  };

  const handleSelectTicket = useCallback(
    (ticket) => {
      setSelectedTicket(ticket);
      fetchTicketDetails(ticket.id);
    },
    [fetchTicketDetails]
  );

  const handleDelete = async (ticketId) => {
    const ok = await confirmAction(
      tUi('ui.pages.admin.adminTickets.deleteTicket_737e638768'),
      tUi('ui.pages.admin.adminTickets.areYouSureYouWant_59d1414125'),
      tUi('ui.pages.admin.adminTickets.delete_96591806d8'),
      tUi('ui.pages.admin.adminTickets.cancel_b33ccf8e29')
    );
    if (!ok) return;
    await http.delete(buildUrl(TICKET_ENDPOINTS.DELETE, { ticket_id: ticketId }));
    fetchTickets();
    fetchPendingDeletes();
  };

  const handleApproveDelete = async (ticketId) => {
    const ok = await confirmAction(
      tUi('ui.pages.admin.adminTickets.approveDeleteRequest_b023259325'),
      tUi('ui.pages.admin.adminTickets.approveAndDeleteThisTicket_93b6b71614'),
      tUi('ui.pages.admin.adminTickets.approveDelete_4efd775c5f'),
      tUi('ui.pages.admin.adminTickets.cancel_b33ccf8e29')
    );
    if (!ok) return;
    await http.post(buildUrl(TICKET_ENDPOINTS.APPROVE_DELETE, { ticket_id: ticketId }));
    fetchTickets();
    fetchPendingDeletes();
  };

  const handleRejectDelete = async (ticketId) => {
    await http.post(buildUrl(TICKET_ENDPOINTS.REJECT_DELETE, { ticket_id: ticketId }));
    fetchTickets();
    fetchPendingDeletes();
  };

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.admin.adminTickets.allTickets_10363e2701')}
      subtitle={tUi('ui.pages.admin.adminTickets.subtitle_1a2b3c4d5j')}
    >
      <Text style={styles.filterLabel}>{tUi('ui.pages.admin.adminTickets.filterByStatus_9e240a5b82')}</Text>
      <View style={styles.filterRow}>
        {['all', ...STATUS_OPTIONS].map((status) => (
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

      <Text style={styles.filterLabel}>{tUi('ui.pages.admin.adminTickets.filterByAssignedTo_d037356f6b')}</Text>
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, assignedFilter === 'all' && styles.filterChipActive]}
          onPress={() => setAssignedFilter('all')}
        >
          <Text
            style={[styles.filterText, assignedFilter === 'all' && styles.filterTextActive]}
          >
            {tUi('ui.pages.admin.adminTickets.all_89e88f8e70')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, assignedFilter === 'unassigned' && styles.filterChipActive]}
          onPress={() => setAssignedFilter('unassigned')}
        >
          <Text
            style={[styles.filterText, assignedFilter === 'unassigned' && styles.filterTextActive]}
          >
            {tUi('ui.pages.admin.adminTickets.unassigned_0796076cc1')}
          </Text>
        </Pressable>
        {supportAgents.map((agent) => (
          <Pressable
            key={agent.id}
            style={[styles.filterChip, assignedFilter === String(agent.id) && styles.filterChipActive]}
            onPress={() => setAssignedFilter(String(agent.id))}
          >
            <Text
              style={[
                styles.filterText,
                assignedFilter === String(agent.id) && styles.filterTextActive,
              ]}
            >
              {agent.first_name}
            </Text>
          </Pressable>
        ))}
      </View>

      {pendingDeletes.length ? (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>
            {tUi('ui.pages.admin.adminTickets.pendingDeleteRequestsTitle_7d6c5b4a3f', {
              count: pendingDeletes.length,
            })}
          </Text>
          {pendingDeletes.map((ticket) => (
            <View key={ticket.id} style={styles.pendingRow}>
              <Text style={styles.pendingText}>{ticket.title}</Text>
              <View style={styles.pendingActions}>
                <Pressable onPress={() => handleApproveDelete(ticket.id)}>
                  <Text style={styles.inlineButton}>{tUi('ui.pages.admin.adminTickets.approveDelete_4efd775c5f')}</Text>
                </Pressable>
                <Pressable onPress={() => handleRejectDelete(ticket.id)}>
                  <Text style={[styles.inlineButton, styles.deleteButton]}>{tUi('ui.pages.admin.adminTickets.reject_6ed0dbd575')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {filtered.map((ticket) => (
            <AdminListItem
              key={ticket.id}
              title={ticket.title}
              subtitle={ticket.description}
              meta={`${tUi('ui.pages.admin.adminTickets.customer_b9f6549afe')} ${
                ticket.customer?.email || tUi('ui.mobile.adminInstallments.unknownUser')
              } · ${formatDateTime(ticket.created_at)}`}
              status={getTicketStatusLabel(ticket.status)}
              statusTone={ticket.status === 'Resolved' ? 'success' : 'warning'}
              onPress={() => handleSelectTicket(ticket)}
              right={
                <Pressable onPress={() => setAssignModalTicket(ticket)}>
                  <Text style={styles.inlineButton}>{tUi('ui.pages.admin.adminTickets.assign_b71a20df8c')}</Text>
                </Pressable>
              }
            />
          ))}
          {!filtered.length ? (
            <Text style={styles.emptyText}>{tUi('ui.pages.admin.adminTickets.noTicketsFound_563b84a408')}</Text>
          ) : null}
        </View>
      )}

      {selectedTicket ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedTicket.title}</Text>
          <Text style={styles.detailMeta}>{selectedTicket.description}</Text>
          <Text style={styles.detailMeta}>
            {`${tUi('ui.pages.admin.adminOrders.status_7bb0ee7637')}: ${getTicketStatusLabel(
              selectedTicket.status
            )}`}
          </Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.statusChip,
                  selectedTicket.status === status && styles.statusChipActive,
                ]}
                onPress={() => handleUpdateStatus(selectedTicket.id, status)}
              >
                <Text style={styles.statusChipText}>{getTicketStatusLabel(status)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.responsesSection}>
            <Text style={styles.responsesTitle}>
              {`${tUi('ui.pages.admin.adminTickets.responses_2332bf585e')}${selectedResponses.length})`}
            </Text>
            {selectedResponses.length ? (
              selectedResponses.map((response) => (
                <View key={response.id} style={styles.responseItem}>
                  <View style={styles.responseHeader}>
                    <Text style={styles.responseAuthor}>{getResponseAuthor(response)}</Text>
                    <Text style={styles.responseDate}>{formatDateTime(response.created_at)}</Text>
                  </View>
                  <Text style={styles.responseMessage}>{response.message}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.responsesEmpty}>{tUi('ui.pages.admin.adminTickets.noResponsesYet_5773352778')}</Text>
            )}
          </View>
          <TextInput
            style={[styles.responseInput, inputRtlStyle]}
            placeholder={tUi('ui.pages.admin.adminTickets.typeYourResponse_3b25ee5a90')}
            placeholderTextColor={colors.muted}
            value={responseMessage}
            onChangeText={setResponseMessage}
            multiline
          />
          <View style={styles.detailActions}>
            <Pressable style={styles.primaryButton} onPress={() => handleAddResponse(selectedTicket.id)}>
              <Text style={styles.primaryButtonText}>
                {tUi('ui.pages.admin.adminTickets.sendResponse_19ad5c5ebf')}
              </Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => handleDelete(selectedTicket.id)}>
              <Text style={styles.deleteButtonText}>{tUi('ui.pages.admin.adminTickets.delete_96591806d8')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={!!assignModalTicket} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAssignModalTicket(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {tUi('ui.pages.admin.adminTickets.assignTicket_a1cbabca83')}
            </Text>
            {supportAgents.map((agent) => (
              <Pressable
                key={agent.id}
                style={styles.modalOption}
                onPress={() => setSelectedAgentId(String(agent.id))}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedAgentId === String(agent.id) && styles.modalOptionTextActive,
                  ]}
                >
                  {agent.first_name} {agent.last_name}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.primaryButton} onPress={handleAssign}>
              <Text style={styles.primaryButtonText}>{tUi('ui.pages.admin.adminTickets.assign_b71a20df8c')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setAssignModalTicket(null)}>
              <Text style={styles.secondaryButtonText}>
                {tUi('ui.pages.admin.adminTickets.cancel_b33ccf8e29')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
  },
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
  pendingCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  pendingRow: {
    marginBottom: 10,
  },
  pendingText: {
    fontSize: 13,
    color: colors.text,
  },
  pendingActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  inlineButton: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 12,
  },
  deleteButton: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.surface,
    fontWeight: '700',
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
    marginTop: 6,
    fontSize: 12,
    color: colors.muted,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 12,
    color: colors.text,
  },
  responsesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  responsesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  responseItem: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  responseAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  responseDate: {
    fontSize: 11,
    color: colors.muted,
  },
  responseMessage: {
    fontSize: 12,
    color: colors.text,
  },
  responsesEmpty: {
    marginTop: 8,
    fontSize: 12,
    color: colors.muted,
  },
  responseInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  detailActions: {
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700',
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
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
});

export default AdminTicketsScreen;
