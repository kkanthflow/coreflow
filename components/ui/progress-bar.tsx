import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';

interface ProgressBarProps {
  progress: number; // 0 to 100
  showLabel?: boolean;
  height?: number;
  color?: string;
}

export function ProgressBar({ progress, showLabel = false, height = 8, color }: ProgressBarProps) {
  const colors = useColors();
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const widthValue = useSharedValue(0);

  useEffect(() => {
    widthValue.value = withSpring(clampedProgress, { damping: 15 });
  }, [clampedProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${widthValue.value}%`,
    };
  });

  const barColor = color || colors.primary;

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.labelText, { color: colors.muted }]}>Progress</Text>
          <Text style={[styles.valueText, { color: colors.foreground }]}>{Math.round(clampedProgress)}%</Text>
        </View>
      )}
      <View style={[styles.bgBar, { height, borderRadius: height / 2, backgroundColor: colors.border }]}>
        <Animated.View 
          style={[
            styles.fillBar, 
            { 
              height, 
              borderRadius: height / 2, 
              backgroundColor: barColor 
            }, 
            animatedStyle
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  valueText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bgBar: {
    width: '100%',
    overflow: 'hidden',
  },
  fillBar: {
    width: 0,
  },
});
