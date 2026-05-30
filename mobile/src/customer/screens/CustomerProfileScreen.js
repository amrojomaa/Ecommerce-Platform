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
import CustomerScreen from '../components/CustomerScreen';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';
import { USER_ENDPOINTS } from '../../config/api';
import http from '../../services/http';
import { getImageUrl, isStrongPassword } from '../../utils/helpers';
import { confirmAction } from '../../admin/utils/confirm';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=2563eb&color=fff&name=User';

const CustomerProfileScreen = () => {
  const { user, fetchUserInfo } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
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
    const initials = `${user?.first_name?.[0] || 'U'}${user?.last_name?.[0] || ''}`;
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(initials)}`;
  }, [previewUri, user]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: tUi('ui.pages.profile.chooseImage_2cc5e489af') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setPickedAsset(result.assets[0]);
    setPreviewUri(result.assets[0].uri);
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
      tUi('ui.pages.profile.deleteImage_280009a1bc'),
      tUi('ui.pages.profile.areYouSureYouWant_02753c98df'),
      tUi('ui.pages.profile.delete_b417f7abe5'),
      tUi('ui.pages.profile.cancel_1ce51b317b')
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
      if (form.password) payload.password = form.password;

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
        style={[styles.input, { textAlign, writingDirection: isRtl ? 'rtl' : 'ltr', color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        value={form[field]}
        onChangeText={(value) => setField(field, value)}
        placeholderTextColor={colors.muted}
        secureTextEntry={options.secure}
      />
    </View>
  );

  return (
    <CustomerScreen
      showBack
      kicker={tUi('ui.mobile.customer.storeKicker')}
      title={tUi('ui.pages.profile.myProfile_bfb22c6292')}
      subtitle={tUi('ui.mobile.profile.subtitle')}
    >
      <View style={styles.avatarRow}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
        <View style={[styles.avatarActions, { flexDirection: row }]}>
          <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={pickImage}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
              {tUi('ui.pages.profile.chooseImage_2cc5e489af')}
            </Text>
          </Pressable>
          {pickedAsset ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={uploadImage}
              disabled={imageLoading}
            >
              <Text style={styles.primaryButtonText}>
                {imageLoading ? tUi('ui.mobile.common.saving') : tUi('ui.mobile.profile.uploadImage')}
              </Text>
            </Pressable>
          ) : null}
          {user?.profile_image ? (
            <Pressable onPress={deleteImage} disabled={imageLoading}>
              <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>
                {tUi('ui.pages.profile.deleteImage_280009a1bc')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>
        {tUi('ui.pages.profile.accountInformation_d02e627c43')}
      </Text>
      <View style={styles.fieldBlock}>
        <Text style={[styles.label, { textAlign }]}>{tUi('ui.pages.profile.email_8ba28bf444')}</Text>
        <Text style={[styles.readOnlyValue, { color: colors.text, textAlign }]}>{user?.email || '—'}</Text>
      </View>
      {renderField(tUi('ui.mobile.profile.firstName'), 'first_name')}
      {renderField(tUi('ui.mobile.profile.lastName'), 'last_name')}
      {renderField(tUi('ui.mobile.profile.phone'), 'phone')}
      {renderField(tUi('ui.pages.profile.country_8577532ab0'), 'country')}
      {renderField(tUi('ui.pages.profile.city_68610182e6'), 'city')}
      {renderField(tUi('ui.pages.profile.address_fe584a84b3'), 'street')}

      <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>
        {tUi('ui.mobile.profile.changePassword')}
      </Text>
      {renderField(tUi('ui.pages.profile.enterNewPassword_a88f41c56f'), 'password', { secure: true })}
      {renderField(tUi('ui.pages.profile.confirmNewPassword_007a703a2f'), 'confirmPassword', { secure: true })}

      <Pressable
        style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={[styles.saveButtonText, { color: colors.surface }]}>{tUi('ui.mobile.common.save')}</Text>
        )}
      </Pressable>
    </CustomerScreen>
  );
};

const createStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    avatarRow: { alignItems: 'center', marginBottom: 24 },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 12,
    },
    avatarActions: { flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 8 },
    fieldBlock: { marginBottom: 12 },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    readOnlyValue: { fontSize: 15, fontWeight: '600' },
    primaryButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    secondaryButton: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: colors.surfaceAlt,
    },
    saveButton: {
      marginTop: 16,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 24,
      ...shadow,
    },
    saveButtonText: { fontWeight: '700', fontSize: 15 },
    buttonDisabled: { opacity: 0.7 },
  });

export default CustomerProfileScreen;
