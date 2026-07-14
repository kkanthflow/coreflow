import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeInUp,
  FadeOutDown,
} from 'react-native-reanimated';

export interface StatusCardProps {
  visible: boolean;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  details?: string;
  onClose: () => void;
  onRetry?: () => void;
}

export function StatusCard({
  visible,
  type,
  title,
  message,
  details,
  onClose,
  onRetry,
}: StatusCardProps) {
  const colors = useColors();
  const [showDetails, setShowDetails] = useState(false);

  // Reanimated shared values
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(20);
  const iconScale = useSharedValue(1);
  const detailsHeight = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Spring entrance animation
      scale.value = withSpring(1, { damping: 15, stiffness: 180 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 180 });

      // Pulse icon once
      iconScale.value = withSequence(
        withTiming(1.3, { duration: 150 }),
        withSpring(1, { damping: 8, stiffness: 120 })
      );
    } else {
      scale.value = 0.9;
      translateY.value = 20;
      setShowDetails(false);
      detailsHeight.value = 0;
    }
  }, [visible]);

  if (!visible) return null;

  // Resolve status variants
  const getStatusTheme = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'close-circle' as const,
          color: colors.error,
          tint: `${colors.error}15`,
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          color: colors.warning,
          tint: `${colors.warning}15`,
        };
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          color: colors.success,
          tint: `${colors.success}15`,
        };
      case 'info':
      default:
        return {
          icon: 'information-circle' as const,
          color: colors.info || '#60A5FA',
          tint: `${colors.info || '#60A5FA'}15`,
        };
    }
  };

  const statusTheme = getStatusTheme();

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const toggleDetails = () => {
    const nextShow = !showDetails;
    setShowDetails(nextShow);
    detailsHeight.value = withSpring(nextShow ? 1 : 0, { damping: 18, stiffness: 150 });
  };

  const detailsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: detailsHeight.value,
    height: withTiming(showDetails ? 'auto' : 0, { duration: 200 }),
    marginTop: showDetails ? 12 : 0,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Card Container */}
        <Reanimated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            containerAnimatedStyle,
          ]}
        >
          {/* Header row with pulsing Status Icon */}
          <View style={styles.headerRow}>
            <Reanimated.View
              style={[
                styles.iconContainer,
                { backgroundColor: statusTheme.tint },
                iconAnimatedStyle,
              ]}
            >
              <Ionicons name={statusTheme.icon} size={28} color={statusTheme.color} />
            </Reanimated.View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            </View>
          </View>

          {/* Message Body */}
          <Text style={[styles.message, { color: colors.secondary_text || colors.muted }]}>
            {message}
          </Text>

          {/* Technical Details dropdown */}
          {details && (
            <View style={styles.detailsContainer}>
              <Pressable onPress={toggleDetails} style={styles.dropdownHeader}>
                <Text style={[styles.dropdownTitle, { color: colors.muted }]}>
                  {showDetails ? 'Hide Technical Details' : 'Show Technical Details'}
                </Text>
                <Ionicons
                  name={showDetails ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>

              <Reanimated.View
                style={[
                  styles.detailsBody,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  detailsAnimatedStyle,
                ]}
              >
                <Text style={[styles.detailsText, { color: colors.foreground }]}>{details}</Text>
              </Reanimated.View>
            </View>
          )}

          {/* Action Footer Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.closeButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Close</Text>
            </Pressable>

            {onRetry && (
              <Pressable
                onPress={onRetry}
                style={[styles.button, styles.retryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.buttonText, styles.retryText]}>Retry</Text>
              </Pressable>
            )}
          </View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 7, 11, 0.45)', // Dynamic blur overlay feel
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 16,
  },
  detailsContainer: {
    marginBottom: 18,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailsBody: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
  },
  detailsText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    borderWidth: 1,
  },
  retryButton: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  retryText: {
    color: '#FFFFFF',
  },
});
