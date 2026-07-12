import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

interface FloatingWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bob?: boolean;
  bobDelay?: number;
  bobDepth?: number;
  duration?: number;
}

export function FloatingWrapper({
  children,
  style,
  bob = true,
  bobDelay = 0,
  bobDepth = 3,
  duration = 1400,
}: FloatingWrapperProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (bob) {
      translateY.value = withDelay(
        bobDelay,
        withRepeat(
          withSequence(
            withTiming(-bobDepth, { duration }),
            withTiming(bobDepth, { duration })
          ),
          -1,
          true
        )
      );
    } else {
      translateY.value = 0;
    }
  }, [bob, bobDelay, bobDepth, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View style={[style as any, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
