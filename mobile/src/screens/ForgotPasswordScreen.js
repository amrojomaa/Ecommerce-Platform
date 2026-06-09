import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import AuthPageShell from '../components/auth/AuthPageShell';
import { AuthPrimaryButton, AuthTextField } from '../components/auth/AuthField';
import { useTUi } from '../i18n/uiText';
import http from '../services/http';
import { AUTH_ENDPOINTS } from '../config/api';

const ForgotPasswordScreen = ({ navigation }) => {
  const tUi = useTUi();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.forgotPassword.enterYourEmail_dd05194064') });
      return;
    }

    setLoading(true);
    try {
      await http.post(AUTH_ENDPOINTS.FORGOT_PASSWORD, { email: email.trim() });
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.forgotPassword.codeSent_b4e8c2d3ff'),
      });
      navigation.navigate('VerifyResetCode', { email: email.trim() });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1:
          err.response?.data?.detail ||
          err.message ||
          tUi('ui.pages.forgotPassword.somethingWentWrongPleaseTry_fa9ec3dd4b'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      panel={{
        kicker: tUi('ui.pages.resetPassword.kicker_c8f1a2b3d4'),
        title: tUi('ui.pages.forgotPassword.forgotPassword_44e42269c0'),
        subtitle: tUi('ui.pages.forgotPassword.enterYourEmailAddressAnd_a30a91a5df'),
      }}
      footer={{
        text: tUi('ui.pages.forgotPassword.rememberYourPassword_5c46335c87'),
        linkLabel: tUi('ui.pages.forgotPassword.login_a2083e5051'),
        onPressLink: () => navigation.navigate('Login'),
      }}
    >
      <AuthTextField
        label={tUi('ui.pages.forgotPassword.email_52fee565c6')}
        inputProps={{
          value: email,
          onChangeText: setEmail,
          placeholder: tUi('ui.pages.forgotPassword.enterYourEmail_dd05194064'),
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          autoComplete: 'email',
        }}
      />

      <AuthPrimaryButton
        label={tUi('ui.pages.forgotPassword.sendVerificationCode_54c2f06c38')}
        loadingLabel={tUi('ui.pages.forgotPassword.sending_4ecdfd8d99')}
        loading={loading}
        onPress={handleSubmit}
      />
    </AuthPageShell>
  );
};

export default ForgotPasswordScreen;
