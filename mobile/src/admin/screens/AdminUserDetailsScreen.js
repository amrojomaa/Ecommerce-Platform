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
import AdminScreen from '../components/AdminScreen';
import { colors } from '../styles/theme';
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
  const { userId } = route.params || {};
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('customer');
  const [updating, setUpdating] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await http.get(buildUrl(USER_ENDPOINTS.BY_ID, { id: userId }));
      setUser(response.data || null);
      setSelectedRole(response.data?.role || 'customer');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!user) return;
    const nextBlocked = !user.is_blocked;
    const ok = await confirmAction(
      nextBlocked ? 'Suspend user' : 'Unblock user',
      nextBlocked
        ? 'Suspend this account?'
        : 'Reactivate this account?'
    );
    if (!ok) return;
    setUpdating(true);
    try {
      const response = await http.patch(buildUrl(USER_ENDPOINTS.UPDATE_BLOCK, { id: user.id }), {
        is_blocked: nextBlocked,
      });
      setUser((prev) => (prev ? { ...prev, ...response.data } : prev));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    const ok = await confirmAction('Delete user', 'This cannot be undone.');
    if (!ok) return;
    setUpdating(true);
    try {
      await http.delete(buildUrl(USER_ENDPOINTS.DELETE, { id: user.id }));
      navigation.goBack();
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <AdminScreen title="User Details" subtitle="Review account information.">
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AdminScreen>
    );
  }

  if (!user) {
    return (
      <AdminScreen title="User Details" subtitle="Review account information.">
        <Text style={styles.emptyText}>User not found.</Text>
      </AdminScreen>
    );
  }

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed User';

  return (
    <AdminScreen title="User Details" subtitle="Review account information.">
      <View style={styles.headerCard}>
        <Image source={{ uri: buildImageUrl(user.profile_image) }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{fullName}</Text>
          <Text style={styles.headerMeta}>{user.email}</Text>
          <Text style={styles.headerMeta}>{user.role}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Status</Text>
        <Text style={styles.detailValue}>{user.is_blocked ? 'Blocked' : 'Active'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Verified</Text>
        <Text style={styles.detailValue}>{user.is_verified ? 'Yes' : 'No'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Created</Text>
        <Text style={styles.detailValue}>{formatDateTime(user.created_at)}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Phone</Text>
        <Text style={styles.detailValue}>{user.phone_number || 'Not provided'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Address</Text>
        <Text style={styles.detailValue}>{user.address || 'Not provided'}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={() => setShowRoleModal(true)}>
          <Text style={styles.secondaryButtonText}>Change role</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, styles.blockButton]}
          onPress={handleToggleBlock}
          disabled={updating}
        >
          <Text style={styles.secondaryButtonText}>
            {user.is_blocked ? 'Unblock' : 'Block'}
          </Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={updating}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>

      <Modal transparent visible={showRoleModal} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRoleModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Select role</Text>
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
                  {role.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.primaryButton, updating && styles.buttonDisabled]}
              onPress={handleChangeRole}
              disabled={updating}
            >
              <Text style={styles.primaryButtonText}>
                {updating ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
