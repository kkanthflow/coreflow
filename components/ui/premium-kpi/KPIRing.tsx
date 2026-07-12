import React, { useEffect } from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MotionTokens } from './animations';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface KPIRingProps {
  progress?: number; // 0 to 1
  size?: number;     // diameter
  strokeWidth?: number;
  color: string;
  isLoading?: boolean;
}

export const KPIRing = React.memo(({
  progress = 0,
  size = 80,
  strokeWidth = 4,
  color,
  isLoading = false,
}: KPIRingProps) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // 300 degree partial arc
  const arcLength = circumference * (300 / 360);
  const gapLength = circumference - arcLength;

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    if (isLoading) {
      animatedProgress.value = 0;
    } else {
      animatedProgress.value = withSpring(progress, MotionTokens.KPI.Enter);
    }
  }, [progress, isLoading]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = arcLength - (arcLength * animatedProgress.value);
    return {
      strokeDashoffset,
    };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation={120} origin={`${center}, ${center}`}>
        {/* Background Track Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeLinecap="round"
        />
        {/* Active Progress Circle */}
        {!isLoading && (
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeLinecap="round"
            animatedProps={animatedProps}
          />
        )}
      </G>
    </Svg>
  );
});

KPIRing.displayName = 'KPIRing';
