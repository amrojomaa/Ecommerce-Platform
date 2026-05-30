import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';
import { getRoleLabel } from '../../i18n/roles';
import http from '../../services/http';
import { USER_ENDPOINTS, buildUrl } from '../../config/api';
import { buildImageUrl, formatDateTime } from '../utils/format';
import { confirmAction } from '../utils/confirm';

const ROLE_OPTIONS = [
  'admin',
  'support_manager',
  'support_agent',
  'operations_manager',
  'warehouse_manager',
  'seller',
  'warehouse_staff',
  'driver',
  'customer',
  'cashier',
];

const AdminUserDetailsScreen = ({ route, navigation }) => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language } = useLanguage();

  const { userId } = route.params || {};
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('customer');
  const [updating, setUpdating] = useState(false);

  const screenHeader = {
    title: tUi('ui.pages.admin.adminUserDetails.userAccountInformation_1a87059564'),
    subtitle: tUi('ui.pages.admin.adminUserDetails.subtitle_1a2b3c4d5i'),
  };

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await http.get(buildUrl(USER_ENDPOINTS.BY_ID, { id: userId }));
      setUser(response.data || null);
      setSelectedRole(response.data?.role || 'customer');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1:
          error.response?.data?.detail ||
          tUi('ui.pages.admin.adminUserDetails.failedToFetchUserDetails_f6dd9f5e61'),
      });
    } finally {
      setLoading(false);
    }
  }, [tUi, userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleChangeRole = async () => {
    if (!user) return;
    if (user.role === selectedRole) {
      setShowRoleModal(false);
      return;
    }
    setUpdating(true);
    try {
      await http.patch(buildUrl(USER_ENDPOINTS.UPDATE_ROLE, { id: user.id }), {
        role: selectedRole,
      });
      setUser((prev) => (prev ? { ...prev, role: selectedRole } : prev));
      setShowRoleModal(false);
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.admin.adminUsers.userRoleUpdatedToValue_65e151007e', {
          value0: getRoleLabel(selectedRole, language),
        }),
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || tUi('ui.toast.operationFailed'),
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!user) return;
    const nextBlocked = !user.is_blocked;
    if (nextBlocked) {
      const ok = await confirmAction(
        tUi('ui.pages.admin.adminUsers.suspendThisUser_753829cad1'),
        tUi('ui.pages.admin.adminUserDetails.suspendConfirm_8a9b0c1d2e', {
          value0: `${user.first_name || ''} ${user.last_name || ''}`.trim() || tUi('ui.mobile.common.unnamedUser'),
          value1: user.email,
        }),
        tUi('ui.pages.admin.adminUsers.suspend_b9bc672f89'),
        tUi('ui.pages.admin.adminUsers.cancel_5783570289')
      );
      if (!ok) return;
    }
    setUpdating(true);
    try {
      const response = await http.patch(buildUrl(USER_ENDPOINTS.UPDATE_BLOCK, { id: user.id }), {
        is_blocked: nextBlocked,
      });
      setUser((prev) => (prev ? { ...prev, ...response.data } : prev));
      Toast.show({
        type: 'success',
        text1: nextBlocked
          ? tUi('ui.pages.admin.adminUserDetails.userSuspended_9b0c1d2e3f')
          : tUi('ui.pages.admin.adminUserDetails.userReactivated_0c1d2e3f4a'),
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || tUi('ui.toast.operationFailed'),
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    const ok = await confirmAction(
      tUi('ui.pages.admin.adminUsers.deleteUser_e3ea89de3e'),
      tUi('ui.pages.admin.adminUsers.thisActionCannotBeUndone_c8a181f419'),
      tUi('ui.pages.admin.adminUsers.delete_a6a9493a15'),
      tUi('ui.pages.admin.adminUsers.cancel_5783570289')
    );
    if (!ok) return;
    setUpdating(true);
    try {
      const displayName =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
        tUi('ui.mobile.common.unnamedUser');
      await http.delete(buildUrl(USER_ENDPOINTS.DELETE, { id: user.id }));
      Toast.show({
        type: 'success',
        text1: tUi('ui.pages.admin.adminUserDetails.userDeleted_1d2e3f4a5b', { value0: displayName }),
      });
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.detail || tUi('ui.toast.operationFailed'),
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <AdminScreen title={screenHeader.title} subtitle={screenHeader.subtitle}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AdminScreen>
    );
  }

  if (!user) {
    return (
      <AdminScreen title={screenHeader.title} subtitle={screenHeader.subtitle}>
        <Text style={styles.emptyText}>{tUi('ui.mobile.common.noResults')}</Text>
      </AdminScreen>
    );
  }

  const fullName =
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    tUi('ui.mobile.common.unnamedUser');

  return (
    <AdminScreen title={screenHeader.title} subtitle={screenHeader.subtitle}>
      <View style={styles.headerCard}>
        <Image source={{ uri: buildImageUrl(user.profile_image) }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{fullName}</Text>
          <Text style={styles.headerMeta}>{user.email}</Text>
          <Text style={styles.headerMeta}>{getRoleLabel(user.role, language)}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>
          {tUi('ui.pages.admin.adminUserDetails.accountStatus_4e5f6a7b8c')}
        </Text>
        <Text style={styles.detailValue}>
          {user.is_blocked
            ? tUi('ui.mobile.common.blocked')
            : tUi('ui.pages.admin.adminUsers.active_b157924ea3')}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>
          {tUi('ui.pages.admin.adminUserDetails.verificationStatus_52adfe9e86')}
        </Text>
        <Text style={styles.detailValue}>
          {user.is_verified
            ? tUi('ui.pages.admin.adminUserDetails.verified_ebcf9e3db7')
            : tUi('ui.pages.admin.adminUserDetails.notVerified_b491c0f754')}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminUserDetails.created_6f7a8b9c0d')}</Text>
        <Text style={styles.detailValue}>{formatDateTime(user.created_at)}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminUserDetails.phone_9225bd8c30')}</Text>
        <Text style={styles.detailValue}>
          {user.phone_number || tUi('ui.pages.admin.adminUserDetails.notProvided_3d4e5f6a7b')}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{tUi('ui.pages.admin.adminUserDetails.address_99019633c4')}</Text>
        <Text style={styles.detailValue}>
          {user.address || tUi('ui.pages.admin.adminUserDetails.notProvided_3d4e5f6a7b')}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={() => setShowRoleModal(true)}>
          <Text style={styles.secondaryButtonText}>
            {tUi('ui.pages.admin.adminUsers.changeRole_3f89e37f4b')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, styles.blockButton]}
          onPress={handleToggleBlock}
          disabled={updating}
        >
          <Text style={styles.secondaryButtonText}>
            {user.is_blocked
              ? tUi('ui.pages.admin.adminUsers.unblock_6cbc50835c')
              : tUi('ui.pages.admin.adminUsers.block_acca25213e')}
          </Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={updating}>
          <Text style={styles.deleteButtonText}>
            {tUi('ui.pages.admin.adminUsers.delete_a6a9493a15')}
          </Text>
        </Pressable>
      </View>

      <Modal transparent visible={showRoleModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRoleModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {tUi('ui.pages.admin.adminUsers.changeUserRole_086699c24a')}
            </Text>
            {ROLE_OPTIONS.map((role) => (
              <Pressable
                key={role}
                style={[
                  styles.roleOption,
                  selectedRole === role && styles.roleOptionActive,
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    selectedRole === role && styles.roleOptionTextActive,
                  ]}
                >
                  {getRoleLabel(role, language)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.primaryButton, updating && styles.buttonDisabled]}
              onPress={handleChangeRole}
              disabled={updating}
            >
              <Text style={styles.primaryButtonText}>
                {updating ? tUi('ui.mobile.common.saving') : tUi('ui.mobile.common.save')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceAlt,
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    marginTop: 6,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 16,
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  blockButton: {
    backgroundColor: colors.surfaceAlt,
  },
  deleteButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.danger,
  },
  deleteButtonText: {
    color: colors.surface,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  roleOption: {
    paddingVertical: 8,
  },
  roleOptionActive: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  roleOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  roleOptionTextActive: {
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default AdminUserDetailsScreen;
