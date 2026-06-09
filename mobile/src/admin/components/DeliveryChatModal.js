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
import { DELIVERY_ENDPOINTS, buildUrl } from '../../config/api';
import { buildWebSocketUrl } from '../utils/websocket';
import { formatDateTime } from '../utils/format';

const sortMessages = (messages) =>
  [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

const DeliveryChatModal = ({ visible, onClose, jobId }) => {
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

  const isOwnMessage = useCallback(
    (msg) => String(msg?.sender_id) === String(user?.id),
    [user?.id]
  );

  const upsertMessage = useCallback((prev, incoming) => {
    if (!incoming?.message) return prev;

    const incomingId = incoming.id != null ? String(incoming.id) : null;
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
      return !(m.id == null && m.message?.trim() === incoming.message.trim());
    });

    if (incomingId) knownIdsRef.current.add(incomingId);
    return sortMessages([...filtered, incoming]);
  }, []);

  useEffect(() => {
    if (!visible || !jobId) return undefined;

    let isMounted = true;
    knownIdsRef.current = new Set();
    setMessages([]);
    setInputMessage('');

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await http.get(buildUrl(DELIVERY_ENDPOINTS.GET_CHAT, { job_id: jobId }));
        if (isMounted) {
          const history = Array.isArray(response.data) ? response.data : [];
          history.forEach((m) => {
            if (m.id != null) knownIdsRef.current.add(String(m.id));
          });
          setMessages(sortMessages(history));
        }
      } catch (_) {
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const connectWebSocket = async () => {
      try {
        const ticketResponse = await http.post(
          buildUrl(DELIVERY_ENDPOINTS.CHAT_TICKET, { job_id: jobId })
        );
        const wsAuthToken = ticketResponse?.data?.ws_chat_token;
        if (!isMounted || !wsAuthToken) return;

        const wsUrl = buildWebSocketUrl(buildUrl(DELIVERY_ENDPOINTS.WS_CHAT, { job_id: jobId }), {
          token: wsAuthToken,
        });

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!isMounted) return;
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
  }, [jobId, upsertMessage, visible]);

  useEffect(() => {
    if (messages.length && visible) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, visible]);

  const getSenderLabel = (msg) => {
    if (isOwnMessage(msg)) {
      return tUi('ui.pages.driver.driverActiveJob.user_472cb0a9b5');
    }
    return msg.sender_name || tUi('ui.pages.driver.driverActiveJob.chatWithCustomer_f2dc21eb4f');
  };

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isSending || !jobId) return;

    setIsSending(true);
    setInputMessage('');

    try {
      const response = await http.post(buildUrl(DELIVERY_ENDPOINTS.SEND_CHAT, { job_id: jobId }), {
        message: text,
      });
      setMessages((prev) => upsertMessage(prev, response.data));
    } catch (error) {
      setInputMessage(text);
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.components.supportTicketChatModal.sendFailed_c3d4e5f6a7'),
      });
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item: msg }) => {
    const isMe = isOwnMessage(msg);
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
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
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { textAlign }]}>
            {tUi('ui.pages.driver.driverActiveJob.chatWithCustomer_f2dc21eb4f')}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, index) => String(item.id ?? `msg-${index}`)}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { textAlign }]}>
                {tUi('ui.pages.driver.driverActiveJob.noMessagesYet_5dc9c8c5d1')}
              </Text>
            }
          />
        )}

        <View style={[styles.inputRow, { flexDirection: row }]}>
          <TextInput
            style={[styles.input, inputRtlStyle]}
            placeholder={tUi('ui.pages.driver.driverActiveJob.writeAMessageToAdmin_a96d3938ba')}
            placeholderTextColor={colors.muted}
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, (!inputMessage.trim() || isSending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputMessage.trim() || isSending}
          >
            <Feather name="send" size={18} color="#fff" />
          </Pressable>
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
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    closeBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: 16,
      flexGrow: 1,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      paddingVertical: 24,
    },
    messageRow: {
      marginBottom: 12,
    },
    messageRowMe: {
      alignItems: 'flex-end',
    },
    messageRowOther: {
      alignItems: 'flex-start',
    },
    messageBubble: {
      maxWidth: '85%',
      borderRadius: 16,
      padding: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageBubbleMe: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    messageSender: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      marginBottom: 4,
    },
    messageSenderMe: {
      color: isDark ? '#dbeafe' : '#eff6ff',
    },
    messageText: {
      fontSize: 14,
      color: colors.text,
    },
    messageTextMe: {
      color: '#fff',
    },
    messageTime: {
      marginTop: 6,
      fontSize: 10,
      color: colors.muted,
    },
    messageTimeMe: {
      color: isDark ? '#dbeafe' : '#eff6ff',
    },
    inputRow: {
      alignItems: 'flex-end',
      gap: 8,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    sendBtnDisabled: {
      opacity: 0.5,
    },
  });

export default DeliveryChatModal;
