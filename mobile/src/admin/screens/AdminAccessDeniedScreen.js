import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../styles/theme';

const AdminAccessDeniedScreen = () => {
  const { logout } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Access Required</Text>
      <Text style={styles.subtitle}>
        Your account does not have access to the admin workspace.
      </Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '700',
  },
});

export default AdminAccessDeniedScreen;
