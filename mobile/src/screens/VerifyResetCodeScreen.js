import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import http from '../services/http';
import { AUTH_ENDPOINTS } from '../config/api';

const PRIMARY = '#2563EB';

const VerifyResetCodeScreen = ({ route, navigation }) => {
  const { email } = route.params || { email: '' };
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter the reset code' });
      return;
    }

    setLoading(true);
    try {
      await http.post(AUTH_ENDPOINTS.VERIFY_RESET_CODE, { email, reset_code: code.trim() });
      Toast.show({ type: 'success', text1: 'Code verified successfully' });
      navigation.navigate('ResetPassword', { email, resetCode: code.trim() });
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Invalid or expired code' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1E293B" />
      </Pressable>
      
      <View style={styles.content}>
        <Ionicons name="mail-unread-outline" size={64} color={PRIMARY} style={styles.icon} />
        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a reset code to <Text style={{ fontWeight: '700', color: '#1E293B' }}>{email}</Text>. Enter it below to continue.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter 6-digit code"
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />

        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Verify Code</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  icon: { alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  input: { height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontSize: 20, letterSpacing: 2, color: '#1E293B', backgroundColor: '#fff', marginBottom: 24, textAlign: 'center' },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default VerifyResetCodeScreen;
