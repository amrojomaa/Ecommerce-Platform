import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTUi } from '../../i18n/uiText';
import { useCart } from '../../hooks/useCart';
import HomeScreen from '../screens/HomeScreen';
import ProductsScreen from '../screens/ProductsScreen';
import CartScreen from '../screens/CartScreen';
import AccountScreen from '../screens/AccountScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import PaymentScreen from '../screens/PaymentScreen';
import OrdersScreen from '../screens/OrdersScreen';
import WishlistScreen from '../screens/WishlistScreen';
import TicketsScreen from '../screens/TicketsScreen';
import InstallmentsScreen from '../screens/InstallmentsScreen';
import RecommendationsScreen from '../screens/RecommendationsScreen';
import CustomerProfileScreen from '../screens/CustomerProfileScreen';
import AboutScreen from '../screens/AboutScreen';
import AiAssistantScreen from '../screens/AiAssistantScreen';
import AiAssistantFab from '../components/AiAssistantFab';
import LoginScreen from '../../screens/LoginScreen';
import SignupScreen from '../../screens/SignupScreen';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';
import VerifyResetCodeScreen from '../../screens/VerifyResetCodeScreen';
import ResetPasswordScreen from '../../screens/ResetPasswordScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabBadge = ({ count, isRtl }) => {
  if (!count) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        ...(isRtl ? { left: -8 } : { right: -8 }),
        minWidth: 18,
        height: 18,
        borderRadius: 999,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const CustomerTabs = () => {
  const { colors } = useTheme();
  const { isRtl } = useLanguage();
  const tUi = useTUi();
  const { cartCount } = useCart();

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: tUi('ui.mobile.customer.tabs.home'),
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          tabBarLabel: tUi('ui.mobile.customer.tabs.shop'),
          tabBarIcon: ({ color, size }) => <Feather name="grid" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: tUi('ui.mobile.customer.tabs.cart'),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Feather name="shopping-cart" color={color} size={size} />
              <TabBadge count={cartCount} isRtl={isRtl} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarLabel: tUi('ui.mobile.customer.tabs.account'),
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
    <AiAssistantFab />
    </View>
  );
};

const CustomerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
    <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} />
    <Stack.Screen name="Payment" component={PaymentScreen} />
    <Stack.Screen name="Orders" component={OrdersScreen} />
    <Stack.Screen name="Wishlist" component={WishlistScreen} />
    <Stack.Screen name="Tickets" component={TicketsScreen} />
    <Stack.Screen name="Installments" component={InstallmentsScreen} />
    <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
    <Stack.Screen name="Profile" component={CustomerProfileScreen} />
    <Stack.Screen name="About" component={AboutScreen} />
    <Stack.Screen name="AiAssistant" component={AiAssistantScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
  </Stack.Navigator>
);

export default CustomerNavigator;
