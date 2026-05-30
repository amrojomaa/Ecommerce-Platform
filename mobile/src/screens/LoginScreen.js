import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { tUi } from '../i18n/uiText';

const LoginScreen = ({ navigation }) => {
  const { login, loginWithGoogle } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = useCallback(
    async (accessToken) => {
      const result = await loginWithGoogle(accessToken);
      if (result?.success) {
        Toast.show({ type: 'success', text1: tUi('ui.pages.login.loginSuccessful_e6d02ef027') });
      } else if (result?.ignored) {
        return result;
      }
      return result;
    },
    [loginWithGoogle]
  );

  const handleGoogleError = useCallback((message) => {
    Toast.show({ type: 'error', text1: message || 'Google login failed' });
  }, []);

  const { signInWithGoogle, googleLoading, googleReady } = useGoogleAuth({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  const handleLogin = async () => {
    if (loading) return;

    if (!email || !password) {
      Toast.show({ type: 'error', text1: 'Enter email and password' });
      return;
    }

    setLoading(true);
    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (result?.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.login.loginSuccessful_e6d02ef027') });
    } else if (result?.ignored) {
      return;
    } else {
      Toast.show({ type: 'error', text1: result?.error || 'Login failed' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerBadge}>
              <FontAwesome name="user" size={16} color="#0F172A" />
            </View>
            <View>
              <Text style={styles.title}>{tUi('ui.pages.login.login_4b4596ebf5')}</Text>
              <Text style={styles.subtitle}>
                {tUi('ui.pages.login.welcomeBackPleaseLoginTo_2f667109f5')}
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{tUi('ui.pages.login.email_2f2d1d3b03')}</Text>
            <TextInput
              style={styles.input}
              placeholder={tUi('ui.pages.login.enterYourEmail_94997e7f2c')}
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.passwordRow}>
              <Text style={styles.label}>{tUi('ui.pages.login.password_c9fb7b6316')}</Text>
              <Pressable onPress={() => Toast.show({ type: 'info', text1: 'Reset password from web' })}>
                <Text style={styles.linkText}>{tUi('ui.pages.login.forgotYourPassword_7484c9cd8e')}</Text>
              </Pressable>
            </View>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.input}
                placeholder={tUi('ui.pages.login.enterYourPassword_4257b32a43')}
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                <FontAwesome
                  name={showPassword ? 'eye-slash' : 'eye'}
                  size={16}
                  color="#0F172A"
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.rememberRow}>
            <Text style={styles.rememberText}>{tUi('ui.pages.login.rememberMe_399aa1dfc4')}</Text>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{ false: '#CBD5F5', true: '#F59E0B' }}
              thumbColor={rememberMe ? '#0F172A' : '#F8FAFC'}
            />
          </View>

          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#0B1220" />
            ) : (
              <Text style={styles.primaryButtonText}>{tUi('ui.pages.login.login_4b4596ebf5')}</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{tUi('ui.common.or')}</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            style={styles.secondaryButton}
            onPress={signInWithGoogle}
            disabled={!googleReady || googleLoading}
          >
            <FontAwesome name="google" size={16} color="#0F172A" />
            <Text style={styles.secondaryButtonText}>
              {googleLoading ? tUi('ui.pages.login.signingIn_5c57a8b55c') : tUi('ui.pages.login.continueWithGoogle_3b1c8480ac')}
            </Text>
          </Pressable>

          <Pressable style={styles.footerRow} onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.footerText}>{tUi('ui.pages.login.donTHaveAnAccount_5c2496a86e')}</Text>
            <Text style={styles.footerLink}>{tUi('ui.pages.login.signUp_8e16000dc0')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F3EE',
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDE68A',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    color: '#64748B',
    marginTop: 4,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#0F172A',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#0F172A',
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  passwordInputWrap: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0B1220',
    fontWeight: '700',
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    color: '#64748B',
  },
  footerLink: {
    color: '#F59E0B',
    fontWeight: '700',
  },
});

export default LoginScreen;
