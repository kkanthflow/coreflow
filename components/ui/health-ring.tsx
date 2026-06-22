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
  const safeSize = isNaN(size) || size <= 0 ? 72 : size;
  const safeStrokeWidth = isNaN(strokeWidth) || strokeWidth < 0 ? 6 : strokeWidth;
  const safeProgress = isNaN(progress) || typeof progress !== 'number' ? 0 : Math.max(0, Math.min(100, progress));

  const animProgress = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = React.useState(0);

  const radius = (safeSize - safeStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: safeProgress,
      duration: 1400,
      useNativeDriver: false,
    }).start();

    const listener = animProgress.addListener(({ value }) => {
      const val = isNaN(value) ? 0 : Math.round(value);
      setDisplayProgress(val);
    });
    return () => animProgress.removeListener(listener);
  }, [safeProgress]);

  const offsetVal = circumference - (displayProgress / 100) * circumference;
  const strokeDashoffset = isNaN(offsetVal) ? circumference : offsetVal;

  // Color based on health
  const ringColor =
    progress >= 70 ? '#34D399' :
    progress >= 40 ? '#FBBF24' :
    '#F87171';

  const finalColor = color === '#FF6B4A' ? ringColor : color;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: safeSize, height: safeSize }}>
        <Svg width={safeSize} height={safeSize} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Track */}
          <Circle
            cx={safeSize / 2}
            cy={safeSize / 2}
            r={radius}
            stroke="#2A2A3A"
            strokeWidth={safeStrokeWidth}
            fill="none"
          />
          {/* Progress */}
          <Circle
            cx={safeSize / 2}
            cy={safeSize / 2}
            r={radius}
            stroke={finalColor}
            strokeWidth={safeStrokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        {showPercent && (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#F5F5FA', fontSize: safeSize * 0.18, fontWeight: '800' }}>
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
