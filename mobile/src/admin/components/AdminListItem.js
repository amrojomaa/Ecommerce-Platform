import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../styles/theme';

const AdminListItem = ({ title, subtitle, meta, status, statusTone = 'default', right, onPress }) => {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.card} onPress={onPress}>
      <View style={styles.main}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
      {status ? (
        <View style={[styles.statusPill, statusStyles[statusTone] || statusStyles.default]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  main: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textBlock: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
  },
  right: {
    alignItems: 'flex-end',
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 10,
  },
  statusText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
});

const statusStyles = {
  default: { backgroundColor: colors.primary },
  success: { backgroundColor: colors.success },
  warning: { backgroundColor: colors.warning },
  danger: { backgroundColor: colors.danger },
};

export default AdminListItem;
