import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';

const AiAssistantFab = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isRtl } = useRtlLayout();
  const tUi = useTUi();
  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom + 64;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        isRtl ? styles.wrapRtl : styles.wrapLtr,
        { bottom: bottomOffset },
      ]}
    >
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('AiAssistant')}
        accessibilityLabel={tUi('chat.toggleAria')}
      >
        <Feather name="message-circle" size={24} color="#fff" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 20,
  },
  wrapLtr: { right: 16 },
  wrapRtl: { left: 16 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});

export default AiAssistantFab;
