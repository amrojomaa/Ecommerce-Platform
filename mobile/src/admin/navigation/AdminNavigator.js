import React, { useContext, useMemo } from 'react';
import { Text, View } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerItemList } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTUi } from '../../i18n/uiText';
import {
  getDefaultDrawerRouteForRole,
  getDrawerScreensForRole,
} from '../config/menuItems';
import AdminDrawerControls from '../components/AdminDrawerControls';
import AdminThemeToggleButton from '../components/AdminThemeToggleButton';
import AdminUserDetailsScreen from '../screens/AdminUserDetailsScreen';
import { useUnreadTickets } from '../../hooks/useUnreadTickets';
import { useDeliveryIssueCount } from '../../hooks/useDeliveryIssueCount';
import { useDeliveryPhotoCount } from '../../hooks/useDeliveryPhotoCount';
import { usePendingInstallmentCount } from '../../hooks/usePendingInstallmentCount';
import { useReportedCommentCount } from '../../hooks/useReportedCommentCount';
import { useWarehouseApprovalCount } from '../../hooks/useWarehouseApprovalCount';
import { useWarehouseOpenIssueCount } from '../../hooks/useWarehouseOpenIssueCount';
import { useWarehousePreparingCount } from '../../hooks/useWarehousePreparingCount';
import { useSellerPaidOrderCount } from '../../hooks/useSellerPaidOrderCount';
import { useDriverAvailableJobCount, useDriverActiveJobCount } from '../../hooks/useDriverJobCounts';
import { usePanelRole } from '../hooks/usePanelRole';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

const DrawerBadge = ({ count, colors }) => {
  if (!count) return null;
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 999,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#dc2626',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const getBadgeCount = (
  screenName,
  unreadTickets,
  deliveriesBadge,
  pendingInstallments,
  reportedComments,
  warehouseApprovals,
  warehouseIssues,
  warehousePreparing,
  sellerPaidOrders,
  driverAvailableJobs,
  driverActiveJobs
) => {
  if (screenName === 'AdminTickets' || screenName === 'SupportAgentTickets') return unreadTickets;
  if (screenName === 'AdminDeliveries') return deliveriesBadge;
  if (screenName === 'AdminInstallments') return pendingInstallments;
  if (screenName === 'SupportManagerComments') return reportedComments;
  if (screenName === 'WarehouseApprovals') return warehouseApprovals;
  if (screenName === 'WarehouseIssues') return warehouseIssues;
  if (screenName === 'WarehouseStaffOrders') return warehousePreparing;
  if (screenName === 'SellerOrders') return sellerPaidOrders;
  if (screenName === 'DriverMap') return driverAvailableJobs;
  if (screenName === 'DriverActiveJob') return driverActiveJobs;
  return 0;
};

const AdminDrawerContent = (props) => {
  const { logout, user } = useContext(AuthContext);
  const { colors } = useTheme();
  const { isRtl } = useLanguage();
  const tUi = useTUi();
  const { panelKicker } = usePanelRole();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text
          style={{
            color: colors.primary,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {panelKicker}
        </Text>
        {user?.email ? (
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              marginTop: 4,
              textAlign: isRtl ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {user.email}
          </Text>
        ) : null}
      </View>
      <DrawerItemList {...props} />
      <AdminDrawerControls />
      <DrawerItem
        label={tUi('ui.mobile.nav.logout')}
        icon={({ color, size }) => <Feather name="log-out" size={size} color={color} />}
        onPress={() => logout()}
        labelStyle={{ color: colors.text }}
      />
    </DrawerContentScrollView>
  );
};

const AdminDrawer = () => {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const { language, isRtl } = useLanguage();
  const tUi = useTUi();
  const { unreadCount } = useUnreadTickets();
  const { issueCount } = useDeliveryIssueCount();
  const { photoCount } = useDeliveryPhotoCount();
  const { pendingCount } = usePendingInstallmentCount();
  const { reportedCount } = useReportedCommentCount();
  const { approvalCount } = useWarehouseApprovalCount();
  const { openIssueCount } = useWarehouseOpenIssueCount();
  const { preparingCount } = useWarehousePreparingCount();
  const { paidOrderCount } = useSellerPaidOrderCount();
  const { availableCount: driverAvailableJobs } = useDriverAvailableJobCount();
  const { activeCount: driverActiveJobs } = useDriverActiveJobCount();
  const deliveriesBadge = issueCount + photoCount;

  const drawerScreens = useMemo(
    () => getDrawerScreensForRole(user?.role),
    [user?.role]
  );
  const initialRouteName = useMemo(
    () => getDefaultDrawerRouteForRole(user?.role),
    [user?.role]
  );

  return (
    <Drawer.Navigator
      key={`${language}-${user?.role || 'admin'}`}
      initialRouteName={initialRouteName}
      drawerContent={(props) => <AdminDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.muted,
        drawerStyle: { backgroundColor: colors.surface },
        drawerLabelStyle: { color: colors.text, textAlign: isRtl ? 'right' : 'left' },
        drawerPosition: isRtl ? 'right' : 'left',
        headerRight: () => <AdminThemeToggleButton />,
      }}
    >
      {drawerScreens.map(({ name, component, titleKey, icon }) => {
        const badgeCount = getBadgeCount(
          name,
          unreadCount,
          deliveriesBadge,
          pendingCount,
          reportedCount,
          approvalCount,
          openIssueCount,
          preparingCount,
          paidOrderCount,
          driverAvailableJobs,
          driverActiveJobs
        );
        const label = tUi(titleKey);
        return (
          <Drawer.Screen
            key={name}
            name={name}
            component={component}
            options={{
              title: label,
              headerShown: name !== 'CashierPosTerminal',
              drawerIcon: ({ color, size }) => <Feather name={icon} size={size} color={color} />,
              drawerLabel: ({ color, focused }) => (
                <View
                  style={{
                    flex: 1,
                    flexDirection: isRtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingRight: isRtl ? 0 : 8,
                    paddingLeft: isRtl ? 8 : 0,
                  }}
                >
                  <Text
                    style={{
                      color,
                      fontWeight: focused ? '700' : '500',
                      fontSize: 14,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  <DrawerBadge count={badgeCount} colors={colors} />
                </View>
              ),
            }}
          />
        );
      })}
    </Drawer.Navigator>
  );
};

const AdminNavigator = () => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const tUi = useTUi();

  return (
    <Stack.Navigator
      key={language}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        contentStyle: { backgroundColor: colors.background },
        headerRight: () => <AdminThemeToggleButton />,
      }}
    >
      <Stack.Screen name="AdminDrawer" component={AdminDrawer} options={{ headerShown: false }} />
      <Stack.Screen
        name="AdminUserDetails"
        component={AdminUserDetailsScreen}
        options={{ title: tUi('ui.mobile.nav.userDetails') }}
      />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
