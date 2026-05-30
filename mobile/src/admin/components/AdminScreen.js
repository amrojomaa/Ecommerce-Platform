import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useTUi } from '../../i18n/uiText';

const AdminScreen = ({ kicker, title, subtitle, meta, action, children }) => {
  const styles = useThemedStyles(createStyles);
  const { isRtl, textAlign, row } = useRtlLayout();
  const tUi = useTUi();
  const kickerLabel = kicker ?? tUi('ui.sidebar.panel.admin');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { flexDirection: row }]}>
          <View style={[styles.headerText, isRtl ? styles.headerTextRtl : null]}>
            {kickerLabel ? <Text style={[styles.kicker, { textAlign }]}>{kickerLabel}</Text> : null}
            <Text style={[styles.title, { textAlign }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { textAlign }]}>{subtitle}</Text> : null}
            {meta ? <Text style={[styles.meta, { textAlign }]}>{meta}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    headerText: {
      flex: 1,
      paddingRight: 12,
    },
    headerTextRtl: {
      paddingRight: 0,
      paddingLeft: 12,
    },
    kicker: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      marginTop: 4,
    },
    meta: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 8,
    },
    action: {
      alignSelf: 'center',
    },
  });

export default AdminScreen;
