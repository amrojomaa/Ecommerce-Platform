import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useTUi } from '../../i18n/uiText';

const AdminThemeToggleButton = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const tUi = useTUi();

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={toggleTheme}
      accessibilityLabel={tUi('ui.mobile.theme.toggle')}
      hitSlop={8}
    >
      <Feather name={isDark ? 'sun' : 'moon'} size={20} color={colors.text} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.65,
  },
});

export default AdminThemeToggleButton;
