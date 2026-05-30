import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { getRoleLabel } from '../../i18n/roles';
import { useLanguage } from '../../context/LanguageContext';
import AdminScreen from '../components/AdminScreen';
import { USER_ENDPOINTS } from '../../config/api';
import http from '../../services/http';
import { getImageUrl, isStrongPassword } from '../../utils/helpers';
import { confirmAction } from '../utils/confirm';
import { usePanelRole } from '../hooks/usePanelRole';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=2563eb&color=fff&name=Admin';

const AdminProfileScreen = () => {
  const { user, fetchUserInfo } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();
  const { language } = useLanguage();
  const { isRtl, textAlign, row } = useRtlLayout();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    city: '',
    street: '',
    password: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [pickedAsset, setPickedAsset] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      country: user.country || '',
      city: user.city || '',
      street: user.street || '',
      password: '',
      confirmPassword: '',
    });
  }, [user]);

  const avatarUri = useMemo(() => {
    if (previewUri) return previewUri;
    if (user?.profile_image) return getImageUrl(user.profile_image);
    const initials = `${user?.first_name?.[0] || 'A'}${user?.last_name?.[0] || ''}`;
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(initials)}`;
  }, [previewUri, user]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.profile.chooseImage') });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setPickedAsset(asset);
    setPreviewUri(asset.uri);
  };

  const uploadImage = async () => {
    if (!pickedAsset) return;
    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: pickedAsset.uri,
        name: pickedAsset.fileName || 'profile.jpg',
        type: pickedAsset.mimeType || 'image/jpeg',
      });

      await http.post(USER_ENDPOINTS.UPLOAD_PROFILE_IMAGE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchUserInfo();
      setPickedAsset(null);
      setPreviewUri(null);
      Toast.show({ type: 'success', text1: tUi('ui.mobile.profile.imageUpdated') });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.toast.operationFailed'),
      });
    } finally {
      setImageLoading(false);
    }
  };

  const deleteImage = async () => {
    const confirmed = await confirmAction(
      tUi('ui.mobile.profile.deleteImage'),
      tUi('ui.mobile.profile.deleteImageConfirm'),
      tUi('ui.mobile.profile.deleteImage'),
      tUi('ui.mobile.common.cancel')
    );
    if (!confirmed) return;

    setImageLoading(true);
    try {
      await http.delete(USER_ENDPOINTS.DELETE_PROFILE_IMAGE);
      await fetchUserInfo();
      setPickedAsset(null);
      setPreviewUri(null);
      Toast.show({ type: 'success', text1: tUi('ui.mobile.profile.imageDeleted') });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.toast.operationFailed'),
      });
    } finally {
      setImageLoading(false);
    }
  };

  const handleSave = async () => {
    if (form.password && !isStrongPassword(form.password)) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.profile.weakPassword') });
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      Toast.show({ type: 'error', text1: tUi('ui.mobile.profile.passwordMismatch') });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        email: user.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
        country: form.country || null,
        city: form.city || null,
        street: form.street || null,
      };
      if (form.password) {
        payload.password = form.password;
      }

      await http.put(USER_ENDPOINTS.UPDATE_ME, payload);
      await fetchUserInfo();
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      Toast.show({ type: 'success', text1: tUi('ui.mobile.profile.profileUpdated') });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || error.message || tUi('ui.toast.operationFailed'),
      });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label, field, options = {}) => (
    <View style={styles.fieldBlock} key={field}>
      <Text style={[styles.label, { textAlign }]}>{label}</Text>
      <TextInput
        style={[styles.input, { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr' }]}
        value={form[field]}
        onChangeText={(value) => setField(field, value)}
        placeholderTextColor={colors.muted}
        secureTextEntry={options.secure}
        editable={options.editable !== false}
        autoCapitalize={options.secure ? 'none' : 'sentences'}
      />
    </View>
  );

  return (
    <AdminScreen
      kicker={panelKicker}
      title={tUi('ui.mobile.profile.title')}
      subtitle={tUi('ui.mobile.profile.subtitle')}
    >
      <View style={styles.avatarRow}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
        <View style={[styles.avatarActions, { flexDirection: row }]}>
          <Pressable style={styles.secondaryButton} onPress={pickImage}>
            <Text style={styles.secondaryButtonText}>{tUi('ui.mobile.profile.chooseImage')}</Text>
          </Pressable>
          {pickedAsset ? (
            <Pressable
              style={[styles.primaryButton, imageLoading && styles.buttonDisabled]}
              onPress={uploadImage}
              disabled={imageLoading}
            >
              <Text style={styles.primaryButtonText}>
                {imageLoading ? tUi('ui.mobile.common.saving') : tUi('ui.mobile.profile.uploadImage')}
              </Text>
            </Pressable>
          ) : null}
          {user?.profile_image ? (
            <Pressable style={styles.dangerButton} onPress={deleteImage} disabled={imageLoading}>
              <Text style={styles.dangerButtonText}>{tUi('ui.mobile.profile.deleteImage')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { textAlign }]}>{tUi('ui.mobile.profile.accountInfo')}</Text>
      <View style={styles.fieldBlock}>
        <Text style={[styles.label, { textAlign }]}>{tUi('ui.mobile.profile.email')}</Text>
        <Text style={[styles.readOnlyValue, { textAlign }]}>{user?.email || '—'}</Text>
      </View>
      {renderField(tUi('ui.mobile.profile.firstName'), 'first_name')}
      {renderField(tUi('ui.mobile.profile.lastName'), 'last_name')}
      {renderField(tUi('ui.mobile.profile.phone'), 'phone')}
      {renderField(tUi('ui.mobile.profile.country'), 'country')}
      {renderField(tUi('ui.mobile.profile.city'), 'city')}
      {renderField(tUi('ui.mobile.profile.street'), 'street')}

      <View style={styles.fieldBlock}>
        <Text style={[styles.label, { textAlign }]}>{tUi('ui.mobile.profile.role')}</Text>
        <Text style={[styles.readOnlyValue, { textAlign }]}>{getRoleLabel(user?.role, language)}</Text>
      </View>

      <Text style={[styles.sectionTitle, { textAlign }]}>{tUi('ui.mobile.profile.changePassword')}</Text>
      {renderField(tUi('ui.mobile.profile.newPassword'), 'password', { secure: true })}
      {renderField(tUi('ui.mobile.profile.confirmPassword'), 'confirmPassword', { secure: true })}

      <Pressable
        style={[styles.saveButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.saveButtonText}>{tUi('ui.mobile.common.save')}</Text>
        )}
      </Pressable>
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    avatarRow: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 12,
    },
    avatarActions: {
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      marginTop: 8,
    },
    fieldBlock: {
      marginBottom: 12,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    readOnlyValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: '700',
      fontSize: 12,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: colors.surfaceAlt,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 12,
    },
    dangerButton: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: `${colors.danger}18`,
    },
    dangerButtonText: {
      color: colors.danger,
      fontWeight: '700',
      fontSize: 12,
    },
    saveButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      ...shadow,
    },
    saveButtonText: {
      color: colors.surface,
      fontWeight: '700',
      fontSize: 15,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });

export default AdminProfileScreen;
