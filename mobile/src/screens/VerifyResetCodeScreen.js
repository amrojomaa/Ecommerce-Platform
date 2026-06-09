import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import AuthPageShell from '../components/auth/AuthPageShell';
import { AuthPrimaryButton, AuthTextField } from '../components/auth/AuthField';
import { useTUi } from '../i18n/uiText';
import http from '../services/http';
import { AUTH_ENDPOINTS } from '../config/api';

const VerifyResetCodeScreen = ({ route, navigation }) => {
  const { email } = route.params || { email: '' };
  const tUi = useTUi();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim()) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.verifyResetCode.enterCodeRequired_b4e8c2d400') });
      return;
    }

    setLoading(true);
    try {
      await http.post(AUTH_ENDPOINTS.VERIFY_RESET_CODE, { email, reset_code: code.trim() });
      Toast.show({ type: 'success', text1: tUi('ui.pages.resetPassword.verifiedForEmail_c8f1a2b3db', { value0: email }) });
      navigation.navigate('ResetPassword', { email, resetCode: code.trim() });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1:
          err.response?.data?.detail ||
          err.message ||
          tUi('ui.pages.verifyResetCode.codeHasExpiredPleaseRequest_2d7fc2e562'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      panel={{
        kicker: tUi('ui.pages.resetPassword.kicker_c8f1a2b3d4'),
        title: tUi('ui.pages.verifyResetCode.verifyResetCode_4118199b66'),
        subtitle: `${tUi('ui.pages.verifyResetCode.weVeSentA6_2e1b379629')} ${email}`,
      }}
      footer={{
        text: tUi('ui.pages.verifyResetCode.didnTReceiveTheCode_fe6cf53a4a'),
        linkLabel: tUi('ui.pages.verifyResetCode.requestAgain_fbf257db51'),
        onPressLink: () => navigation.navigate('ForgotPassword'),
      }}
    >
      <AuthTextField
        label={tUi('ui.pages.verifyResetCode.verifyCode_c2dae9fade')}
        inputProps={{
          value: code,
          onChangeText: setCode,
          placeholder: tUi('ui.pages.verifyResetCode.useTheVerificationCodeBelow_5e39b94941'),
          keyboardType: 'number-pad',
          maxLength: 6,
          style: { letterSpacing: 2, textAlign: 'center' },
        }}
      />

      <AuthPrimaryButton
        label={tUi('ui.pages.verifyResetCode.verifyCode_c2dae9fade')}
        loadingLabel={tUi('ui.pages.verifyResetCode.verifying_a64f8c3407')}
        loading={loading}
        onPress={handleSubmit}
      />
    </AuthPageShell>
  );
};

export default VerifyResetCodeScreen;
