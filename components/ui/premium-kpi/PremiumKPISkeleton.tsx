import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';

export const PremiumKPISkeleton = React.memo(() => {
  const colors = useColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View
      style={{
        flex: 1,
        minWidth: 105,
        maxWidth: 130,
        aspectRatio: 0.85,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={[colors.surface, colors.background]}
        style={[StyleSheet.absoluteFill, { padding: 12, alignItems: 'center', justifyContent: 'center' }]}
      >
        <Animated.View style={[{ alignItems: 'center', width: '100%' }, pulseStyle]}>
          {/* Ring Placeholder */}
          <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            {/* Icon Box Placeholder */}
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </View>
          {/* Value Placeholder */}
          <View style={{ width: '40%', height: 24, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 8 }} />
          {/* Title Placeholder */}
          <View style={{ width: '70%', height: 12, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        </Animated.View>
      </LinearGradient>
    </View>
  );
});

PremiumKPISkeleton.displayName = 'PremiumKPISkeleton';
