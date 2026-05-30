import React, { useContext } from 'react';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerItemList } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../styles/theme';

import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminProductsScreen from '../screens/AdminProductsScreen';
import AdminOrdersScreen from '../screens/AdminOrdersScreen';
import AdminCategoriesScreen from '../screens/AdminCategoriesScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminUserDetailsScreen from '../screens/AdminUserDetailsScreen';
import AdminTicketsScreen from '../screens/AdminTicketsScreen';
import AdminCommentsScreen from '../screens/AdminCommentsScreen';
import AdminFeedbackScreen from '../screens/AdminFeedbackScreen';
import AdminDeliveriesScreen from '../screens/AdminDeliveriesScreen';
import AdminDiscountsScreen from '../screens/AdminDiscountsScreen';
import AdminPromotionsScreen from '../screens/AdminPromotionsScreen';
import AdminInstallmentsScreen from '../screens/AdminInstallmentsScreen';
import AdminPosAnalyticsScreen from '../screens/AdminPosAnalyticsScreen';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

const AdminDrawerContent = (props) => {
  const { logout } = useContext(AuthContext);

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Logout"
        icon={({ color, size }) => <Feather name="log-out" size={size} color={color} />}
        onPress={() => logout()}
      />
    </DrawerContentScrollView>
  );
};

const AdminDrawer = () => (
  <Drawer.Navigator
    initialRouteName="AdminDashboard"
    drawerContent={(props) => <AdminDrawerContent {...props} />}
    screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
      drawerActiveTintColor: colors.primary,
      drawerInactiveTintColor: colors.muted,
      drawerStyle: { backgroundColor: colors.surface },
    }}
  >
    <Drawer.Screen
      name="AdminDashboard"
      component={AdminDashboardScreen}
      options={{
        title: 'Dashboard',
        drawerIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminUsers"
      component={AdminUsersScreen}
      options={{
        title: 'Users',
        drawerIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminProducts"
      component={AdminProductsScreen}
      options={{
        title: 'Products',
        drawerIcon: ({ color, size }) => <Feather name="package" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminPromotions"
      component={AdminPromotionsScreen}
      options={{
        title: 'Promotions',
        drawerIcon: ({ color, size }) => <Feather name="tag" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminDiscounts"
      component={AdminDiscountsScreen}
      options={{
        title: 'Discounts',
        drawerIcon: ({ color, size }) => <Feather name="percent" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminCategories"
      component={AdminCategoriesScreen}
      options={{
        title: 'Categories',
        drawerIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminOrders"
      component={AdminOrdersScreen}
      options={{
        title: 'Orders',
        drawerIcon: ({ color, size }) => <Feather name="clipboard" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminInstallments"
      component={AdminInstallmentsScreen}
      options={{
        title: 'Installments',
        drawerIcon: ({ color, size }) => <Feather name="credit-card" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminDeliveries"
      component={AdminDeliveriesScreen}
      options={{
        title: 'Deliveries',
        drawerIcon: ({ color, size }) => <Feather name="truck" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminTickets"
      component={AdminTicketsScreen}
      options={{
        title: 'Tickets',
        drawerIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminComments"
      component={AdminCommentsScreen}
      options={{
        title: 'Reviews',
        drawerIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="AdminFeedback"
      component={AdminFeedbackScreen}
      options={{
        title: 'Feedback',
        drawerIcon: ({ color, size }) => <Feather name="star" size={size} color={color} />,
      }}
    />
  </Drawer.Navigator>
);

const AdminNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen name="AdminDrawer" component={AdminDrawer} options={{ headerShown: false }} />
    <Stack.Screen
      name="AdminUserDetails"
      component={AdminUserDetailsScreen}
      options={{ title: 'User Details' }}
    />
    <Stack.Screen
      name="AdminPosAnalytics"
      component={AdminPosAnalyticsScreen}
      options={{ title: 'POS Analytics' }}
    />
  </Stack.Navigator>
);

export default AdminNavigator;
