import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import CustomerScreen from '../components/CustomerScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useLanguage } from '../../context/LanguageContext';
import { useTUi } from '../../i18n/uiText';
import { useCurrency } from '../../hooks/useCurrency';
import { localizeProduct } from '../../utils/localizedContent';
import { buildImageUrl } from '../../admin/utils/format';
import http from '../../services/http';
import { AI_ASSISTANT_ENDPOINTS } from '../../config/api';

const createSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const AiAssistantScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { isRtl, textAlign, row, writingDirection } = useRtlLayout();
  const inputRtl = { textAlign, writingDirection };

  const [sessionId, setSessionId] = useState(createSessionId);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef(null);

  const welcomeMessage = useMemo(() => tUi('chat.welcomeMessage'), [tUi, language]);

  useEffect(() => {
    setMessages([{ role: 'assistant', content: welcomeMessage, products: [] }]);
  }, [welcomeMessage]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, isLoading, scrollToEnd]);

  const sendMessage = async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading) return;

    setInputMessage('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, products: [] }]);
    setIsLoading(true);

    try {
      const { data } = await http.post(AI_ASSISTANT_ENDPOINTS.CHAT, {
        message: trimmed,
        session_id: sessionId,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data?.message || '',
          products: data?.products || [],
        },
      ]);
    } catch (_) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: tUi('chat.errorMessage'), products: [] },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await http.post(AI_ASSISTANT_ENDPOINTS.CLEAR, { session_id: sessionId });
    } catch (_) {
      /* still reset local state */
    }
    const nextSession = createSessionId();
    setSessionId(nextSession);
    setMessages([{ role: 'assistant', content: tUi('chat.clearedMessage'), products: [] }]);
  };

  const openProduct = (product) => {
    if (!product?.name) return;
    navigation.navigate('ProductDetails', { productName: product.name });
  };

  const renderProduct = (product) => {
    const localized = localizeProduct(product, language);
    const imageUri = buildImageUrl(product?.images?.[0]);
    const price = product.discount_enabled ? product.discounted_price : product.price;

    return (
      <Pressable
        key={product.id || product.name}
        style={[styles.productCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
        onPress={() => openProduct(product)}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder, { backgroundColor: colors.background }]}>
            <Feather name="image" size={20} color={colors.muted} />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text, textAlign }]} numberOfLines={2}>
            {localized.localized_name}
          </Text>
          <Text style={[styles.productPrice, { color: colors.primary }]}>{formatCurrency(price)}</Text>
          {localized.localized_category_name ? (
            <Text style={[styles.productCategory, { color: colors.muted, textAlign }]} numberOfLines={1}>
              {localized.localized_category_name}
            </Text>
          ) : null}
        </View>
        <Feather name={isRtl ? 'chevron-left' : 'chevron-right'} size={18} color={colors.muted} />
      </Pressable>
    );
  };

  const renderMessage = ({ item: msg }) => {
    const isUser = msg.role === 'user';
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
          { flexDirection: row },
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary, alignSelf: isRtl ? 'flex-start' : 'flex-end' }
              : { backgroundColor: colors.surface, borderColor: colors.border, alignSelf: isRtl ? 'flex-end' : 'flex-start' },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isUser ? '#fff' : colors.text, textAlign },
            ]}
          >
            {msg.content}
          </Text>
          {msg.products?.length > 0 ? (
            <View style={styles.productsBlock}>
              <Text style={[styles.productsTitle, { color: colors.text, textAlign }]}>
                {tUi('chat.recommendedProducts')}
              </Text>
              {msg.products.map((product) => renderProduct(product))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const clearButton = (
    <Pressable
      style={[styles.clearBtn, { flexDirection: row, borderColor: colors.border, backgroundColor: colors.surface }]}
      onPress={clearChat}
      accessibilityLabel={tUi('chat.clearTitle')}
    >
      <Feather name="trash-2" size={16} color={colors.muted} />
      <Text style={[styles.clearBtnText, { color: colors.muted }]}>{tUi('chat.clearTitle')}</Text>
    </Pressable>
  );

  return (
    <CustomerScreen
      scroll={false}
      showBack
      kicker={tUi('ui.mobile.customer.storeKicker')}
      title={tUi('chat.title')}
      subtitle={tUi('chat.welcomeMessage')}
      action={clearButton}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          renderItem={renderMessage}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={
            isLoading ? (
              <View style={[styles.loadingRow, { flexDirection: row }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.muted }]}>...</Text>
              </View>
            ) : null
          }
        />

        <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            style={[
              styles.input,
              inputRtl,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
            placeholder={tUi('chat.inputPlaceholder')}
            placeholderTextColor={colors.muted}
            value={inputMessage}
            onChangeText={setInputMessage}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            editable={!isLoading}
            multiline
          />
          <Pressable
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (isLoading || !inputMessage.trim()) && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
          >
            <Feather name="send" size={18} color="#fff" style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </CustomerScreen>
  );
};

const createStyles = ({ shadow }) =>
  StyleSheet.create({
    flex: { flex: 1 },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    clearBtnText: { fontSize: 12, fontWeight: '600' },
    list: { flex: 1 },
    listContent: { paddingVertical: 8, gap: 10 },
    messageRow: { marginBottom: 4 },
    messageRowUser: { justifyContent: 'flex-end' },
    messageRowAssistant: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '88%',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: 'transparent',
      ...shadow,
    },
    bubbleText: { fontSize: 15, lineHeight: 22 },
    productsBlock: { marginTop: 10, gap: 8 },
    productsTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
    productCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderRadius: 12,
      padding: 8,
    },
    productImage: {
      width: 52,
      height: 52,
      borderRadius: 10,
    },
    productImagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    productInfo: { flex: 1 },
    productName: { fontSize: 13, fontWeight: '700' },
    productPrice: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    productCategory: { fontSize: 11, marginTop: 2 },
    loadingRow: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    loadingText: { fontSize: 13 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 100,
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
  });

export default AiAssistantScreen;
