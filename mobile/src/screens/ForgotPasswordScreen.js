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

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter your email address' });
      return;
    }

    setLoading(true);
    try {
      await http.post(AUTH_ENDPOINTS.FORGOT_PASSWORD, { email: email.trim() });
      Toast.show({ type: 'success', text1: 'Reset code sent to your email' });
      navigation.navigate('VerifyResetCode', { email: email.trim() });
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed to send reset code' });
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
        <Ionicons name="lock-closed-outline" size={64} color={PRIMARY} style={styles.icon} />
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we'll send you a code to reset your password.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Send Reset Code</Text>
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
  input: { height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#1E293B', backgroundColor: '#fff', marginBottom: 24 },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ForgotPasswordScreen;
