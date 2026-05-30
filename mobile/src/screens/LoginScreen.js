import React, { useCallback, useContext, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import AuthPageShell from '../components/auth/AuthPageShell';
import {
  AuthCheckbox,
  AuthDivider,
  AuthGoogleButton,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthTextField,
} from '../components/auth/AuthField';
import { AuthContext } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useTUi } from '../i18n/uiText';
import { useTheme } from '../context/ThemeContext';
import { createAuthStyles } from '../components/auth/authStyles';

const LoginScreen = ({ navigation }) => {
  const { login, loginWithGoogle, hasPanelAccess } = useContext(AuthContext);
  const tUi = useTUi();
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const finishLoginSuccess = useCallback(() => {
    Toast.show({ type: 'success', text1: tUi('ui.pages.login.loginSuccessful_e6d02ef027') });
    if (!hasPanelAccess() && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [hasPanelAccess, navigation, tUi]);

  const handleGoogleSuccess = useCallback(
    async (accessToken) => {
      const result = await loginWithGoogle(accessToken);
      if (result?.success) {
        finishLoginSuccess();
      } else if (result?.ignored) {
        return result;
      }
      return result;
    },
    [finishLoginSuccess, loginWithGoogle]
  );

  const handleGoogleError = useCallback(
    (message) => {
      Toast.show({
        type: 'error',
        text1: message || tUi('ui.pages.login.googleLoginFailedPleaseTry_8d8fedd536'),
      });
    },
    [tUi]
  );

  const { signInWithGoogle, googleLoading, googleReady } = useGoogleAuth({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  const handleLogin = async () => {
    if (loading) return;

    if (!email.trim() || !password) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.login.enterEmailPassword') });
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password, rememberMe);
    setLoading(false);

    if (result?.success) {
      finishLoginSuccess();
    } else if (result?.ignored) {
      return;
    } else {
      Toast.show({ type: 'error', text1: result?.error || tUi('ui.pages.login.loginFailed_b4e8c2d51c') });
    }
  };

  return (
    <AuthPageShell
      panel={{
        kicker: tUi('ui.pages.login.login_4b4596ebf5'),
        title: tUi('ui.pages.login.panelTitle_b4e8c2d50b'),
        subtitle: tUi('ui.pages.login.welcomeBackPleaseLoginTo_2f667109f5'),
      }}
      footer={{
        text: tUi('ui.pages.login.donTHaveAnAccount_5c2496a86e'),
        linkLabel: tUi('ui.pages.login.signUp_8e16000dc0'),
        onPressLink: () => navigation.navigate('Signup'),
      }}
    >
      <AuthTextField
        label={tUi('ui.pages.login.email_2f2d1d3b03')}
        inputProps={{
          value: email,
          onChangeText: setEmail,
          placeholder: tUi('ui.pages.login.enterYourEmail_94997e7f2c'),
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          autoComplete: 'email',
        }}
      />

      <AuthPasswordField
        label={tUi('ui.pages.login.password_c9fb7b6316')}
        value={password}
        onChangeText={setPassword}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
        placeholder={tUi('ui.pages.login.enterYourPassword_4257b32a43')}
        labelExtra={
          <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.inlineLink}>{tUi('ui.pages.login.forgotYourPassword_7484c9cd8e')}</Text>
          </Pressable>
        }
      />

      <AuthCheckbox
        label={tUi('ui.pages.login.rememberMe_399aa1dfc4')}
        checked={rememberMe}
        onToggle={() => setRememberMe((prev) => !prev)}
      />

      <AuthPrimaryButton
        label={tUi('ui.pages.login.login_4b4596ebf5')}
        loadingLabel={tUi('ui.pages.login.loggingIn_7d068b432f')}
        loading={loading}
        disabled={googleLoading}
        onPress={handleLogin}
      />

      <AuthDivider />

      <AuthGoogleButton
        label={tUi('ui.pages.login.continueWithGoogle_3b1c8480ac')}
        loadingLabel={tUi('ui.pages.login.signingIn_5c57a8b55c')}
        loading={googleLoading}
        disabled={!googleReady || loading}
        onPress={signInWithGoogle}
      />
    </AuthPageShell>
  );
};

export default LoginScreen;
