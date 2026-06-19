import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface HealthRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showPercent?: boolean;
}

export function HealthRing({
  progress,
  size = 72,
  strokeWidth = 6,
  color = '#FF6B4A',
  label,
  showPercent = true,
}: HealthRingProps) {
  const animProgress = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = React.useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: progress,
      duration: 1400,
      useNativeDriver: false,
    }).start();

    const listener = animProgress.addListener(({ value }) => {
      setDisplayProgress(Math.round(value));
    });
    return () => animProgress.removeListener(listener);
  }, [progress]);

  const strokeDashoffset = circumference - (displayProgress / 100) * circumference;

  // Color based on health
  const ringColor =
    progress >= 70 ? '#34D399' :
    progress >= 40 ? '#FBBF24' :
    '#F87171';

  const finalColor = color === '#FF6B4A' ? ringColor : color;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#2A2A3A"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={finalColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        {showPercent && (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#F5F5FA', fontSize: size * 0.18, fontWeight: '800' }}>
              {displayProgress}%
            </Text>
          </View>
        )}
      </View>
      {label && (
        <Text style={{ color: '#7A7A92', fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>
          {label}
        </Text>
      )}
    </View>
  );
}
