import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { PremiumKPIProps } from './types';
import { getStatusColors } from './constants';
import { KPIRing } from './KPIRing';
import { KPIBadge } from './KPIBadge';
import { KPITrend } from './KPITrend';
import { PremiumKPISkeleton } from './PremiumKPISkeleton';
import { MotionTokens } from './animations';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PremiumKPI = React.memo(({
  data,
  icon,
  variant = 'default',
  onPress,
  isLoading = false,
  disabled = false,
  testID,
  style,
}: PremiumKPIProps) => {
  const colors = useColors();
  const { user } = useAuth();

  const statusColors = getStatusColors(data.status, colors);
  const activeColor = statusColors.accent;

  // Shared values for micro-interactions
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  if (isLoading) {
    return <PremiumKPISkeleton />;
  }

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.97, MotionTokens.KPI.Press);
    iconScale.value = withSpring(1.05, MotionTokens.KPI.Press);
    
    const hapticEnabled = user?.preferences?.hapticFeedback ?? true;
    if (hapticEnabled && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, MotionTokens.KPI.Press);
    iconScale.value = withSpring(1, MotionTokens.KPI.Press);
  };

  // Resolve sizes based on variant
  const isCompact = variant === 'compact';
  const isMinimal = variant === 'minimal';
  
  const cardWidth = isCompact ? 100 : '31%';
  const cardAspectRatio = isCompact ? 0.9 : 0.85;

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: isLoading }}
      accessibilityLabel={`${data.title}, ${data.value}`}
      accessibilityHint={onPress ? "Double tap to open details" : undefined}
      style={[
        {
          width: cardWidth as any,
          aspectRatio: cardAspectRatio,
          minWidth: isCompact ? 95 : 105,
          maxWidth: isCompact ? 120 : 130,
          borderRadius: 32,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 4,
        },
        animatedStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={[colors.surface, colors.background]}
        style={StyleSheet.absoluteFill}
      >
        <View style={{ flex: 1, padding: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Circular Status Ring & Floating Icon Box */}
          <View style={{ width: 68, height: 68, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            {data.progress !== undefined && data.progress !== null && data.progress > 0 && (
              <View style={StyleSheet.absoluteFill}>
                <KPIRing
                  progress={data.progress}
                  size={68}
                  strokeWidth={4}
                  color={activeColor}
                />
              </View>
            )}
            
            {/* Floating Glass Icon Capsule */}
            <Animated.View
              style={[
                {
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                },
                iconAnimatedStyle
              ]}
            >
              {icon}
            </Animated.View>
          </View>

          {/* Metric details */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            {/* Value */}
            <Text
              style={{
                color: colors.foreground || '#FFFFFF',
                fontSize: isCompact ? 28 : 34,
                fontWeight: '700',
                letterSpacing: -1,
              }}
              numberOfLines={1}
            >
              {data.value ?? '—'}
            </Text>

            {/* Label */}
            <Text
              style={{
                color: colors.foreground,
                fontSize: isCompact ? 13 : 15,
                fontWeight: '600',
                marginTop: 2,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {data.title}
            </Text>

            {/* Optional Subtitle / Footer */}
            {data.subtitle ? (
              <Text
                style={{
                  color: colors.foreground ? `${colors.foreground}aa` : 'rgba(255, 255, 255, 0.7)',
                  fontSize: 11,
                  fontWeight: '500',
                  marginTop: 2,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {data.subtitle}
              </Text>
            ) : data.footer ? (
              <View style={{ marginTop: 2 }}>{data.footer}</View>
            ) : null}

            {/* Trend / Badge Support */}
            {data.trend && <KPITrend trend={data.trend} color={activeColor} />}
            {data.badge && <KPIBadge badge={data.badge} />}
          </View>

          {/* Bottom Accent Glow Capsule */}
          <View
            style={{
              width: 32,
              height: 6,
              borderRadius: 999,
              backgroundColor: activeColor,
              marginBottom: 2,
            }}
          />

        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
});

PremiumKPI.displayName = 'PremiumKPI';
