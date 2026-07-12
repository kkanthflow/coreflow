import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CollapsibleHeaderProps {
  scrollY: SharedValue<number>;
  title: string;
  subtitle?: string | React.ReactNode;
  rightComponent?: React.ReactNode;
}

export function CollapsibleHeaderWrapper({
  scrollY,
  title,
  subtitle,
  rightComponent,
}: CollapsibleHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const headerMinHeight = 60 + insets.top;
  const headerMaxHeight = 110 + insets.top;
  const scrollDistance = headerMaxHeight - headerMinHeight;

  const headerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [headerMaxHeight, headerMinHeight],
      'clamp'
    );
    const borderBottomWidth = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, 1],
      'clamp'
    );
    return {
      height,
      borderBottomWidth,
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    const fontSize = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [22, 17],
      'clamp'
    );
    const translateY = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, -2],
      'clamp'
    );
    return {
      fontSize,
      transform: [{ translateY }],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, scrollDistance * 0.5],
      [1, 0],
      'clamp'
    );
    return {
      opacity,
      height: interpolate(
        scrollY.value,
        [0, scrollDistance],
        [18, 0],
        'clamp'
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingTop: insets.top,
        },
        headerStyle,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.textContainer}>
          <Animated.Text
            style={[
              styles.title,
              { color: colors.foreground },
              titleStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Animated.Text>
          {subtitle ? (
            <Animated.View style={[subtitleStyle, { overflow: 'hidden' }]}>
              {typeof subtitle === 'string' ? (
                <Animated.Text
                  style={[
                    styles.subtitle,
                    { color: colors.muted },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Animated.Text>
              ) : (
                subtitle
              )}
            </Animated.View>
          ) : null}
        </View>
        {rightComponent ? (
          <View style={styles.rightComponentWrapper}>{rightComponent}</View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rightComponentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
