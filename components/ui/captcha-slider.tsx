import React, { useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

interface CaptchaSliderProps {
  onVerify: () => void;
}

export function CaptchaSlider({ onVerify }: CaptchaSliderProps) {
  const colors = useColors();
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  
  const pan = React.useRef(new Animated.ValueXY()).current;

  const handleLayout = (e: any) => {
    setSliderWidth(e.nativeEvent.layout.width);
  };

  const buttonWidth = 50;
  const maxDrag = sliderWidth - buttonWidth - 10; // subtract padding

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isVerified,
      onPanResponderMove: (e, gestureState) => {
        if (isVerified) return;
        const nextX = Math.min(Math.max(0, gestureState.dx), maxDrag);
        pan.x.setValue(nextX);
      },
      onPanResponderRelease: (e, gestureState) => {
        if (isVerified) return;
        // Verify if dragged past 90% of the slider track
        if (gestureState.dx >= maxDrag * 0.9) {
          setIsVerified(true);
          Animated.spring(pan.x, {
            toValue: maxDrag,
            useNativeDriver: false,
          }).start(() => {
            onVerify();
          });
        } else {
          Animated.spring(pan.x, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const sliderBackgroundStyle = {
    backgroundColor: isVerified 
      ? `${colors.success}15`
      : 'rgba(255, 255, 255, 0.05)',
    borderColor: isVerified 
      ? colors.success 
      : 'rgba(255, 255, 255, 0.08)',
  };

  const handleTranslateX = pan.x.interpolate({
    inputRange: [0, Math.max(1, maxDrag)],
    outputRange: [0, Math.max(1, maxDrag)],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>Security Verification</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Drag the slider to the right to complete verification
      </Text>
      
      <View 
        onLayout={handleLayout}
        style={[styles.sliderTrack, sliderBackgroundStyle]}
      >
        <Animated.View
          style={[
            styles.sliderButton,
            { 
              transform: [{ translateX: handleTranslateX }],
              backgroundColor: isVerified ? colors.success : colors.primary
            }
          ]}
          {...panResponder.panHandlers}
        >
          <Ionicons 
            name={isVerified ? "checkmark-sharp" : "chevron-forward-sharp"} 
            size={22} 
            color="#FFFFFF" 
          />
        </Animated.View>
        
        <Text style={[
          styles.trackText, 
          { 
            color: isVerified ? colors.success : colors.muted,
            marginLeft: buttonWidth + 10 
          }
        ]}>
          {isVerified ? "Verification Successful" : "Slide to Verify"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#131C33',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  sliderTrack: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    position: 'relative',
  },
  sliderButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  trackText: {
    fontSize: 14,
    fontWeight: '600',
    position: 'absolute',
    alignSelf: 'center',
    textAlign: 'center',
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
});
