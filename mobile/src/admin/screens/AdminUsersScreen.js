import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AdminScreen from '../components/AdminScreen';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTUi } from '../../i18n/uiText';
import { useLanguage } from '../../context/LanguageContext';
import { getRoleLabel } from '../../i18n/roles';
import http from '../../services/http';
import { USER_ENDPOINTS } from '../../config/api';
import { buildImageUrl, formatDate } from '../utils/format';

const ROLE_FILTERS = [
  'all',
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

const AdminUsersScreen = () => {
  const { colors, shadow, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tUi = useTUi();
  const { language, isRtl } = useLanguage();

  const navigation = useNavigation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get(USER_ENDPOINTS.ALL);
      setUsers(response.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    let list = roleFilter === 'all' ? users : users.filter((user) => user.role === roleFilter);
    const term = searchQuery.trim().toLowerCase();
    if (term) {
      list = list.filter((user) => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const email = String(user.email || '').toLowerCase();
        return name.includes(term) || email.includes(term);
      });
    }
    return list;
  }, [roleFilter, searchQuery, users]);

  return (
    <AdminScreen
      title={tUi('ui.pages.admin.adminUsers.manageUsers_eac32c061d')}
      subtitle={tUi('ui.pages.admin.adminUsers.subtitle_1a2b3c4d5h')}
    >
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, isRtl && styles.searchInputRtl]}
          placeholder={tUi('ui.pages.admin.adminUsers.searchUsers_6f4c0b5424')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((role) => (
          <Pressable
            key={role}
            style={[styles.filterChip, roleFilter === role && styles.filterChipActive]}
            onPress={() => setRoleFilter(role)}
          >
            <Text style={[styles.filterText, roleFilter === role && styles.filterTextActive]}>
              {role === 'all'
                ? tUi('ui.pages.admin.adminUsers.all_934fce7d68')
                : getRoleLabel(role, language)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View>
          {filtered.map((user) => {
            const name =
              `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
              tUi('ui.mobile.common.unnamedUser');
            return (
              <Pressable
                key={user.id}
                style={styles.userRow}
                onPress={() => navigation.navigate('AdminUserDetails', { userId: user.id })}
              >
                <Image
                  source={{ uri: buildImageUrl(user.profile_image) }}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{name}</Text>
                  <Text style={styles.userMeta}>{user.email}</Text>
                  <Text style={styles.userMeta}>{formatDate(user.created_at)}</Text>
                </View>
                <View style={styles.userBadgeWrap}>
                  <Text style={styles.userBadge}>
                    {getRoleLabel(user.role || 'customer', language)}
                  </Text>
                  <Text style={styles.userStatus}>
                    {user.is_blocked
                      ? tUi('ui.mobile.common.blocked')
                      : tUi('ui.pages.admin.adminUsers.active_b157924ea3')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {!filtered.length ? (
            <Text style={styles.emptyText}>
              {searchQuery.trim() || roleFilter !== 'all'
                ? tUi('ui.pages.admin.adminUsers.noUsersMatchYourSearch_afa1ee1f27')
                : tUi('ui.pages.admin.adminUsers.noUsersFound_53cddce410')}
            </Text>
          ) : null}
        </View>
      )}
    </AdminScreen>
  );
};

const createStyles = ({ colors, shadow, isDark }) => StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
  },
  searchInputRtl: {
    marginLeft: 0,
    marginRight: 8,
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.surface,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  userMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  userBadgeWrap: {
    alignItems: 'flex-end',
  },
  userBadge: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  userStatus: {
    marginTop: 4,
    fontSize: 11,
    color: colors.muted,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
});

export default AdminUsersScreen;
