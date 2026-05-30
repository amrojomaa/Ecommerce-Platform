import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

const AdminScreen = ({ kicker = 'Admin', title, subtitle, meta, action, children }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
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
