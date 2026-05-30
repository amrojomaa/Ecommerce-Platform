import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import SupportTicketChatModal from '../components/SupportTicketChatModal';
import TicketUserAvatar from '../components/TicketUserAvatar';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../../config/api';
import { confirmAction } from '../utils/confirm';
import { formatDateTime } from '../utils/format';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { usePanelRole } from '../hooks/usePanelRole';

const TICKET_STATUS_LABEL_KEYS = {
  open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  in_progress: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6',
  resolved: 'ui.pages.admin.adminTickets.resolved_696eb2f977',
  closed: 'ui.pages.admin.adminTickets.closed_5b72d42e4a',
};

const STATUS_UPDATE_OPTIONS = [
  { value: 'In Progress', labelKey: 'ui.pages.admin.adminTickets.inProgress_18e19f0fd6' },
  { value: 'Resolved', labelKey: 'ui.pages.admin.adminTickets.resolved_696eb2f977' },
  { value: 'Closed', labelKey: 'ui.pages.admin.adminTickets.closed_5b72d42e4a' },
];

const TICKET_TABS = ['assigned', 'unassigned', 'completed'];

const normalizeTicketStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const parseTicketTab = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return TICKET_TABS.includes(normalized) ? normalized : 'assigned';
};

const SupportAgentTicketsScreen = () => {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { markAsViewed } = useUnreadTickets();
  const { isRtl, textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [activeTab, setActiveTab] = useState(parseTicketTab(route.params?.tab));
  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingTicketId, setRespondingTicketId] = useState(null);
  const [requestingDelete, setRequestingDelete] = useState(null);
  const [activeChatTicket, setActiveChatTicket] = useState(null);
  const [assignedTickets, setAssignedTickets] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [claimingTicketId, setClaimingTicketId] = useState(null);

  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(parseTicketTab(route.params.tab));
    }
  }, [route.params?.tab]);

  const getStatusLabel = useCallback(
    (status) => {
      const normalized = normalizeTicketStatus(status);
      const key = TICKET_STATUS_LABEL_KEYS[normalized];
      return key ? tUi(key) : status || normalized.replace(/_/g, ' ');
    },
    [tUi]
  );

  const formatTicketMeta = useCallback((ticket) => {
    const customerName = `${ticket.customer?.first_name || ''} ${ticket.customer?.last_name || ''}`.trim();
    return `${customerName} · ${ticket.customer?.email || ''} · ${formatDateTime(ticket.created_at)}`;
  }, []);

  const fetchAllTickets = useCallback(async () => {
    try {
      const [assigned, unassigned] = await Promise.all([
        http.get(TICKET_ENDPOINTS.ASSIGNED),
        http.get(TICKET_ENDPOINTS.UNASSIGNED),
      ]);
      const assignedData = assigned.data || [];
      setAssignedTickets(
        assignedData.filter((ticket) => ticket.status !== 'Resolved' && ticket.status !== 'Closed')
      );
      setCompletedTickets(
        assignedData.filter((ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed')
      );
      setUnassignedTickets(unassigned.data || []);
    } catch (_) {}
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.ASSIGNED);
      const assignedData = response.data || [];
      setAssignedTickets(
        assignedData.filter((ticket) => ticket.status !== 'Resolved' && ticket.status !== 'Closed')
      );
      setCompletedTickets(
        assignedData.filter((ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed')
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.support_agent.supportAgentTickets.failedToFetchTickets_bd5457c4b4'),
      });
      setAssignedTickets([]);
      setCompletedTickets([]);
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  const fetchUnassignedTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.UNASSIGNED);
      setUnassignedTickets(response.data || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.support_agent.tickets.failedToFetchUnassigned'),
      });
      setUnassignedTickets([]);
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchAllTickets();
  }, [fetchAllTickets]);

  useEffect(() => {
    if (activeTab === 'unassigned') {
      fetchUnassignedTickets();
    } else {
      fetchTickets();
    }
  }, [activeTab, fetchTickets, fetchUnassignedTickets]);

  useFocusEffect(
    useCallback(() => {
      markAsViewed();
    }, [markAsViewed])
  );

  const handleClaimTicket = async (ticketId) => {
    setClaimingTicketId(ticketId);
    try {
      await http.post(buildUrl(TICKET_ENDPOINTS.CLAIM, { ticket_id: ticketId }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.support_agent.tickets.ticketClaimed') });
      await fetchAllTickets();
      if (activeTab === 'unassigned') {
        await fetchUnassignedTickets();
      } else {
        await fetchTickets();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail || tUi('ui.pages.support_agent.tickets.failedToClaim'),
      });
    } finally {
      setClaimingTicketId(null);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    setUpdatingStatus(ticketId);
    try {
      await http.patch(buildUrl(TICKET_ENDPOINTS.UPDATE_STATUS, { ticket_id: ticketId }), {
        status: newStatus,
      });
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.support_agent.supportAgentTickets.ticketStatusUpdated_d066e0335b'),
      });
      await fetchAllTickets();
      await fetchTickets();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail || tUi('ui.pages.support_agent.tickets.failedToUpdateStatus'),
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleAddResponse = async (ticketId) => {
    if (!responseMessage.trim()) {
      Toast.show({
        type: 'error',
        text1: tUi('ui.pages.support_agent.supportAgentTickets.pleaseEnterAMessage_1ce84d1798'),
      });
      return;
    }

    setRespondingTicketId(ticketId);
    try {
      await http.post(buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId }), {
        message: responseMessage,
        is_chat: false,
      });
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.support_agent.supportAgentTickets.responseAddedSuccessfully_cc736ef86a'),
      });
      setResponseMessage('');
      await fetchTickets();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail || tUi('ui.pages.support_agent.tickets.failedToAddResponse'),
      });
    } finally {
      setRespondingTicketId(null);
    }
  };

  const handleRequestDelete = async (ticketId) => {
    const confirmed = await confirmAction(
      tUi('ui.pages.support_agent.tickets.deleteTicket'),
      tUi('ui.pages.support_agent.tickets.deleteConfirm'),
      tUi('ui.pages.support_agent.tickets.deleteTicket'),
      tUi('ui.pages.support_agent.supportAgentTickets.cancel_3786084ae4')
    );
    if (!confirmed) return;

    setRequestingDelete(ticketId);
    try {
      await http.post(buildUrl(TICKET_ENDPOINTS.REQUEST_DELETE, { ticket_id: ticketId }));
      Toast.show({ type: 'success', text1: tUi('ui.pages.support_agent.tickets.ticketDeleted') });
      await fetchAllTickets();
      await fetchTickets();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail || tUi('ui.pages.support_agent.tickets.failedToDelete'),
      });
    } finally {
      setRequestingDelete(null);
    }
  };

  const isResolvedOrClosed = (status) => {
    const normalized = normalizeTicketStatus(status);
    return normalized === 'resolved' || normalized === 'closed';
  };

  const currentTickets =
    activeTab === 'assigned'
      ? assignedTickets
      : activeTab === 'completed'
        ? completedTickets
        : unassignedTickets;

  const emptyMessage =
    activeTab === 'assigned'
      ? tUi('ui.pages.support_agent.supportAgentTickets.youDonTHaveAny_178d30ce0d')
      : activeTab === 'completed'
        ? tUi('ui.pages.support_agent.tickets.noCompleted')
        : tUi('ui.pages.support_agent.tickets.noUnassigned');

  const tabs = useMemo(
    () => [
      {
        id: 'assigned',
        label: tUi('ui.pages.support_agent.tickets.tabAssigned'),
        count: assignedTickets.length,
      },
      {
        id: 'unassigned',
        label: tUi('ui.pages.support_agent.tickets.tabUnassigned'),
        count: unassignedTickets.length,
      },
      {
        id: 'completed',
        label: tUi('ui.pages.support_agent.tickets.tabCompleted'),
        count: completedTickets.length,
      },
    ],
    [assignedTickets.length, completedTickets.length, tUi, unassignedTickets.length]
  );

  const tabBar = (
    <View style={styles.tabRow}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          style={[styles.tabChip, activeTab === tab.id && styles.tabChipActive]}
          onPress={() => setActiveTab(tab.id)}
        >
          <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
            {tab.label} ({tab.count})
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.support_agent.tickets.title')}
      subtitle={tUi('ui.pages.support_agent.tickets.subtitle')}
      meta={null}
      action={tabBar}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : currentTickets.length === 0 ? (
        <Text style={[styles.emptyText, { textAlign }]}>{emptyMessage}</Text>
      ) : (
        currentTickets.map((ticket) => {
          const isExpanded = expandedTicketId === ticket.id;
          const publicResponses = ticket.responses?.filter((response) => !response.is_chat) || [];

          return (
            <View key={ticket.id} style={styles.ticketCard}>
              <Pressable
                style={[styles.ticketHeader, { flexDirection: row }]}
                onPress={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
              >
                <TicketUserAvatar user={ticket.customer} size={44} />
                <View style={styles.ticketHeaderBody}>
                  <Text style={[styles.ticketTitle, { textAlign }]} numberOfLines={2}>
                    {ticket.title}
                  </Text>
                  <Text style={[styles.ticketMeta, { textAlign }]} numberOfLines={2}>
                    {formatTicketMeta(ticket)}
                  </Text>
                </View>
                <View style={styles.ticketHeaderEnd}>
                  {activeTab === 'unassigned' ? (
                    <Pressable
                      style={styles.claimButton}
                      onPress={() => handleClaimTicket(ticket.id)}
                      disabled={claimingTicketId === ticket.id}
                    >
                      <Text style={styles.claimButtonText}>
                        {claimingTicketId === ticket.id
                          ? tUi('ui.pages.support_agent.tickets.claiming')
                          : tUi('ui.pages.support_agent.tickets.claimTicket')}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.statusPill}>{getStatusLabel(ticket.status)}</Text>
                  <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.ticketDetail}>
                  <Text style={[styles.detailHeading, { textAlign }]}>
                    {tUi('ui.pages.support_agent.supportAgentTickets.description_97f8368ed2')}
                  </Text>
                  <Text style={[styles.detailText, { textAlign }]}>{ticket.description}</Text>

                  {activeTab !== 'unassigned' ? (
                    <View style={styles.statusSection}>
                      <Text style={[styles.detailHeading, { textAlign }]}>
                        {tUi('ui.pages.support_agent.supportAgentTickets.updateStatus_77aa83ea21')}
                      </Text>
                      <View style={styles.statusRow}>
                        {STATUS_UPDATE_OPTIONS.map((opt) => (
                          <Pressable
                            key={opt.value}
                            style={[
                              styles.statusChip,
                              ticket.status === opt.value && styles.statusChipActive,
                              updatingStatus === ticket.id && styles.statusChipDisabled,
                            ]}
                            onPress={() => handleUpdateStatus(ticket.id, opt.value)}
                            disabled={updatingStatus === ticket.id}
                          >
                            <Text
                              style={[
                                styles.statusChipText,
                                ticket.status === opt.value && styles.statusChipTextActive,
                              ]}
                            >
                              {tUi(opt.labelKey)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {ticket.order_delivery ? (
                    <View style={styles.deliveryBlock}>
                      <Text style={[styles.detailHeading, { textAlign }]}>
                        {tUi('ui.pages.support_agent.supportAgentTickets.deliveryInformation_a9b114e013')}
                      </Text>
                      <Text style={[styles.detailText, { textAlign }]}>
                        {`${tUi('ui.pages.support_agent.supportAgentTickets.status_60e7fc540a')} ${ticket.order_delivery.status?.replace(/_/g, ' ')}`}
                      </Text>
                      {ticket.order_delivery.driver_name ? (
                        <Text style={[styles.detailText, { textAlign }]}>
                          {`${tUi('ui.pages.support_agent.supportAgentTickets.driver_f9c1288fd2')} ${ticket.order_delivery.driver_name}`}
                        </Text>
                      ) : null}
                      {ticket.order_delivery.delivery_address ? (
                        <Text style={[styles.detailText, { textAlign }]}>
                          {`${tUi('ui.pages.support_agent.supportAgentTickets.deliveryAddress_1643a9193e')} ${ticket.order_delivery.delivery_address}`}
                        </Text>
                      ) : null}
                      {ticket.order_delivery.issue_type ? (
                        <View style={styles.issueAlert}>
                          <Text style={styles.issueTitle}>
                            {tUi('ui.pages.support_agent.supportAgentTickets.driverIssue_956e13688e')}
                          </Text>
                          <Text style={styles.detailText}>
                            {ticket.order_delivery.issue_type.replace(/_/g, ' ')}
                          </Text>
                          {ticket.order_delivery.issue_description ? (
                            <Text style={styles.detailText}>{ticket.order_delivery.issue_description}</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <Text style={[styles.detailHeading, { textAlign }]}>
                    {`${tUi('ui.pages.support_agent.supportAgentTickets.responses_a968a5d270')}${publicResponses.length})`}
                  </Text>
                  {publicResponses.length ? (
                    publicResponses.map((response) => (
                      <View key={response.id} style={[styles.responseRow, { flexDirection: row }]}>
                        <TicketUserAvatar user={response.user} size={36} />
                        <View style={styles.responseBody}>
                          <View style={[styles.responseTop, { flexDirection: row }]}>
                            <Text style={styles.responseAuthor}>
                              {`${response.user?.first_name || ''} ${response.user?.last_name || ''}`.trim() ||
                                response.user?.email}
                            </Text>
                            <Text style={styles.responseDate}>{formatDateTime(response.created_at)}</Text>
                          </View>
                          <Text style={[styles.responseMessage, { textAlign }]}>{response.message}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.detailText, { textAlign }]}>
                      {tUi('ui.pages.support_agent.supportAgentTickets.noResponsesYet_53f9543b02')}
                    </Text>
                  )}

                  {!isResolvedOrClosed(ticket.status) && activeTab !== 'unassigned' ? (
                    <View style={styles.responseForm}>
                      <View style={[styles.responseFormHead, { flexDirection: row }]}>
                        <Text style={styles.detailHeading}>
                          {tUi('ui.pages.support_agent.supportAgentTickets.addResponse_b32ceede19')}
                        </Text>
                        <Pressable
                          style={styles.chatButton}
                          onPress={() => setActiveChatTicket({ id: ticket.id, status: ticket.status })}
                        >
                          <Text style={styles.chatButtonText}>
                            {tUi('ui.pages.support_agent.tickets.openLiveChat')}
                          </Text>
                        </Pressable>
                      </View>
                      <TextInput
                        style={[styles.responseInput, inputRtlStyle]}
                        placeholder={tUi(
                          'ui.pages.support_agent.supportAgentTickets.typeYourResponse_d948fd64a0'
                        )}
                        placeholderTextColor={colors.muted}
                        value={responseMessage}
                        onChangeText={setResponseMessage}
                        multiline
                      />
                      <Pressable
                        style={[
                          styles.primaryButton,
                          (respondingTicketId === ticket.id || !responseMessage.trim()) &&
                            styles.primaryButtonDisabled,
                        ]}
                        onPress={() => handleAddResponse(ticket.id)}
                        disabled={respondingTicketId === ticket.id || !responseMessage.trim()}
                      >
                        <Text style={styles.primaryButtonText}>
                          {respondingTicketId === ticket.id
                            ? tUi('ui.pages.support_agent.supportAgentTickets.sending_5850ee6d23')
                            : tUi('ui.pages.support_agent.supportAgentTickets.sendResponse_bc411e0b13')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {activeTab !== 'unassigned' &&
                  !isResolvedOrClosed(ticket.status) &&
                  !ticket.pending_delete ? (
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => handleRequestDelete(ticket.id)}
                      disabled={requestingDelete === ticket.id}
                    >
                      <Text style={styles.deleteButtonText}>
                        {requestingDelete === ticket.id
                          ? tUi('ui.pages.support_agent.tickets.deleting')
                          : tUi('ui.pages.support_agent.tickets.deleteTicket')}
                      </Text>
                    </Pressable>
                  ) : null}

                  {ticket.pending_delete ? (
                    <Text style={styles.pendingDelete}>
                      {tUi(
                        'ui.pages.support_agent.supportAgentTickets.deleteRequestPendingAdminApproval_41491b306c'
                      )}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <SupportTicketChatModal
        visible={!!activeChatTicket}
        onClose={() => setActiveChatTicket(null)}
        ticketId={activeChatTicket?.id}
        ticketStatus={activeChatTicket?.status}
      />
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) =>
  StyleSheet.create({
    tabRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 6,
      maxWidth: 360,
    },
    tabChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    tabChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    tabTextActive: {
      color: '#fff',
    },
    loadingWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      paddingVertical: 20,
    },
    ticketCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: 'hidden',
      ...shadow,
    },
    ticketHeader: {
      alignItems: 'center',
      padding: 14,
      gap: 10,
    },
    ticketHeaderBody: {
      flex: 1,
    },
    ticketHeaderEnd: {
      alignItems: 'flex-end',
      gap: 6,
      maxWidth: 110,
    },
    ticketTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    ticketMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    statusPill: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: isDark ? `${colors.primary}22` : '#EEF2FF',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    expandIcon: {
      fontSize: 12,
      color: colors.muted,
    },
    claimButton: {
      backgroundColor: '#16a34a',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    claimButtonText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    ticketDetail: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 14,
      gap: 10,
    },
    detailHeading: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    detailText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    statusSection: {
      gap: 8,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    statusChipDisabled: {
      opacity: 0.6,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    statusChipTextActive: {
      color: '#fff',
    },
    deliveryBlock: {
      gap: 6,
      padding: 10,
      borderRadius: 12,
      backgroundColor: isDark ? colors.background : '#F8FAFC',
    },
    issueAlert: {
      marginTop: 6,
      padding: 10,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : 'rgba(239,68,68,0.1)',
    },
    issueTitle: {
      fontWeight: '700',
      color: '#dc2626',
      marginBottom: 4,
    },
    responseRow: {
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 8,
    },
    responseBody: {
      flex: 1,
    },
    responseTop: {
      justifyContent: 'space-between',
      alignItems: 'center',
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
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    responseForm: {
      gap: 8,
      marginTop: 4,
    },
    responseFormHead: {
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    chatButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    chatButtonText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    responseInput: {
      minHeight: 80,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#fff',
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
    },
    primaryButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    deleteButton: {
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    deleteButtonText: {
      color: '#dc2626',
      fontWeight: '700',
      fontSize: 13,
    },
    pendingDelete: {
      color: '#d97706',
      fontSize: 12,
      fontWeight: '600',
    },
  });

export default SupportAgentTicketsScreen;
