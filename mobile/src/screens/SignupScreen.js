import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { tUi } from '../i18n/uiText';
import {
  getPasswordStrengthProgress,
  getStrongPasswordErrorMessage,
  isStrongPassword,
  validateEmail,
} from '../utils/helpers';

const SignupScreen = ({ navigation }) => {
  const { signup, loginWithGoogle } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    city: '',
    street: '',
  });

  const passwordStrengthProgress = useMemo(
    () => getPasswordStrengthProgress(formData.password),
    [formData.password]
  );

  const handleGoogleSuccess = useCallback(
    async (accessToken) => {
      const result = await loginWithGoogle(accessToken);
      if (result?.success) {
        Toast.show({ type: 'success', text1: tUi('ui.pages.signup.accountCreatedAndLoggedIn_ce5b7626b2') });
        navigation.navigate('Home');
      }
      return result;
    },
    [loginWithGoogle, navigation]
  );

  const handleGoogleError = useCallback((message) => {
    Toast.show({
      type: 'error',
      text1: message || tUi('ui.pages.signup.googleSignupFailedPleaseTry_529ce3ad69'),
    });
  }, []);

  const { signInWithGoogle, googleLoading, googleReady } = useGoogleAuth({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.email) {
      nextErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      nextErrors.email = 'Please enter a valid email';
    }

    if (!formData.first_name) {
      nextErrors.first_name = 'First name is required';
    }

    if (!formData.last_name) {
      nextErrors.last_name = 'Last name is required';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required';
    } else if (!isStrongPassword(formData.password)) {
      nextErrors.password = getStrongPasswordErrorMessage();
    }

    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const result = await signup({
      email: formData.email,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone || null,
      country: formData.country || null,
      city: formData.city || null,
      street: formData.street || null,
    });
    setLoading(false);

    if (result?.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.signup.accountCreatedAndLoggedIn_ce5b7626b2') });
      navigation.navigate('Login');
    } else {
      Toast.show({ type: 'error', text1: result?.error || 'Signup failed' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerBadge}>
              <FontAwesome name="user-plus" size={16} color="#0F172A" />
            </View>
            <View>
              <Text style={styles.title}>{tUi('ui.pages.signup.signUp_31e879f853')}</Text>
              <Text style={styles.subtitle}>
                {tUi('ui.pages.signup.createANewAccountTo_acca247e59')}
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{tUi('ui.pages.signup.firstName_0115dc327f')}</Text>
            <TextInput
              style={[styles.input, errors.first_name && styles.inputError]}
              placeholder={tUi('ui.pages.signup.enterYourFirstName_456883bf94')}
              placeholderTextColor="#94A3B8"
              value={formData.first_name}
              onChangeText={(value) => handleChange('first_name', value)}
            />
            {errors.first_name && <Text style={styles.errorText}>{errors.first_name}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{tUi('ui.pages.signup.lastName_d680d61780')}</Text>
            <TextInput
              style={[styles.input, errors.last_name && styles.inputError]}
              placeholder={tUi('ui.pages.signup.enterYourLastName_6449322e24')}
              placeholderTextColor="#94A3B8"
              value={formData.last_name}
              onChangeText={(value) => handleChange('last_name', value)}
            />
            {errors.last_name && <Text style={styles.errorText}>{errors.last_name}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{tUi('ui.pages.signup.email_4283f2f98d')}</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder={tUi('ui.pages.signup.enterYourEmail_1b36f3c709')}
              placeholderTextColor="#94A3B8"
              value={formData.email}
              onChangeText={(value) => handleChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Text style={styles.label}>{tUi('ui.pages.signup.phoneOptional_75c8e69b0d')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tUi('ui.pages.signup.enterYourPhoneNumber_28d611e3a3')}
                placeholderTextColor="#94A3B8"
                value={formData.phone}
                onChangeText={(value) => handleChange('phone', value)}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Text style={styles.label}>{tUi('ui.pages.signup.countryOptional_5204ef7b72')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tUi('ui.pages.signup.enterYourCountry_b8ec420563')}
                placeholderTextColor="#94A3B8"
                value={formData.country}
                onChangeText={(value) => handleChange('country', value)}
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.label}>{tUi('ui.pages.signup.cityOptional_a7da0fbc82')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tUi('ui.pages.signup.enterYourCity_592c44c282')}
                placeholderTextColor="#94A3B8"
                value={formData.city}
                onChangeText={(value) => handleChange('city', value)}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{tUi('ui.pages.signup.streetOptional_8c6d703abb')}</Text>
            <TextInput
              style={styles.input}
              placeholder={tUi('ui.pages.signup.enterYourStreetAddress_8a29161f56')}
              placeholderTextColor="#94A3B8"
              value={formData.street}
              onChangeText={(value) => handleChange('street', value)}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{tUi('ui.pages.signup.password_7084f01dbc')}</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder={tUi('ui.pages.signup.enterYourPassword_13b5e3dee5')}
                placeholderTextColor="#94A3B8"
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
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
            <View style={styles.strengthTrack}>
              <View style={[styles.strengthFill, { width: `${passwordStrengthProgress}%` }]} />
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{tUi('ui.pages.signup.confirmPassword_3222757f3c')}</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder={tUi('ui.pages.signup.confirmYourPassword_942a5af97c')}
                placeholderTextColor="#94A3B8"
                value={formData.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                secureTextEntry={!showConfirmPassword}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
              >
                <FontAwesome
                  name={showConfirmPassword ? 'eye-slash' : 'eye'}
                  size={16}
                  color="#0F172A"
                />
              </Pressable>
            </View>
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>

          <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#0B1220" />
            ) : (
              <Text style={styles.primaryButtonText}>{tUi('ui.pages.signup.signUp_31e879f853')}</Text>
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
              {googleLoading ? tUi('ui.pages.signup.signingUp_fb7acde66f') : tUi('ui.pages.signup.continueWithGoogle_f632e5cb4c')}
            </Text>
          </Pressable>

          <Pressable style={styles.footerRow} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerText}>{tUi('ui.pages.signup.alreadyHaveAnAccount_2afe32fcac')}</Text>
            <Text style={styles.footerLink}>{tUi('ui.pages.signup.login_fa9a00d8ad')}</Text>
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
    gap: 16,
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
  inputError: {
    borderColor: '#F87171',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
    gap: 8,
  },
  passwordInputWrap: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  strengthTrack: {
    marginTop: 6,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
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

export default SignupScreen;
