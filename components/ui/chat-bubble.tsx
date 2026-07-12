import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';

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
  };
  onReply?: (message: any) => void;
  onReact?: (messageId: string, reaction: string) => void;
  onDelete?: (messageId: string) => void;
  isRead?: boolean;
}

const REACTION_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export function ChatBubble({ message, onReply, onReact, onDelete, isRead }: ChatBubbleProps) {
  const { user } = useAuth();
  const colors = useColors();
  const [menuVisible, setMenuVisible] = useState(false);

  const isMe = message.sender_id === user?.id;

  const initials = message.sender?.full_name
    ? message.sender.full_name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const reactionsList = Array.isArray(message.reactions) 
    ? message.reactions 
    : (typeof message.reactions === 'object' && message.reactions !== null) 
      ? Object.values(message.reactions) 
      : [];

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

  const isDelivered = !!message.delivered_at;

  return (
    <View style={[styles.wrapper, { flexDirection: isMe ? 'row-reverse' : 'row' }]}>
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
          delayLongPress={300}
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? colors.primary : colors.surface,
              borderColor: colors.border,
              borderTopRightRadius: isMe ? 2 : 12,
              borderTopLeftRadius: isMe ? 12 : 2,
            },
          ]}
        >
          {/* Reply Quoted Preview */}
          {message.reply_message && (
            <View style={[styles.replyContainer, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }]}>
              <View style={[styles.replyBar, { backgroundColor: colors.primary }]} />
              <View style={styles.replyContent}>
                <Text style={[styles.replySender, { color: isMe ? '#FFFFFF' : colors.primary }]} numberOfLines={1}>
                  {message.reply_message.sender?.full_name || 'User'}
                </Text>
                <Text style={[styles.replyText, { color: isMe ? 'rgba(255,255,255,0.8)' : colors.foreground }]} numberOfLines={1}>
                  {message.reply_message.content}
                </Text>
              </View>
            </View>
          )}

          <Text style={[styles.content, { color: isMe ? '#FFFFFF' : colors.foreground }]}>
            {message.content}
          </Text>
          
          <View style={styles.footerRow}>
            {message.is_edited && (
              <Text style={[styles.edited, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.muted }]}>
                (edited)
              </Text>
            )}
            <Text style={[styles.time, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.muted }]}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>

            {/* Read/Delivery Ticks */}
            {isMe && (
              <View style={styles.ticksContainer}>
                {isRead ? (
                  <Ionicons name="checkmark-done" size={14} color="#38BDF8" /> // Blue double ticks
                ) : isDelivered ? (
                  <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" /> // Grey double ticks
                ) : (
                  <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" /> // Grey single tick
                )}
              </View>
            )}
          </View>
        </Pressable>

        {/* Reactions Row */}
        {reactionsList.length > 0 && (
          <View style={[styles.reactionsRow, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
            {reactionsList.map((react: any, idx: number) => (
              <View key={idx} style={[styles.reactionBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.reactionText}>{react.emoji || react}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Long-Press Action Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuContainer, { backgroundColor: colors.background }]}>
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
                <Text style={[styles.menuItemText, { color: colors.error }]}>Delete Message</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity onPress={() => setMenuVisible(false)} style={styles.menuItem}>
              <Ionicons name="close-outline" size={18} color={colors.error} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    alignItems: 'flex-end',
    width: '100%',
    paddingHorizontal: 16,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  messageBox: {
    maxWidth: '80%',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    fontSize: 14,
    lineHeight: 19,
  },
  replyContainer: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
    height: 38,
  },
  replyBar: {
    width: 4,
    height: '100%',
  },
  replyContent: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  replySender: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 1,
  },
  replyText: {
    fontSize: 11,
  },
  footerRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  time: {
    fontSize: 9,
    fontWeight: '500',
  },
  edited: {
    fontSize: 9,
    fontStyle: 'italic',
  },
  ticksContainer: {
    marginLeft: 2,
  },
  reactionsRow: {
    flexDirection: 'row',
    marginTop: -6,
    paddingHorizontal: 4,
    gap: 2,
  },
  reactionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuContainer: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 12,
  },
  reactionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  reactionOption: {
    padding: 6,
  },
  reactionOptionText: {
    fontSize: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
