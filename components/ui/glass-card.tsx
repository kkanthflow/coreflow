import React, { useEffect } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SHADOW = '#000000A0';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
  intensity?: 'light' | 'medium' | 'strong';
  padding?: number;
  radius?: number;
  noBorder?: boolean;
  bob?: boolean;
  bobDelay?: number;
  bobDepth?: number;
}

export function GlassCard({
  children,
  style,
  glowColor,
  intensity = 'medium',
  padding = 20,
  radius = 20,
  noBorder = false,
  bob = false,
  bobDelay = 0,
  bobDepth = 3,
}: GlassCardProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const translateY = useSharedValue(0);

  useEffect(() => {
    if (bob) {
      // Loop the translation infinitely (reverses on repeat)
      translateY.value = withDelay(
        bobDelay,
        withRepeat(
          withSequence(
            withTiming(-bobDepth, { duration: 1200 }),
            withTiming(bobDepth, { duration: 1200 })
          ),
          -1,
          true
        )
      );
    } else {
      translateY.value = 0;
    }
  }, [bob, bobDelay, bobDepth]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const overlayOpacity = {
    light: 0.03,
    medium: 0.05,
    strong: 0.08,
  }[intensity];

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius,
          padding,
          borderWidth: noBorder ? 0 : 1,
          borderColor: glowColor ? `${glowColor}30` : colors.border,
          shadowColor: glowColor || SHADOW,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: glowColor ? 0.3 : 0.35,
          shadowRadius: glowColor ? 18 : 16,
          elevation: 8,
          overflow: 'hidden',
        },
        style,
        bob ? animatedStyle : null,
      ]}
    >
      {/* Premium Glass Gradient Shimmer */}
      <LinearGradient
        colors={[
          isDark ? `rgba(255,255,255,${overlayOpacity * 1.5})` : `rgba(0,0,0,${overlayOpacity * 0.5})`,
          isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </Animated.View>
  );
}
