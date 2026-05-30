import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import http from '../../services/http';
import { TICKET_ENDPOINTS, buildUrl } from '../../config/api';
import { buildWebSocketUrl } from '../utils/websocket';
import { formatDateTime } from '../utils/format';
import TicketUserAvatar from './TicketUserAvatar';

const normalizeStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const sortMessages = (messages) =>
  [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

const SupportTicketChatModal = ({ visible, onClose, ticketId, ticketStatus }) => {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { isRtl, textAlign, row } = useRtlLayout();
  const inputRtlStyle = { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' };

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const wsRef = useRef(null);
  const knownIdsRef = useRef(new Set());
  const listRef = useRef(null);

  const getMessageUserId = (msg) => msg?.user?.id ?? msg?.user_id;

  const isOwnMessage = useCallback(
    (msg) => String(getMessageUserId(msg)) === String(user?.id),
    [user?.id]
  );

  const upsertMessage = useCallback((prev, incoming) => {
    if (!incoming?.message) return prev;

    const incomingId = incoming.id != null ? String(incoming.id) : null;
    const incomingText = incoming.message.trim();

    if (incomingId && knownIdsRef.current.has(incomingId)) {
      const existingIdx = prev.findIndex((m) => String(m.id) === incomingId);
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...incoming };
        return sortMessages(next);
      }
    }

    const filtered = prev.filter((m) => {
      if (incomingId && m.id != null && String(m.id) === incomingId) return false;
      if (m.id == null && m.message?.trim() === incomingText) {
        return String(m.user?.id) !== String(incoming.user?.id);
      }
      return true;
    });

    if (incomingId && filtered.some((m) => String(m.id) === incomingId)) {
      return sortMessages(filtered);
    }

    if (incomingId) knownIdsRef.current.add(incomingId);

    return sortMessages([...filtered, incoming]);
  }, []);

  useEffect(() => {
    if (!visible || !ticketId) return undefined;

    let isMounted = true;
    knownIdsRef.current = new Set();
    setMessages([]);
    setInputMessage('');

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await http.get(buildUrl(TICKET_ENDPOINTS.BY_ID, { ticket_id: ticketId }));
        if (isMounted) {
          const chatMessages = (response.data.responses || []).filter((m) => m.is_chat);
          chatMessages.forEach((m) => {
            if (m.id != null) knownIdsRef.current.add(String(m.id));
          });
          setMessages(sortMessages(chatMessages));
        }
      } catch (_) {
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const connectWebSocket = async () => {
      try {
        const ticketTokenResponse = await http.post(
          buildUrl(TICKET_ENDPOINTS.CHAT_TICKET, { ticket_id: ticketId })
        );
        const wsAuthToken = ticketTokenResponse?.data?.ws_chat_token;
        if (!isMounted || !wsAuthToken) return;

        const wsUrl = buildWebSocketUrl(buildUrl(TICKET_ENDPOINTS.WS_CHAT, { ticket_id: ticketId }), {
          token: wsAuthToken,
        });

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!isMounted || !data.is_chat) return;
            setMessages((prev) => upsertMessage(prev, data));
          } catch (_) {}
        };
      } catch (_) {}
    };

    fetchHistory();
    connectWebSocket();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [ticketId, upsertMessage, visible]);

  useEffect(() => {
    if (messages.length && visible) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, visible]);

  const getSenderLabel = (msg) => {
    if (isOwnMessage(msg)) {
      return tUi('ui.components.supportTicketChatModal.you_a1b2c3d4e5');
    }
    const name = `${msg.user?.first_name || ''} ${msg.user?.last_name || ''}`.trim();
    return name || msg.user?.email || tUi('ui.components.supportTicketChatModal.supportAgent_b2c3d4e5f6');
  };

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isSending || !ticketId) return;

    setIsSending(true);
    setInputMessage('');

    try {
      const response = await http.post(buildUrl(TICKET_ENDPOINTS.ADD_RESPONSE, { ticket_id: ticketId }), {
        message: text,
        is_chat: true,
      });

      const confirmed = {
        id: response.data.id,
        message: response.data.message,
        created_at: response.data.created_at,
        is_chat: true,
        user: response.data.user || {
          id: user?.id,
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
        },
      };

      setMessages((prev) => upsertMessage(prev, confirmed));
    } catch (error) {
      setInputMessage(text);
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || tUi('ui.components.supportTicketChatModal.sendFailed_c3d4e5f6a7'),
      });
    } finally {
      setIsSending(false);
    }
  };

  const chatDisabled = ['resolved', 'closed'].includes(normalizeStatus(ticketStatus));

  const renderMessage = ({ item: msg }) => {
    const isMe = isOwnMessage(msg);
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
        {!isMe ? <TicketUserAvatar user={msg.user} size={32} /> : null}
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          <Text style={[styles.messageSender, isMe && styles.messageSenderMe]}>{getSenderLabel(msg)}</Text>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{msg.message}</Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {formatDateTime(msg.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={[styles.header, { flexDirection: row }]}>
          <Text style={[styles.headerTitle, { textAlign }]}>
            {tUi('ui.components.supportTicketChatModal.title_d4e5f6a7b8')}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={tUi('ui.components.supportTicketChatModal.close_e5f6a7b8c9')}>
            <Feather name="x" size={22} color={colors.text} />
          </Pressable>
        </View>

        {isLoading && !messages.length ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {tUi('ui.components.supportTicketChatModal.loading_f6a7b8c9d0')}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, index) =>
              item.id != null ? `msg-${item.id}` : `pending-${index}-${item.created_at}`
            }
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {tUi('ui.components.supportTicketChatModal.empty_a7b8c9d0e1')}
              </Text>
            }
          />
        )}

        <View style={styles.inputBar}>
          {chatDisabled ? (
            <Text style={styles.disabledText}>
              {tUi('ui.components.supportTicketChatModal.disabled_b8c9d0e1f2', { status: ticketStatus })}
            </Text>
          ) : (
            <View style={[styles.inputRow, { flexDirection: row }]}>
              <TextInput
                style={[styles.input, inputRtlStyle]}
                placeholder={tUi('ui.components.supportTicketChatModal.placeholder_c9d0e1f2a3')}
                placeholderTextColor={colors.muted}
                value={inputMessage}
                onChangeText={setInputMessage}
                editable={!isSending}
                multiline
              />
              <Pressable
                style={[styles.sendButton, (!inputMessage.trim() || isSending) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputMessage.trim() || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = ({ colors, isDark }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 56 : 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: colors.muted,
      fontSize: 14,
    },
    messagesContent: {
      padding: 16,
      paddingBottom: 24,
      flexGrow: 1,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.muted,
      marginTop: 40,
      fontSize: 14,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 12,
      gap: 8,
    },
    messageRowMe: {
      justifyContent: 'flex-end',
    },
    messageRowOther: {
      justifyContent: 'flex-start',
    },
    messageBubble: {
      maxWidth: '78%',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageBubbleMe: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    messageBubbleOther: {},
    messageSender: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      marginBottom: 4,
    },
    messageSenderMe: {
      color: 'rgba(255,255,255,0.85)',
    },
    messageText: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 20,
    },
    messageTextMe: {
      color: '#fff',
    },
    messageTime: {
      marginTop: 4,
      fontSize: 10,
      color: colors.muted,
    },
    messageTimeMe: {
      color: 'rgba(255,255,255,0.75)',
    },
    inputBar: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    },
    inputRow: {
      alignItems: 'flex-end',
      gap: 8,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 100,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.background : '#fff',
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    disabledText: {
      textAlign: 'center',
      color: colors.muted,
      fontSize: 13,
      paddingVertical: 8,
    },
  });

export default SupportTicketChatModal;
