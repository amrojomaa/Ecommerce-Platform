import React, { useCallback, useContext, useMemo, useState } from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import AuthPageShell from '../components/auth/AuthPageShell';
import {
  AuthDivider,
  AuthGoogleButton,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthTextField,
} from '../components/auth/AuthField';
import { createAuthStyles } from '../components/auth/authStyles';
import { AuthContext } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useTUi } from '../i18n/uiText';
import { useTheme } from '../context/ThemeContext';
import { useRtlLayout } from '../hooks/useRtlLayout';
import {
  getPasswordStrengthProgress,
  isStrongPassword,
  validateEmail,
} from '../utils/helpers';

const SignupScreen = ({ navigation }) => {
  const { signup, loginWithGoogle, hasPanelAccess } = useContext(AuthContext);
  const tUi = useTUi();
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });
  const { row } = useRtlLayout();

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

  const finishSignupSuccess = useCallback(() => {
    Toast.show({ type: 'success', text1: tUi('ui.pages.signup.accountCreatedAndLoggedIn_ce5b7626b2') });
    if (!hasPanelAccess() && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [hasPanelAccess, navigation, tUi]);

  const handleGoogleSuccess = useCallback(
    async (accessToken) => {
      const result = await loginWithGoogle(accessToken);
      if (result?.success) {
        finishSignupSuccess();
      }
      return result;
    },
    [finishSignupSuccess, loginWithGoogle]
  );

  const handleGoogleError = useCallback(
    (message) => {
      Toast.show({
        type: 'error',
        text1: message || tUi('ui.pages.signup.googleSignupFailedPleaseTry_529ce3ad69'),
      });
    },
    [tUi]
  );

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
      nextErrors.email = tUi('ui.pages.signup.emailRequired_b4e8c2d510');
    } else if (!validateEmail(formData.email)) {
      nextErrors.email = tUi('ui.pages.signup.emailInvalid_b4e8c2d511');
    }

    if (!formData.first_name) {
      nextErrors.first_name = tUi('ui.pages.signup.firstNameRequired_b4e8c2d512');
    }

    if (!formData.last_name) {
      nextErrors.last_name = tUi('ui.pages.signup.lastNameRequired_b4e8c2d513');
    }

    if (!formData.password) {
      nextErrors.password = tUi('ui.pages.resetPassword.passwordRequired_b4e8a1c2d8');
    } else if (!isStrongPassword(formData.password)) {
      nextErrors.password = tUi('ui.pages.resetPassword.passwordRequirements_c8f1a2b3dc');
    }

    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = tUi('ui.pages.resetPassword.passwordsDoNotMatch_b4e8a1c2d9');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    const result = await signup({
      email: formData.email.trim(),
      password: formData.password,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      phone: formData.phone.trim() || null,
      country: formData.country.trim() || null,
      city: formData.city.trim() || null,
      street: formData.street.trim() || null,
    });
    setLoading(false);

    if (result?.success) {
      Toast.show({ type: 'success', text1: tUi('ui.pages.signup.accountCreatedAndLoggedIn_ce5b7626b2') });
      navigation.navigate('Login');
    } else {
      Toast.show({ type: 'error', text1: result?.error || tUi('ui.pages.signup.signupFailed_b4e8c2d516') });
    }
  };

  return (
    <AuthPageShell
      panel={{
        kicker: tUi('ui.pages.signup.signUp_31e879f853'),
        title: tUi('ui.pages.signup.panelTitle_b4e8c2d511'),
        subtitle: tUi('ui.pages.signup.createANewAccountTo_acca247e59'),
      }}
      footer={{
        text: tUi('ui.pages.signup.alreadyHaveAnAccount_2afe32fcac'),
        linkLabel: tUi('ui.pages.signup.login_fa9a00d8ad'),
        onPressLink: () => navigation.navigate('Login'),
      }}
    >
      <View style={[styles.fieldRow, { flexDirection: row }]}>
        <AuthTextField
          style={styles.fieldHalf}
          label={tUi('ui.pages.signup.firstName_0115dc327f')}
          required
          error={errors.first_name}
          inputProps={{
            value: formData.first_name,
            onChangeText: (value) => handleChange('first_name', value),
            placeholder: tUi('ui.pages.signup.enterYourFirstName_456883bf94'),
            autoComplete: 'given-name',
          }}
        />
        <AuthTextField
          style={styles.fieldHalf}
          label={tUi('ui.pages.signup.lastName_d680d61780')}
          required
          error={errors.last_name}
          inputProps={{
            value: formData.last_name,
            onChangeText: (value) => handleChange('last_name', value),
            placeholder: tUi('ui.pages.signup.enterYourLastName_6449322e24'),
            autoComplete: 'family-name',
          }}
        />
      </View>

      <AuthTextField
        label={tUi('ui.pages.signup.email_4283f2f98d')}
        required
        error={errors.email}
        inputProps={{
          value: formData.email,
          onChangeText: (value) => handleChange('email', value),
          placeholder: tUi('ui.pages.signup.enterYourEmail_1b36f3c709'),
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          autoComplete: 'email',
        }}
      />

      <AuthTextField
        label={tUi('ui.pages.signup.phoneOptional_75c8e69b0d')}
        inputProps={{
          value: formData.phone,
          onChangeText: (value) => handleChange('phone', value),
          placeholder: tUi('ui.pages.signup.enterYourPhoneNumber_28d611e3a3'),
          keyboardType: 'phone-pad',
          autoComplete: 'tel',
        }}
      />

      <AuthTextField
        label={tUi('ui.pages.signup.countryOptional_5204ef7b72')}
        inputProps={{
          value: formData.country,
          onChangeText: (value) => handleChange('country', value),
          placeholder: tUi('ui.pages.signup.enterYourCountry_b8ec420563'),
          autoComplete: 'country-name',
        }}
      />

      <View style={[styles.fieldRow, { flexDirection: row }]}>
        <AuthTextField
          style={styles.fieldHalf}
          label={tUi('ui.pages.signup.cityOptional_a7da0fbc82')}
          inputProps={{
            value: formData.city,
            onChangeText: (value) => handleChange('city', value),
            placeholder: tUi('ui.pages.signup.enterYourCity_592c44c282'),
            autoComplete: 'postal-address-locality',
          }}
        />
        <AuthTextField
          style={styles.fieldHalf}
          label={tUi('ui.pages.signup.streetOptional_8c6d703abb')}
          inputProps={{
            value: formData.street,
            onChangeText: (value) => handleChange('street', value),
            placeholder: tUi('ui.pages.signup.enterYourStreetAddress_8a29161f56'),
            autoComplete: 'street-address',
          }}
        />
      </View>

      <AuthPasswordField
        label={tUi('ui.pages.signup.password_7084f01dbc')}
        required
        value={formData.password}
        onChangeText={(value) => handleChange('password', value)}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
        placeholder={tUi('ui.pages.signup.enterYourPassword_13b5e3dee5')}
        error={errors.password}
      >
        <View style={styles.strengthTrack}>
          <View style={[styles.strengthFill, { width: `${passwordStrengthProgress}%` }]} />
        </View>
      </AuthPasswordField>

      <AuthPasswordField
        label={tUi('ui.pages.signup.confirmPassword_3222757f3c')}
        required
        value={formData.confirmPassword}
        onChangeText={(value) => handleChange('confirmPassword', value)}
        showPassword={showConfirmPassword}
        onTogglePassword={() => setShowConfirmPassword((prev) => !prev)}
        placeholder={tUi('ui.pages.signup.confirmYourPassword_942a5af97c')}
        error={errors.confirmPassword}
      />

      <AuthPrimaryButton
        label={tUi('ui.pages.signup.signUp_31e879f853')}
        loadingLabel={tUi('ui.pages.signup.creatingAccount_294bb5a7e0')}
        loading={loading}
        disabled={googleLoading}
        onPress={handleSubmit}
      />

      <AuthDivider />

      <AuthGoogleButton
        label={tUi('ui.pages.signup.continueWithGoogle_f632e5cb4c')}
        loadingLabel={tUi('ui.pages.signup.signingUp_fb7acde66f')}
        loading={googleLoading}
        disabled={!googleReady || loading}
        onPress={signInWithGoogle}
      />
    </AuthPageShell>
  );
};

export default SignupScreen;
