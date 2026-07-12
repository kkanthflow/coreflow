import React from 'react';
import { View, Text } from 'react-native';
import { KPITrendData } from './types';

export const KPITrend = React.memo(({ trend, color }: { trend?: KPITrendData; color: string }) => {
  if (!trend) return null;
  const isUp = trend.direction === 'up';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '800' }}>
        {isUp ? '▲' : '▼'} {trend.value}%
      </Text>
    </View>
  );
});

KPITrend.displayName = 'KPITrend';
