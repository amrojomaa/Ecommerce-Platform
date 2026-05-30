import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createAuthStyles } from './authStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';

export const AuthTextField = ({
  label,
  required = false,
  error,
  labelExtra,
  inputProps = {},
  style,
}) => {
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });
  const { isRtl } = useLanguage();
  const { textAlign, row } = useRtlLayout();
  const inputRtl = {
    textAlign,
    writingDirection: isRtl ? 'rtl' : 'ltr',
  };

  return (
    <View style={[styles.field, style]}>
      {labelExtra ? (
        <View style={[styles.labelRow, { flexDirection: row }]}>
          <Text style={[styles.label, { textAlign }]}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
          {labelExtra}
        </View>
      ) : label ? (
        <Text style={[styles.label, { textAlign }]}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null, inputRtl, inputProps.style]}
        {...inputProps}
      />
      {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}
    </View>
  );
};

export const AuthPasswordField = ({
  label,
  required = false,
  value,
  onChangeText,
  showPassword,
  onTogglePassword,
  error,
  placeholder,
  labelExtra,
  children,
}) => {
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });
  const { isRtl } = useLanguage();
  const { textAlign, row } = useRtlLayout();
  const tUi = useTUi();
  const inputRtl = {
    textAlign,
    writingDirection: isRtl ? 'rtl' : 'ltr',
  };

  return (
    <View style={styles.field}>
      {labelExtra ? (
        <View style={[styles.labelRow, { flexDirection: row }]}>
          <Text style={[styles.label, { textAlign }]}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
          {labelExtra}
        </View>
      ) : (
        <Text style={[styles.label, { textAlign }]}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      )}
      <View style={styles.passwordWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          style={[
            styles.input,
            styles.passwordInput,
            isRtl ? styles.passwordInputRtl : null,
            error ? styles.inputError : null,
            inputRtl,
          ]}
        />
        <Pressable
          style={[styles.passwordToggle, isRtl ? styles.passwordToggleRtl : null]}
          onPress={onTogglePassword}
          accessibilityLabel={
            showPassword
              ? tUi('ui.pages.login.hidePassword_34503b95bb')
              : tUi('ui.pages.login.showPassword_e3faa6cab8')
          }
        >
          <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
        </Pressable>
      </View>
      {children}
      {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}
    </View>
  );
};

export const AuthCheckbox = ({ label, checked, onToggle }) => {
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });
  const { textAlign, row } = useRtlLayout();

  return (
    <Pressable style={[styles.checkboxRow, { flexDirection: row }]} onPress={onToggle}>
      <View style={[styles.checkboxBox, checked ? styles.checkboxBoxChecked : null]}>
        {checked ? <Feather name="check" size={12} color="#fff" /> : null}
      </View>
      <Text style={[styles.checkboxLabel, { textAlign }]}>{label}</Text>
    </Pressable>
  );
};

export const AuthDivider = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });
  const tUi = useTUi();
  const { row } = useRtlLayout();

  return (
    <View style={[styles.dividerRow, { flexDirection: row }]}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{tUi('ui.common.or')}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
};

export const AuthPrimaryButton = ({ label, loading, loadingLabel, onPress, disabled }) => {
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });

  return (
    <Pressable
      style={[styles.primaryBtn, disabled ? { opacity: 0.65 } : null]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.primaryBtnText}>{loadingLabel || label}</Text>
        </>
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </Pressable>
  );
};

export const AuthGoogleButton = ({ label, loadingLabel, loading, disabled, onPress }) => {
  const { colors, shadow, isDark } = useTheme();
  const styles = createAuthStyles({ colors, shadow, isDark });

  return (
    <Pressable
      style={[styles.googleBtn, disabled ? { opacity: 0.65 } : null]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <Feather name="chrome" size={18} color={colors.text} />
      <Text style={styles.googleBtnText}>{loading ? loadingLabel : label}</Text>
    </Pressable>
  );
};
