import React, { useEffect, useState } from 'react';
import { View, Animated } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  className,
}: SkeletonProps) {
  const colors = useColors();
  const [shimmerAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={{
        width: typeof width === 'number' ? width : '100%',
        height: typeof height === 'number' ? height : 20,
        borderRadius,
        backgroundColor: colors.surface,
        opacity,
      }}
      className={className}
    />
  );
}

interface SkeletonListProps {
  count?: number;
  itemHeight?: number;
  gap?: number;
}

export function SkeletonList({ count = 5, itemHeight = 60, gap = 12 }: SkeletonListProps) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={itemHeight} borderRadius={12} />
      ))}
    </View>
  );
}
