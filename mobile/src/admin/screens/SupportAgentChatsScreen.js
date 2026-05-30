import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdminScreen from '../components/AdminScreen';
import SupportTicketChatModal from '../components/SupportTicketChatModal';
import TicketUserAvatar from '../components/TicketUserAvatar';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { TICKET_ENDPOINTS } from '../../config/api';
import { formatDate } from '../utils/format';
import { usePanelRole } from '../hooks/usePanelRole';

const SupportAgentChatsScreen = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { textAlign, row, isRtl } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(TICKET_ENDPOINTS.CHAT_LIST);
      setChats(response.data || []);
    } catch (_) {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const filteredChats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return chats;
    return chats.filter(
      (chat) =>
        `${chat.first_name} ${chat.last_name}`.toLowerCase().includes(term) ||
        chat.email.toLowerCase().includes(term)
    );
  }, [chats, searchTerm]);

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.pages.support_agent.chats.title')}
      subtitle={tUi('ui.pages.support_agent.chats.subtitle')}
    >
      <View style={[styles.searchWrap, { flexDirection: row }]}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, inputRtlStyle]}
          placeholder={tUi('ui.pages.support_agent.chats.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredChats.length ? (
        filteredChats.map((chat) => (
          <Pressable
            key={chat.id}
            style={[styles.chatItem, { flexDirection: row }]}
            onPress={() => setSelectedTicketId(chat.active_ticket_id)}
          >
            <TicketUserAvatar
              user={{
                first_name: chat.first_name,
                last_name: chat.last_name,
                email: chat.email,
                profile_image: chat.profile_image,
              }}
              size={48}
            />
            <View style={styles.chatBody}>
              <View style={[styles.chatTop, { flexDirection: row }]}>
                <Text style={[styles.chatName, { textAlign }]} numberOfLines={1}>
                  {`${chat.first_name} ${chat.last_name}`.trim()}
                </Text>
                <Text style={styles.chatTime}>{formatDate(chat.last_updated)}</Text>
              </View>
              <Text style={[styles.chatPreview, { textAlign }]} numberOfLines={2}>
                {chat.last_message}
              </Text>
            </View>
            <Feather name="message-circle" size={20} color={colors.primary} />
          </Pressable>
        ))
      ) : (
        <View style={styles.emptyWrap}>
          <Feather name="message-circle" size={32} color={colors.muted} />
          <Text style={[styles.emptyText, { textAlign }]}>{tUi('ui.pages.support_agent.chats.empty')}</Text>
        </View>
      )}

      <SupportTicketChatModal
        visible={!!selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        ticketId={selectedTicketId}
      />
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    searchWrap: {
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      height: 44,
      color: colors.text,
      fontSize: 14,
    },
    loadingWrap: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    chatItem: {
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      ...shadow,
    },
    chatBody: {
      flex: 1,
    },
    chatTop: {
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
      gap: 8,
    },
    chatName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    chatTime: {
      fontSize: 11,
      color: colors.muted,
    },
    chatPreview: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 12,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
    },
  });

export default SupportAgentChatsScreen;
