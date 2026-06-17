import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';

interface ChatBubbleProps {
  message: {
    id: string;
    content?: string;
    sender_id?: string;
    sender?: { full_name: string; avatar_url?: string };
    created_at: string;
    is_edited?: boolean;
  };
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { user } = useAuth();
  const colors = useColors();

  const isMe = message.sender_id === user?.id;

  const initials = message.sender?.full_name
    ? message.sender.full_name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <View style={[styles.wrapper, { flexDirection: isMe ? 'row-reverse' : 'row' }]}>
      {/* Sender Avatar */}
      {!isMe && (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}

      {/* Message Box */}
      <View style={styles.messageBox}>
        {!isMe && (
          <Text style={[styles.senderName, { color: colors.muted }]}>
            {message.sender?.full_name || 'System'}
          </Text>
        )}

        <View
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
          </View>
        </View>
      </View>
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
    alignItems: 'flex-start',
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
  },
  content: {
    fontSize: 14,
    lineHeight: 19,
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
});
