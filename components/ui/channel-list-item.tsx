import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

interface ChannelListItemProps {
  channel: {
    id: string;
    name: string;
    description?: string;
    lastMessageText?: string;
    type: 'org_general' | 'org_announcement' | 'project' | 'direct';
    unreadCount?: number;
    lastMessageTime?: string;
  };
  onPress: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}

export function ChannelListItem({ 
  channel, 
  onPress, 
  onLongPress, 
  isSelected, 
  isSelectionMode 
}: ChannelListItemProps) {
  const colors = useColors();

  const getIcon = () => {
    switch (channel.type) {
      case 'org_general':
        return 'hashtag';
      case 'org_announcement':
        return 'megaphone-outline';
      case 'project':
        return 'folder-outline';
      case 'direct':
        return 'person-circle-outline';
      default:
        return 'chatbubble-outline';
    }
  };

  const hasUnread = channel.unreadCount !== undefined && channel.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isSelected ? `${colors.primary}12` : colors.surface,
          borderColor: isSelected ? colors.primary : colors.border,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      {isSelectionMode && (
        <View style={{ marginRight: 12, justifyContent: 'center' }}>
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={20}
            color={isSelected ? colors.primary : colors.muted}
          />
        </View>
      )}

      <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}12` }]}>
        <Ionicons name={getIcon() as any} size={20} color={colors.primary} />
      </View>

      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Text 
            style={[
              styles.name, 
              { 
                color: colors.foreground,
                fontWeight: hasUnread ? '700' : '600',
              }
            ]} 
            numberOfLines={1}
          >
            {channel.type === 'org_general' ? 'general' : channel.name}
          </Text>
          {channel.lastMessageTime && (
            <Text style={[styles.time, { color: colors.muted }]}>
              {new Date(channel.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        {(channel.lastMessageText || channel.description) ? (
          <Text style={[styles.description, { color: colors.muted }]} numberOfLines={1}>
            {channel.lastMessageText || channel.description}
          </Text>
        ) : null}
      </View>

      {hasUnread && (
        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.unreadText}>{channel.unreadCount}</Text>
        </View>
      )}

      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
  },
  time: {
    fontSize: 10,
    fontWeight: '500',
  },
  description: {
    fontSize: 12,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginRight: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
