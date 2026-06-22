import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface GradientButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'success' | 'analytics' | 'danger';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const GRADIENTS = {
  primary:   { from: '#FF6B4A', to: '#FFA86B' },
  success:   { from: '#34D399', to: '#10B981' },
  analytics: { from: '#60A5FA', to: '#8B5CF6' },
  danger:    { from: '#F87171', to: '#EF4444' },
};

export function GradientButton({
  onPress,
  disabled = false,
  loading = false,
  children,
  style,
  size = 'md',
  variant = 'primary',
  fullWidth = false,
  icon,
}: GradientButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const grad = GRADIENTS[variant];

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: false, tension: 300, friction: 10 }),
      Animated.timing(glowAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: false, tension: 300, friction: 10 }),
      Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
    md: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16 },
    lg: { paddingVertical: 18, paddingHorizontal: 32, borderRadius: 18 },
    xl: { paddingVertical: 20, paddingHorizontal: 40, borderRadius: 20 },
  };

  const textSizes = { sm: 13, md: 15, lg: 17, xl: 19 };

  const shadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });
  const shadowRadius  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 20] });

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        { shadowColor: grad.from, shadowOffset: { width: 0, height: 4 }, shadowOpacity, shadowRadius, elevation: 8 },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          sizeStyles[size],
          {
            backgroundColor: disabled ? '#5A5A70' : grad.from,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          },
        ]}
      >
        {/* Gradient overlay effect */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: sizeStyles[size].borderRadius,
              backgroundColor: grad.to,
              opacity: 0.4,
            },
          ]}
          pointerEvents="none"
        />
        {icon && <View>{icon}</View>}
        {typeof children === 'string' ? (
          <Text style={{ color: '#FFFFFF', fontSize: textSizes[size], fontWeight: '700', letterSpacing: 0.2 }}>
            {loading ? 'Loading...' : children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    </Animated.View>
  );
}
