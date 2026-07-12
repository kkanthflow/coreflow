/**
 * AnimatedPressable — the Coreflow button primitive.
 *
 * Wraps Pressable with a spring scale-down + opacity dip on press,
 * springing back on release. Use this instead of raw Pressable/View
 * for anything tappable (buttons, icon buttons, list-item actions)
 * to keep press feedback consistent across the app.
 *
 * Usage:
 *   <AnimatedPressable style={styles.addBtn} onPress={...}>
 *     <Plus size={16} color="#fff" />
 *   </AnimatedPressable>
 */
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onPress?: () => void;
  scaleTo?: number;
}

export default function AnimatedPressable({
  style,
  children,
  onPress,
  scaleTo = 0.93,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressableBase
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 14, stiffness: 320 });
        opacity.value = withSpring(0.85, { damping: 14, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 220 });
        opacity.value = withSpring(1, { damping: 10, stiffness: 220 });
      }}
      onPress={onPress}
      style={[style as any, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}
