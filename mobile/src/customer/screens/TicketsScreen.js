import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import SupportTicketChatModal from '../../admin/components/SupportTicketChatModal';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { formatDateTime } from '../../admin/utils/format';
import http from '../../services/http';
import { TICKET_ENDPOINTS } from '../../config/api';

const FAQ_ITEMS = [
  { id: 'shipping', labelKey: 'ui.pages.tickets.faqShipping_v7w8x9y0z1', bodyKey: 'ui.pages.tickets.faqShippingBody_y0z1a2b3c4' },
  { id: 'refunds', labelKey: 'ui.pages.tickets.faqRefunds_w8x9y0z1a2', bodyKey: 'ui.pages.tickets.faqRefundsBody_z1a2b3c4d5' },
  { id: 'account', labelKey: 'ui.pages.tickets.faqAccount_x9y0z1a2b3', bodyKey: 'ui.pages.tickets.faqAccountBody_a2b3c4d5e6' },
];

const TICKET_STATUS_LABEL_KEYS = {
  open: 'ui.pages.tickets.statusOpen_a1b2c3d4e1',
  in_progress: 'ui.pages.tickets.statusInProgress_b2c3d4e5f2',
  resolved: 'ui.pages.tickets.statusResolved_c3d4e5f6a3',
  closed: 'ui.pages.tickets.closed_f259bec343',
};

const TicketsScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl, textAlign, row } = useRtlLayout();
  const inputRtl = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '' });
  const [activeChatTicket, setActiveChatTicket] = useState(null);
  const [openFaqId, setOpenFaqId] = useState(null);

  const hasOpenSlot = !tickets.some((t) => t.status !== 'Closed');

  const getStatusLabel = (status) => {
    const normalized = String(status || 'open').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const key = TICKET_STATUS_LABEL_KEYS[normalized];
    return key ? tUi(key) : status;
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.MY);
      setTickets(response.data || []);
    } catch (_) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.tickets.failedToFetchTickets_550b44f85c') });
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [tUi]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreate = async () => {
    if (!hasOpenSlot) {
      Toast.show({ type: 'info', text1: tUi('ui.pages.tickets.cannotCreateUntilClosed_a1b2c3d4e6') });
      return;
    }
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.tickets.pleaseFillInAllFields_4471417b8d') });
      return;
    }
    setCreating(true);
    try {
      await http.post(TICKET_ENDPOINTS.CREATE, newTicket);
      Toast.show({ type: 'success', text1: tUi('ui.pages.tickets.ticketCreatedSuccessfully_160b1ad7b1') });
      setNewTicket({ title: '', description: '' });
      setShowCreate(false);
      fetchTickets();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.response?.data?.detail || 'Failed to create ticket' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <CustomerScreen
      showBack
      title={tUi('ui.mobile.customer.account.tickets')}
      subtitle={tUi('ui.pages.tickets.subtitle_b4e8c2d3e0') || 'Get help from our support team'}
      action={
        hasOpenSlot ? (
          <Pressable onPress={() => setShowCreate((v) => !v)}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {showCreate ? tUi('ui.pages.recommendations.cancel_5a0d97a8e1') : tUi('ui.pages.tickets.createTicket_b4e8c2d3e1') || 'New ticket'}
            </Text>
          </Pressable>
        ) : null
      }
    >
      {showCreate ? (
        <View style={[styles.formBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.input, inputRtl, { borderColor: colors.border, color: colors.text }]}
            placeholder={tUi('ui.pages.tickets.title_b4e8c2d3e2') || 'Title'}
            placeholderTextColor={colors.muted}
            value={newTicket.title}
            onChangeText={(v) => setNewTicket((p) => ({ ...p, title: v }))}
          />
          <TextInput
            style={[styles.input, styles.textArea, inputRtl, { borderColor: colors.border, color: colors.text }]}
            placeholder={tUi('ui.pages.tickets.description_b4e8c2d3e3') || 'Description'}
            placeholderTextColor={colors.muted}
            value={newTicket.description}
            onChangeText={(v) => setNewTicket((p) => ({ ...p, description: v }))}
            multiline
          />
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={styles.primaryBtnText}>
              {creating ? tUi('ui.pages.installments.submitting_3eccdd056d') : tUi('ui.pages.tickets.submitTicket_b4e8c2d3e4') || 'Submit'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.faqTitle, { color: colors.text, textAlign }]}>FAQ</Text>
      {FAQ_ITEMS.map((item) => (
        <View key={item.id} style={[styles.faqItem, { borderColor: colors.border }]}>
          <Pressable onPress={() => setOpenFaqId(openFaqId === item.id ? null : item.id)}>
            <View style={[styles.faqHeader, { flexDirection: row }]}>
              <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{tUi(item.labelKey)}</Text>
              <Feather name={openFaqId === item.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </View>
          </Pressable>
          {openFaqId === item.id ? (
            <Text style={{ color: colors.muted, marginTop: 8, textAlign }}>{tUi(item.bodyKey)}</Text>
          ) : null}
        </View>
      ))}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : tickets.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign, marginTop: 16 }}>—</Text>
      ) : (
        tickets.map((ticket) => (
          <View
            key={ticket.id}
            style={[styles.ticketCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>{ticket.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {getStatusLabel(ticket.status)} · {formatDateTime(ticket.created_at)}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8 }} numberOfLines={3}>
              {ticket.description}
            </Text>
            <Pressable
              style={[styles.chatBtn, { borderColor: colors.border }]}
              onPress={() => setActiveChatTicket({ id: ticket.id, status: ticket.status })}
            >
              <Feather name="message-circle" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600' }}>{tUi('ui.pages.tickets.openChat_b4e8c2d3e5') || 'Open chat'}</Text>
            </Pressable>
          </View>
        ))
      )}

      <SupportTicketChatModal
        visible={Boolean(activeChatTicket)}
        ticketId={activeChatTicket?.id}
        ticketStatus={activeChatTicket?.status}
        onClose={() => setActiveChatTicket(null)}
      />
    </CustomerScreen>
  );
};

const createStyles = ({ shadow }) =>
  StyleSheet.create({
    formBox: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16, gap: 10, ...shadow },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    primaryBtn: { borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
    primaryBtnText: { color: '#fff', fontWeight: '700' },
    faqTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 8 },
    faqItem: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
    faqHeader: { alignItems: 'center' },
    ticketCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12, ...shadow },
    chatBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignSelf: 'flex-start',
    },
  });

export default TicketsScreen;
