import React, { useRef, useCallback } from 'react';
import { Animated, InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Wraps a tab screen with a fade + slide-up animation that fires
 * AFTER the tab switch gesture completes — using InteractionManager
 * to avoid the animation being swallowed by the navigation transition.
 */
export function TabScreenWrapper({ children }: { children: React.ReactNode }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useFocusEffect(
    useCallback(() => {
      // Instantly reset before animating in
      opacity.setValue(0);
      translateY.setValue(30);

      // Wait for any in-flight interactions (tab switch gesture) to finish
      const task = InteractionManager.runAfterInteractions(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start();
      });

      // Cancel on blur (user leaves this tab before animation finishes)
      return () => task.cancel();
    }, [])
  );

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
