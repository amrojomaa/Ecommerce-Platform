import React, { useContext } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AdminNavigator from '../admin/navigation/AdminNavigator';
import CustomerNavigator from '../customer/navigation/CustomerNavigator';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { loading, hasPanelAccess, isAuthenticated } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const showPanelApp = isAuthenticated && hasPanelAccess();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showPanelApp ? (
          <Stack.Screen name="AdminApp" component={AdminNavigator} />
        ) : (
          <Stack.Screen name="CustomerApp" component={CustomerNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
