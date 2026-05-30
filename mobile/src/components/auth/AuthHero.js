import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRtlLayout } from '../../hooks/useRtlLayout';

const AuthHero = ({ kicker, title, subtitle, benefits = [], styles }) => {
  const { row, textAlign } = useRtlLayout();

  return (
    <View style={styles.hero}>
      <View style={styles.heroInner}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: '#2563eb',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: '#0f172a',
            opacity: 0.55,
          }}
        />
        <View style={{ gap: 10, zIndex: 1 }}>
          {kicker ? (
            <Text style={[styles.heroKicker, { textAlign }]}>{kicker}</Text>
          ) : null}
          {title ? (
            <Text style={[styles.heroTitle, { textAlign }]}>{title}</Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.heroSubtitle, { textAlign }]}>{subtitle}</Text>
          ) : null}
        </View>

        {benefits.length ? (
          <View style={[styles.benefits, { zIndex: 1 }]}>
            {benefits.map((benefit) => (
              <View key={benefit.key} style={[styles.benefitRow, { flexDirection: row }]}>
                <View style={styles.benefitIcon}>
                  <Feather name={benefit.icon} size={18} color="#fff" />
                </View>
                <View style={styles.benefitCopy}>
                  <Text style={[styles.benefitLabel, { textAlign }]}>{benefit.label}</Text>
                  {benefit.description ? (
                    <Text style={[styles.benefitDesc, { textAlign }]}>{benefit.description}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default AuthHero;
