import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';

const SHADOW    = '#00000080';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
  intensity?: 'light' | 'medium' | 'strong';
  padding?: number;
  radius?: number;
  noBorder?: boolean;
}

export function GlassCard({
  children,
  style,
  glowColor,
  intensity = 'medium',
  padding = 20,
  radius = 20,
  noBorder = false,
}: GlassCardProps) {
  const colors = useColors();
  const overlayOpacity = {
    light: 0.04,
    medium: 0.06,
    strong: 0.10,
  }[intensity];

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius,
          padding,
          borderWidth: noBorder ? 0 : 1,
          borderColor: glowColor ? `${glowColor}30` : colors.border,
          shadowColor: glowColor || SHADOW,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: glowColor ? 0.25 : 0.15,
          shadowRadius: glowColor ? 16 : 8,
          elevation: 6,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Glass overlay shimmer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: `rgba(255,255,255,${overlayOpacity})`,
            borderRadius: radius,
          },
        ]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
