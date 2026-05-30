import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { buildImageUrl } from '../utils/format';

const getInitials = (user) => {
  const first = user?.first_name?.[0] || '';
  const last = user?.last_name?.[0] || '';
  const initials = `${first}${last}`.trim();
  if (initials) return initials.toUpperCase();
  return (user?.email?.[0] || '?').toUpperCase();
};

const TicketUserAvatar = ({ user, size = 40, style }) => {
  const { colors, isDark } = useTheme();
  const imageUrl = useMemo(() => buildImageUrl(user?.profile_image), [user?.profile_image]);
  const fontSize = Math.max(12, Math.round(size * 0.38));

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.border,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? `${colors.primary}33` : '#EEF2FF',
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize, color: colors.primary }]}>{getInitials(user)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
});

export default TicketUserAvatar;
