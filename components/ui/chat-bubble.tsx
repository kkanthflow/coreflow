import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TouchableOpacity, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  FadeInDown,
  runOnJS,
  ZoomIn,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

interface ChatBubbleProps {
  message: {
    id: string;
    content?: string;
    sender_id?: string;
    sender?: { full_name: string; avatar_url?: string };
    created_at: string;
    is_edited?: boolean;
    reply_to_id?: string | null;
    reply_message?: { content: string; sender: { full_name: string } } | null;
    reactions?: string[] | any;
    delivered_at?: string | null;
    file_url?: string | null;
    file_name?: string | null;
    file_type?: string | null;
  };
  onReply?: (message: any) => void;
  onReact?: (messageId: string, reaction: string) => void;
  onDelete?: (messageId: string) => void;
  isRead?: boolean;
}

const REACTION_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

function VoicePlayer({ fileUrl, isMe }: { fileUrl: string; isMe: boolean }) {
  const colors = useColors();
  const player = useAudioPlayer(fileUrl);
  const status = useAudioPlayerStatus(player);

  const formatTime = (ms: number) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const progress = status.duration ? (status.currentTime / status.duration) * 100 : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, width: 220 }}>
      <Pressable
        onPress={handlePlayPause}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: isMe ? '#FFFFFF' : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={status.playing ? "pause" : "play"}
          size={18}
          color={isMe ? colors.primary : '#FFFFFF'}
          style={{ marginLeft: status.playing ? 0 : 2 }}
        />
      </Pressable>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : colors.border, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: isMe ? '#FFFFFF' : colors.primary,
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: isMe ? '#FFFFFF' : colors.muted }}>
            {formatTime(status.currentTime)}
          </Text>
          <Text style={{ fontSize: 10, color: isMe ? '#FFFFFF' : colors.muted }}>
            {formatTime(status.duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function ChatBubble({ message, onReply, onReact, onDelete, isRead }: ChatBubbleProps) {
  const { user } = useAuth();
  const colors = useColors();
  const [menuVisible, setMenuVisible] = useState(false);

  const isMe = message.sender_id === user?.id;

  const initials = message.sender?.full_name
    ? message.sender.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const reactionsList = Array.isArray(message.reactions)
    ? message.reactions
    : typeof message.reactions === 'object' && message.reactions !== null
    ? Object.values(message.reactions)
    : [];

  // Reanimated values for 3D spring interaction
  const bubbleScale = useSharedValue(1);
  const bubbleRotateX = useSharedValue(0);
  const bubbleRotateY = useSharedValue(0);
  const swipeX = useSharedValue(0);

  const handlePressIn = () => {
    bubbleScale.value = withSpring(0.96, { damping: 10, stiffness: 200 });
    // Add subtle 3D tilt depending on side
    bubbleRotateY.value = withSpring(isMe ? 3 : -3, { damping: 10, stiffness: 200 });
  };

  const handlePressOut = () => {
    bubbleScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    bubbleRotateY.value = withSpring(0, { damping: 12, stiffness: 180 });
  };

  const handleLongPress = () => {
    setMenuVisible(true);
  };

  const handleSelectReaction = (emoji: string) => {
    if (onReact) {
      onReact(message.id, emoji);
    }
    setMenuVisible(false);
  };

  const handleReplyPress = () => {
    if (onReply) {
      onReply(message);
    }
    setMenuVisible(false);
  };

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: bubbleScale.value },
      { rotateX: `${bubbleRotateX.value}deg` },
      { rotateY: `${bubbleRotateY.value}deg` },
    ],
  }));

  const swipedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => {
    const scale = Math.max(0.5, Math.min(1.2, swipeX.value / 50));
    const opacity = Math.min(1, swipeX.value / 40);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const panGesture = Gesture.Pan()
    .activeOffsetX([0, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      swipeX.value = Math.max(0, Math.min(100, event.translationX));
    })
    .onEnd(() => {
      if (swipeX.value > 65) {
        if (onReply) {
          runOnJS(onReply)(message);
        }
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
      swipeX.value = withSpring(0, { damping: 15, stiffness: 200 });
    });

  const isDelivered = !!message.delivered_at;

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={{ position: 'relative', width: '100%' }}>
        <Reanimated.View
          style={[
            {
              position: 'absolute',
              left: 16,
              top: '50%',
              marginTop: -16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: `${colors.primary}20`,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            },
            replyIconStyle,
          ]}
        >
          <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
        </Reanimated.View>

        <Reanimated.View
          entering={FadeInDown.springify().mass(0.6).damping(14).stiffness(160)}
          style={[styles.wrapper, { flexDirection: isMe ? 'row-reverse' : 'row' }, swipedBubbleStyle]}
        >
          {/* Sender Avatar */}
          {!isMe && (
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}

          {/* Message Box */}
          <View style={[styles.messageBox, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}>
            {!isMe && (
              <Text style={[styles.senderName, { color: colors.muted }]}>
                {message.sender?.full_name || 'System'}
              </Text>
            )}

            <Pressable
              onLongPress={handleLongPress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              delayLongPress={300}
            >
              <Reanimated.View
                style={[
                  styles.bubble,
                  isMe ? styles.bubbleMe3D : styles.bubbleOther3D,
                  {
                    backgroundColor: isMe ? colors.primary : colors.surface,
                    borderColor: isMe ? `${colors.primary}40` : colors.border,
                    borderTopRightRadius: isMe ? 4 : 16,
                    borderTopLeftRadius: isMe ? 16 : 4,
                    shadowColor: isMe ? colors.primary : '#000000',
                  },
                  animatedBubbleStyle,
                ]}
              >
                {/* Reply Quoted Preview */}
                {message.reply_message && (
                  <View
                    style={[
                      styles.replyContainer,
                      {
                        backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
                        borderColor: isMe ? 'rgba(255,255,255,0.25)' : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.replyBar, { backgroundColor: isMe ? '#FFFFFF' : colors.primary }]} />
                    <View style={styles.replyContent}>
                      <Text style={[styles.replySender, { color: isMe ? '#FFFFFF' : colors.primary }]}>
                        {message.reply_message.sender?.full_name || 'User'}
                      </Text>
                      <Text style={[styles.replyText, { color: isMe ? '#F3F4F6' : colors.foreground }]} numberOfLines={1}>
                        {message.reply_message.content}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Message Content */}
                {message.file_url && (message.file_type === 'voice' || message.file_type === 'audio') ? (
                  <VoicePlayer fileUrl={message.file_url} isMe={isMe} />
                ) : (
                  message.content && (
                    <Text style={[styles.content, { color: isMe ? '#FFFFFF' : colors.foreground }]}>
                      {message.content}
                    </Text>
                  )
                )}

                {/* Meta details (Edited indicator, Ticks) */}
                <View style={styles.footerRow}>
                  {message.is_edited && (
                    <Text style={[styles.edited, { color: isMe ? '#E5E7EB' : colors.muted }]}>
                      (edited)
                    </Text>
                  )}
                  <Text style={[styles.time, { color: isMe ? '#E5E7EB' : colors.muted }]}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {isMe && (
                    <View style={styles.ticksContainer}>
                      <Ionicons
                        name={isRead ? "checkmark-done" : "checkmark"}
                        size={14}
                        color={isRead ? "#38BDF8" : "#E5E7EB"}
                      />
                    </View>
                  )}
                </View>
              </Reanimated.View>
            </Pressable>

            {/* Reactions Display */}
            {reactionsList.length > 0 && (
              <View style={[styles.reactionsRow, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
                {reactionsList.map((reactionObj: any, index: number) => {
                  const emoji = typeof reactionObj === 'string' ? reactionObj : reactionObj.emoji;
                  return (
                    <View
                      key={`${emoji}-${index}`}
                      style={[
                        styles.reactionBadge,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          shadowColor: '#000000',
                        },
                      ]}
                    >
                      <Text style={styles.reactionText}>{emoji}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Reanimated.View>

        {/* Long Press Menu Overlay Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={menuVisible}
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
            <Reanimated.View
              entering={ZoomIn.springify().duration(250)}
              style={[styles.menuContainer, { backgroundColor: colors.background }]}
            >
              {/* Quick Reactions Bar */}
              <View style={[styles.reactionsBar, { borderColor: colors.border }]}>
                {REACTION_OPTIONS.map((emoji) => (
                  <TouchableOpacity key={emoji} onPress={() => handleSelectReaction(emoji)} style={styles.reactionOption}>
                    <Text style={styles.reactionOptionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Menu Options */}
              <TouchableOpacity onPress={handleReplyPress} style={[styles.menuItem, { borderBottomColor: colors.border }]}>
                <Ionicons name="arrow-undo-outline" size={18} color={colors.foreground} style={styles.menuIcon} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Reply</Text>
              </TouchableOpacity>

              {onDelete && (isMe || user?.role === 'admin' || user?.role === 'owner') && (
                <TouchableOpacity
                  onPress={() => {
                    setMenuVisible(false);
                    onDelete(message.id);
                  }}
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} style={styles.menuIcon} />
                  <Text style={[styles.menuItemText, { color: colors.error }]}>{isMe ? "Delete for Everyone" : "Delete Message"}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setMenuVisible(false)} style={styles.menuItem}>
                <Ionicons name="close-outline" size={18} color={colors.error} style={styles.menuIcon} />
                <Text style={[styles.menuItemText, { color: colors.error }]}>Cancel</Text>
              </TouchableOpacity>
            </Reanimated.View>
          </Pressable>
        </Modal>
      </Reanimated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  messageBox: {
    flex: 1,
    maxWidth: '82%',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 6,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  bubbleMe3D: {
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  bubbleOther3D: {
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  content: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  time: {
    fontSize: 10,
    fontWeight: '600',
  },
  edited: {
    fontSize: 10,
    marginRight: 4,
    fontStyle: 'italic',
  },
  ticksContainer: {
    marginLeft: 4,
  },
  replyContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 6,
    marginBottom: 8,
    borderWidth: 1,
  },
  replyBar: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -8,
    zIndex: 100,
  },
  reactionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  reactionText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 24,
  },
  reactionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  reactionOption: {
    padding: 8,
  },
  reactionOptionText: {
    fontSize: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
