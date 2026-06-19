import React, { useEffect, useState } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/use-colors';

const CARD_BG = '#181822';
const BORDER  = '#2A2A3A';

interface ShimmerLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function ShimmerLoader({ width = '100%', height = 20, borderRadius = 8, style }: ShimmerLoaderProps) {
  const colors = useColors();
  const [shimmerAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_BG, BORDER],
  });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor },
        style,
      ]}
    />
  );
}

interface ShimmerCardProps {
  style?: ViewStyle;
}

export function ShimmerCard({ style }: ShimmerCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: CARD_BG,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: BORDER,
          marginBottom: 16,
        },
        style,
      ]}
    >
      <ShimmerLoader height={14} width="50%" borderRadius={6} style={{ marginBottom: 12 }} />
      <ShimmerLoader height={24} width="70%" borderRadius={6} style={{ marginBottom: 8 }} />
      <ShimmerLoader height={12} width="90%" borderRadius={6} style={{ marginBottom: 6 }} />
      <ShimmerLoader height={12} width="80%" borderRadius={6} />
    </View>
  );
}
