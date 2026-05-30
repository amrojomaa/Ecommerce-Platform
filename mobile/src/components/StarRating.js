import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { tUi } from '../i18n/uiText';

const sizeMap = {
  small: 12,
  medium: 14,
  large: 18,
};

const StarRating = ({
  averageRating = 0,
  totalRatings = 0,
  showLabel = true,
  size = 'medium',
}) => {
  const rating = Number(averageRating) || 0;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const starSize = sizeMap[size] || sizeMap.medium;

  const renderStar = (index) => {
    if (index < fullStars) {
      return <FontAwesome key={`full-${index}`} name="star" size={starSize} color="#FBBF24" />;
    }
    if (index === fullStars && hasHalfStar) {
      return <FontAwesome key="half" name="star-half-o" size={starSize} color="#FBBF24" />;
    }
    return <FontAwesome key={`empty-${index}`} name="star-o" size={starSize} color="#FBBF24" />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.stars}>{[0, 1, 2, 3, 4].map(renderStar)}</View>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.labelValue}>{rating.toFixed(1)}</Text>
          {totalRatings > 0 ? (
            <Text style={styles.labelCount}>
              ({totalRatings} {totalRatings === 1 ? tUi('ui.components.starRating.rating_5bd901ae20') : tUi('ui.components.starRating.ratings_8aa35770e7')})
            </Text>
          ) : (
            <Text style={styles.labelCount}>{tUi('ui.components.starRating.noRatingsYet_94fd652938')}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  labelValue: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 12,
  },
  labelCount: {
    color: '#94A3B8',
    fontSize: 12,
  },
});

export default StarRating;
