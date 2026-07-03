import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

interface AIInsightBannerProps {
  title?: string;
  insight: string;
  score?: number;
  onPress?: () => void;
}

export function AIInsightBanner({ title = 'AI Insight', insight, score, onPress }: AIInsightBannerProps) {
  const colors = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Continuous pulse on AI icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: fadeAnim,
        marginBottom: 20,
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#FF6B4A40',
            shadowColor: '#FF6B4A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 6,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {/* Gradient top-left glow */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 20,
              backgroundColor: '#FF6B4A08',
            },
          ]}
          pointerEvents="none"
        />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          {/* AI Icon with pulse */}
          <Animated.View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: '#FF6B4A20',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#FF6B4A40',
              transform: [{ scale: pulseAnim }],
              shadowColor: '#FF6B4A',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            }}
          >
            <Ionicons name="sparkles" size={22} color="#FF6B4A" />
          </Animated.View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: '#FF6B4A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                {title}
              </Text>
              {score !== undefined && (
                <View style={{ backgroundColor: '#FF6B4A20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ color: '#FF6B4A', fontSize: 12, fontWeight: '800' }}>
                    {score}%
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>
              {insight}
            </Text>
          </View>
        </View>

        {onPress && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
            <Text style={{ color: '#FF6B4A', fontSize: 12, fontWeight: '600' }}>View details</Text>
            <Ionicons name="arrow-forward" size={13} color="#FF6B4A" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
