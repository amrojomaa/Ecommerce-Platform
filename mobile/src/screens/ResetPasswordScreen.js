import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import AuthPageShell from '../components/auth/AuthPageShell';
import { AuthPasswordField, AuthPrimaryButton } from '../components/auth/AuthField';
import { useTUi } from '../i18n/uiText';
import http from '../services/http';
import { AUTH_ENDPOINTS } from '../config/api';

const ResetPasswordScreen = ({ route, navigation }) => {
  const { email, resetCode } = route.params || { email: '', resetCode: '' };
  const tUi = useTUi();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.resetPassword.passwordRequired_b4e8a1c2d8') });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.resetPassword.passwordsDoNotMatch_b4e8a1c2d9') });
      return;
    }

    setLoading(true);
    try {
      await http.post(AUTH_ENDPOINTS.RESET_PASSWORD, {
        email,
        reset_code: resetCode,
        new_password: newPassword,
      });
      Toast.show({ type: 'success', text1: tUi('ui.pages.resetPassword.passwordResetSuccess_b4e8a1c2da') });
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1500);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1:
          err.response?.data?.detail ||
          err.message ||
          tUi('ui.pages.resetPassword.failedToResetPassword_b4e8a1c2db'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      panel={{
        kicker: tUi('ui.pages.resetPassword.kicker_c8f1a2b3d4'),
        title: tUi('ui.pages.resetPassword.pageTitle_c8f1a2b3d5'),
        subtitle: tUi('ui.pages.resetPassword.enterYourNewPasswordBelow_cabc85c425'),
      }}
      footer={{
        text: tUi('ui.pages.resetPassword.rememberYourPassword_d9b1edb381'),
        linkLabel: tUi('ui.pages.resetPassword.login_9c9e61f5aa'),
        onPressLink: () => navigation.navigate('Login'),
      }}
    >
      <AuthPasswordField
        label={tUi('ui.pages.resetPassword.newPassword_f79bf0add5')}
        value={newPassword}
        onChangeText={setNewPassword}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
        placeholder={tUi('ui.pages.resetPassword.enterNewPassword_39a115514b')}
      />

      <AuthPasswordField
        label={tUi('ui.pages.resetPassword.confirmPassword_5f9f1e8060')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
        placeholder={tUi('ui.pages.resetPassword.confirmNewPassword_4cf60e82ad')}
      />

      <AuthPrimaryButton
        label={tUi('ui.pages.resetPassword.submitButton_c8f1a2b3d6')}
        loadingLabel={tUi('ui.pages.resetPassword.savingPassword_c8f1a2b3d7')}
        loading={loading}
        onPress={handleSubmit}
      />
    </AuthPageShell>
  );
};

export default ResetPasswordScreen;
