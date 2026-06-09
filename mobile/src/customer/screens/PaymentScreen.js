import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import CustomerScreen from '../components/CustomerScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { useCurrency } from '../../hooks/useCurrency';
import http from '../../services/http';
import {
  INSTALLMENT_ENDPOINTS,
  PAYMENT_ENDPOINTS,
  buildUrl,
} from '../../config/api';
import { STRIPE_PUBLISHABLE_KEY } from '../../config/stripe';

const PaymentScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { textAlign } = useRtlLayout();
  const { formatCurrency } = useCurrency();

  const amount = Number(route.params?.amount) || 0;
  const orderId = route.params?.orderId;
  const installmentRequestId = route.params?.installmentRequestId;
  const installmentScheduleId = route.params?.installmentScheduleId;

  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [webHtml, setWebHtml] = useState(null);

  const hasStripeKey = Boolean(STRIPE_PUBLISHABLE_KEY?.trim());

  const confirmBackend = useCallback(async () => {
    if (installmentRequestId && installmentScheduleId) {
      await http.patch(
        buildUrl(INSTALLMENT_ENDPOINTS.MY_MARK_PAID, {
          request_id: installmentRequestId,
          schedule_id: installmentScheduleId,
        }),
        { payment_intent_id: paymentIntentId }
      );
    } else if (installmentRequestId) {
      await http.patch(
        buildUrl(INSTALLMENT_ENDPOINTS.MY_PAY_REMAINING, { request_id: installmentRequestId }),
        { payment_intent_id: paymentIntentId }
      );
    } else if (orderId) {
      await http.post(PAYMENT_ENDPOINTS.CONFIRM, {
        payment_intent_id: paymentIntentId,
        order_id: orderId,
      });
    }
  }, [installmentRequestId, installmentScheduleId, orderId, paymentIntentId]);

  const handleSuccess = useCallback(async () => {
    try {
      await confirmBackend();
      Toast.show({ type: 'success', text1: tUi('ui.pages.payment.paymentSuccessful_09bbd8bc49') });
      navigation.navigate('Orders');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.toast.operationFailed'),
      });
    }
  }, [confirmBackend, navigation, tUi]);

  const buildStripeHtml = useCallback((secret, publishableKey, labels, themeColors) => {
    return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://js.stripe.com/v3/"></script>
<style>body{font-family:sans-serif;padding:16px;background:${themeColors.background};color:${themeColors.text};}#card{border:1px solid ${themeColors.border};padding:12px;border-radius:12px;margin:12px 0;background:${themeColors.surface};}
button{width:100%;padding:14px;border:none;border-radius:999px;background:#2563eb;color:#fff;font-weight:700;font-size:16px;}
#error{color:#dc2626;margin-top:8px;}</style></head><body>
<h3>${labels.title}</h3>
<div id="card"></div>
<div id="error"></div>
<button id="pay">${labels.payNow}</button>
<script>
const stripe = Stripe('${publishableKey}');
const elements = stripe.elements();
const card = elements.create('card');
card.mount('#card');
document.getElementById('pay').onclick = async () => {
  document.getElementById('error').textContent = '';
  const {error, paymentIntent} = await stripe.confirmCardPayment('${secret}', {payment_method: {card}});
  if (error) {
    document.getElementById('error').textContent = error.message;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message: error.message}));
  } else if (paymentIntent && paymentIntent.status === 'succeeded') {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'success', id: paymentIntent.id}));
  }
};
</script></body></html>`;
  }, []);

  const initPayment = useCallback(async () => {
    if (!orderId && !installmentRequestId) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.payment.noOrderInformationFound_561393a6aa') });
      return;
    }
    if (!hasStripeKey) return;

    setLoading(true);
    try {
      const response = await http.post(PAYMENT_ENDPOINTS.CREATE_INTENT, {
        amount,
        order_id: orderId,
        installment_request_id: installmentRequestId,
        installment_schedule_id: installmentScheduleId,
        currency: 'usd',
      });
      const secret = response.data?.client_secret;
      const intentId = response.data?.payment_intent_id;
      setClientSecret(secret);
      setPaymentIntentId(intentId);
      if (secret) {
        setWebHtml(
          buildStripeHtml(
            secret,
            STRIPE_PUBLISHABLE_KEY,
            {
              title: tUi('ui.pages.payment.cardDetails_39aedd6f29'),
              payNow: tUi('ui.pages.payment.payValue_ac81d68b1e', { value0: formatCurrency(amount) }),
            },
            {
              background: colors.background,
              surface: colors.surface,
              border: colors.border,
              text: colors.text,
            }
          )
        );
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          error.message ||
          tUi('ui.pages.payment.failedToInitializePaymentPlease_8874227d62'),
      });
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    buildStripeHtml,
    colors.background,
    colors.border,
    colors.surface,
    colors.text,
    formatCurrency,
    hasStripeKey,
    installmentRequestId,
    installmentScheduleId,
    orderId,
    tUi,
  ]);

  useEffect(() => {
    if (hasStripeKey) initPayment();
  }, [hasStripeKey, initPayment]);

  const onWebMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success') {
        if (data.id) setPaymentIntentId(data.id);
        await handleSuccess();
      }
    } catch (_) {}
  };

  if (!orderId && !installmentRequestId) {
    return (
      <CustomerScreen showBack title={tUi('ui.pages.payment.payment_2fd70791db')}>
        <Text style={{ color: colors.muted, textAlign }}>{tUi('ui.pages.payment.noOrderInformationFound_561393a6aa')}</Text>
      </CustomerScreen>
    );
  }

  return (
    <CustomerScreen showBack title={tUi('ui.pages.payment.payment_2fd70791db')} subtitle={tUi('ui.pages.payment.paymentInformation_080893f7ef')}>
      <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: colors.text, textAlign }]}>{tUi('ui.pages.payment.orderSummary_2732d1541f')}</Text>
        {orderId ? (
          <Text style={{ color: colors.muted }}>{tUi('ui.pages.payment.orderId_d8d11f83b9')} {orderId}</Text>
        ) : null}
        {installmentRequestId ? (
          <Text style={{ color: colors.muted }}>
            {tUi('ui.pages.payment.installmentRequest_cb14601df2')} {installmentRequestId}
          </Text>
        ) : null}
        <Text style={[styles.amount, { color: colors.primary, textAlign }]}>
          {tUi('ui.pages.payment.totalAmount_6d8825a3cb')} {formatCurrency(amount)}
        </Text>
      </View>

      {!hasStripeKey ? (
        <View style={[styles.placeholder, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8, textAlign }}>
            {tUi('ui.pages.payment.loadingSecurePaymentGateway_384a1c4eb7')}
          </Text>
          <Text style={{ color: colors.muted, textAlign, lineHeight: 20 }}>
            {tUi('ui.pages.payment.stripeKeyHint_b4e8c2d3f5')}
          </Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : webHtml && clientSecret ? (
        <View style={styles.webviewWrap}>
          <Text style={[styles.cardLabel, { color: colors.text }]}>{tUi('ui.pages.payment.cardDetails_39aedd6f29')}</Text>
          <WebView
            originWhitelist={['*']}
            source={{ html: webHtml }}
            onMessage={onWebMessage}
            style={styles.webview}
            javaScriptEnabled
          />
        </View>
      ) : (
        <Pressable style={[styles.retryBtn, { borderColor: colors.border }]} onPress={initPayment}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{tUi('ui.pages.payment.retryLoadingStripe_1afbfaf06c')}</Text>
        </Pressable>
      )}
    </CustomerScreen>
  );
};

const createStyles = () =>
  StyleSheet.create({
    summary: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16, gap: 6 },
    summaryTitle: { fontSize: 17, fontWeight: '700' },
    amount: { fontSize: 20, fontWeight: '700', marginTop: 8 },
    placeholder: { borderWidth: 1, borderRadius: 16, padding: 20 },
    webviewWrap: { height: 280, borderRadius: 12, overflow: 'hidden', marginBottom: 24 },
    webview: { flex: 1, minHeight: 260 },
    cardLabel: { fontWeight: '600', marginBottom: 8 },
    retryBtn: { borderWidth: 1, borderRadius: 999, padding: 14, alignItems: 'center' },
  });

export default PaymentScreen;
