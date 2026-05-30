import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomerHeaderActions from './CustomerHeaderActions';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';

const CustomerScreen = ({
  kicker,
  title,
  subtitle,
  action,
  children,
  scroll = true,
  showBack = false,
  contentContainerStyle,
}) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { textAlign, row, isRtl } = useRtlLayout();

  const header = (
    <View style={styles.header}>
      {showBack && navigation.canGoBack() ? (
        <Pressable
          style={[styles.backRow, { flexDirection: row }]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Feather
            name={isRtl ? 'chevron-right' : 'chevron-left'}
            size={22}
            color={colors.primary}
          />
        </Pressable>
      ) : null}
      <View style={[styles.headerTop, { flexDirection: row }]}>
        <View style={styles.headerCopy}>
          {kicker ? (
            <Text style={[styles.kicker, { textAlign, color: colors.primary }]}>{kicker}</Text>
          ) : null}
          {title ? <Text style={[styles.title, { textAlign, color: colors.text }]}>{title}</Text> : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { textAlign, color: colors.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
        <CustomerHeaderActions />
      </View>
      {action ? <View style={styles.actionRow}>{action}</View> : null}
    </View>
  );

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        {header}
        <View style={[styles.body, contentContainerStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ shadow }) =>
  StyleSheet.create({
    safe: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 28 },
    body: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
    header: { marginBottom: 16, paddingTop: 8 },
    backRow: {
      alignItems: 'center',
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    headerTop: {
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    headerCopy: { flex: 1, paddingRight: 8 },
    kicker: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      maxWidth: 640,
    },
    actionRow: {
      marginTop: 4,
    },
  });

export default CustomerScreen;
