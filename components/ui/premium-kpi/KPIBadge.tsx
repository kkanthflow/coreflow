import React from 'react';
import { View, Text } from 'react-native';
import { KPIBadgeData } from './types';

export const KPIBadge = React.memo(({ badge }: { badge?: KPIBadgeData }) => {
  if (!badge) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: `${badge.color}20`,
        borderWidth: 1,
        borderColor: `${badge.color}40`,
      }}
    >
      <Text
        style={{
          color: badge.color,
          fontSize: 9,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {badge.label}
      </Text>
    </View>
  );
});

KPIBadge.displayName = 'KPIBadge';
