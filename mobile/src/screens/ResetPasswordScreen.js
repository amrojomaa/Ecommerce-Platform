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

const ResetPasswordScreen = ({ route, navigation }) => {
  const { email, resetCode } = route.params || { email: '', resetCode: '' };
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Toast.show({ type: 'error', text1: 'Please fill in all fields' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      await http.post(AUTH_ENDPOINTS.RESET_PASSWORD, {
        email,
        reset_code: resetCode,
        new_password: newPassword
      });
      Toast.show({ type: 'success', text1: 'Password reset successful!' });
      
      // Navigate to Login after a short delay
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1500);
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed to reset password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => navigation.navigate('Login')}>
        <Ionicons name="close" size={24} color="#1E293B" />
      </Pressable>
      
      <View style={styles.content}>
        <Ionicons name="key-outline" size={64} color={PRIMARY} style={styles.icon} />
        <Text style={styles.title}>Create New Password</Text>
        <Text style={styles.subtitle}>
          Your new password must be different from previous used passwords.
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
          </Pressable>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Reset Password</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  backBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  icon: { alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#fff', marginBottom: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#1E293B' },
  eyeIcon: { padding: 4 },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', elevation: 2, marginTop: 12 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ResetPasswordScreen;
