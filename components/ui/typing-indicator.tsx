import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  SharedValue,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';

export function TypingIndicator() {
  const colors = useColors();
  
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  const startAnim = (val: SharedValue<number>, delay: number) => {
    val.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 300 }),
          withTiming(0, { duration: 300 }),
          withTiming(0, { duration: 400 })
        ),
        -1,
        false
      )
    );
  };

  useEffect(() => {
    startAnim(dot1, 0);
    startAnim(dot2, 150);
    startAnim(dot3, 300);
  }, []);

  const style1 = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: dot1.value }],
    };
  });
  const style2 = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: dot2.value }],
    };
  });
  const style3 = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: dot3.value }],
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.border }]}>
      <Animated.View style={[styles.dot, { backgroundColor: colors.muted }, style1]} />
      <Animated.View style={[styles.dot, { backgroundColor: colors.muted }, style2]} />
      <Animated.View style={[styles.dot, { backgroundColor: colors.muted }, style3]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
