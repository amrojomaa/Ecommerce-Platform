import React from 'react';
import { StyleSheet, View } from 'react-native';

const Skeleton = ({ width, height, style }) => {
  return <View style={[styles.base, { width, height }, style]} />;
};

export const ProductCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <Skeleton height={180} style={styles.image} />
      <View style={styles.content}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} />
        <Skeleton width="40%" height={16} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    opacity: 0.6,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  image: {
    width: '100%',
  },
  content: {
    padding: 14,
    gap: 8,
  },
});

export default Skeleton;
