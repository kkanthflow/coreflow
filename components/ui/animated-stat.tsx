import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';


interface AnimatedStatProps {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  suffix?: string;
  prefix?: string;
  style?: ViewStyle;
  isCurrency?: boolean;
}

export function AnimatedStat({
  value,
  label,
  icon,
  color,
  suffix = '',
  prefix = '',
  style,
  isCurrency = false,
}: AnimatedStatProps) {
  const colors = useColors();
  const animValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const displayValue = useRef(0);
  const [displayText, setDisplayText] = React.useState('0');

  const accentColor = color || colors.primary;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.timing(animValue, {
      toValue: value,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    const listener = animValue.addListener(({ value: v }) => {
      const rounded = Math.round(v);
      if (isCurrency) {
        setDisplayText(rounded.toLocaleString());
      } else {
        setDisplayText(String(rounded));
      }
    });

    return () => animValue.removeListener(listener);
  }, [value]);

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          backgroundColor: colors.card || colors.surface,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'flex-start',
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 4,
        },
        style,
      ]}
    >
      {/* Icon bg */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${accentColor}20`,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>

      {/* Glow dot */}
      <View
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: accentColor,
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
        }}
      />

      <Text
        style={{
          color: colors.foreground,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.5,
          marginBottom: 4,
        }}
      >
        {prefix}{displayText}{suffix}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
