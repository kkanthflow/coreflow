import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const colors = useColors();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      // Logo bounce/spring scale-in
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 30,
        friction: 6,
        useNativeDriver: true,
      }),
      // Logo fade-in
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // Text fade-in delayed
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 1000,
        delay: 200,
        useNativeDriver: true,
      }),
      // Glow pulse looping
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 0.9,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      )
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} />

      {/* Decorative background glow blobs */}
      <Animated.View
        style={[
          styles.glowBlob,
          {
            top: -60,
            left: -40,
            backgroundColor: `${colors.primary}10`,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.glowBlob,
          {
            bottom: -60,
            right: -40,
            backgroundColor: `${colors.primary}08`,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      <View style={styles.content}>
        {/* Brand Logo Icon */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
              borderColor: `${colors.primary}30`,
              backgroundColor: `${colors.primary}08`,
            },
          ]}
        >
          <Ionicons name="flash" size={42} color={colors.primary} />
        </Animated.View>

        {/* Brand Name & Tagline */}
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center', marginTop: 24 }}>
          <Text style={[styles.brandText, { color: colors.foreground }]}>CoreFlow</Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>
            Enterprise Workspace Platform
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
  },
  glowBlob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
});
