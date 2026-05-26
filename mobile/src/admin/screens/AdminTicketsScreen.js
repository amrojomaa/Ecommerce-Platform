import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { colors } from '../styles/theme';
import http from '../../services/http';
import { TICKET_ENDPOINTS, USER_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { formatDateTime } from '../utils/format';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];

const AdminTicketsScreen = () => {
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
    fetchTickets();
  };

  const handleAddResponse = async (ticketId) => {
    if (!responseMessage.trim()) return;
    await http.post(buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId }), {
      message: responseMessage.trim(),
    });
    setResponseMessage('');
  };

  const handleDelete = async (ticketId) => {
    const ok = await confirmAction('Delete ticket', 'Delete this ticket?');
    if (!ok) return;
    await http.delete(buildUrl(TICKET_ENDPOINTS.DELETE, { ticket_id: ticketId }));
    fetchTickets();
    fetchPendingDeletes();
  };

  const handleApproveDelete = async (ticketId) => {
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
    <AdminScreen title="Support Tickets" subtitle="Assign, respond, and resolve tickets.">
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
              {status.toLowerCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, assignedFilter === 'all' && styles.filterChipActive]}
          onPress={() => setAssignedFilter('all')}
        >
          <Text
            style={[styles.filterText, assignedFilter === 'all' && styles.filterTextActive]}
          >
            all
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, assignedFilter === 'unassigned' && styles.filterChipActive]}
          onPress={() => setAssignedFilter('unassigned')}
        >
          <Text
            style={[styles.filterText, assignedFilter === 'unassigned' && styles.filterTextActive]}
          >
            unassigned
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
          <Text style={styles.pendingTitle}>Pending delete requests</Text>
          {pendingDeletes.map((ticket) => (
            <View key={ticket.id} style={styles.pendingRow}>
              <Text style={styles.pendingText}>{ticket.title}</Text>
              <View style={styles.pendingActions}>
                <Pressable onPress={() => handleApproveDelete(ticket.id)}>
                  <Text style={styles.inlineButton}>Approve</Text>
                </Pressable>
                <Pressable onPress={() => handleRejectDelete(ticket.id)}>
                  <Text style={[styles.inlineButton, styles.deleteButton]}>Reject</Text>
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
              meta={`Customer: ${ticket.customer?.email || 'Unknown'} | ${formatDateTime(
                ticket.created_at
              )}`}
              status={ticket.status}
              statusTone={ticket.status === 'Resolved' ? 'success' : 'warning'}
              onPress={() => setSelectedTicket(ticket)}
              right={
                <Pressable onPress={() => setAssignModalTicket(ticket)}>
                  <Text style={styles.inlineButton}>Assign</Text>
                </Pressable>
              }
            />
          ))}
          {!filtered.length ? (
            <Text style={styles.emptyText}>No tickets found.</Text>
          ) : null}
        </View>
      )}

      {selectedTicket ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedTicket.title}</Text>
          <Text style={styles.detailMeta}>{selectedTicket.description}</Text>
          <Text style={styles.detailMeta}>{`Status: ${selectedTicket.status}`}</Text>
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
                <Text style={styles.statusChipText}>{status}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.responseInput}
            placeholder="Add a response"
            placeholderTextColor={colors.muted}
            value={responseMessage}
            onChangeText={setResponseMessage}
            multiline
          />
          <View style={styles.detailActions}>
            <Pressable style={styles.primaryButton} onPress={() => handleAddResponse(selectedTicket.id)}>
              <Text style={styles.primaryButtonText}>Send response</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => handleDelete(selectedTicket.id)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={!!assignModalTicket} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAssignModalTicket(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Assign support agent</Text>
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
});

export default AdminTicketsScreen;
