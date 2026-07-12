import React, { useState } from 'react';
import { StyleSheet, Pressable, ViewStyle, StyleProp, GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface TiltCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function TiltCard({ children, style, onPress }: TiltCardProps) {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const [dimensions, setDimensions] = useState({ width: 200, height: 80 });

  const springConfig = {
    damping: 14,
    stiffness: 160,
    mass: 0.8,
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDimensions({ width, height });
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    scale.value = withSpring(0.96, springConfig);
    
    const { locationX, locationY } = e.nativeEvent;
    const cardWidth = dimensions.width;
    const cardHeight = dimensions.height;
    
    // Calculate offsets from the center of the card
    const xOffset = locationX - cardWidth / 2;
    const yOffset = locationY - cardHeight / 2;

    // Apply proportional tilt rotation limits
    rotateY.value = withSpring((xOffset / cardWidth) * 12, springConfig);
    rotateX.value = withSpring(-(yOffset / cardHeight) * 12, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
    rotateX.value = withSpring(0, springConfig);
    rotateY.value = withSpring(0, springConfig);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 600 },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rotateY.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Pressable
      onLayout={handleLayout}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ overflow: 'visible' }}
    >
      <Animated.View style={[styles.card, style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
});
