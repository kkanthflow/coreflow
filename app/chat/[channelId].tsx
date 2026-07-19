import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { ChatBubble } from '@/components/ui/chat-bubble';
import { TypingIndicator } from '@/components/ui/typing-indicator';
import { PremiumInput } from '@/components/ui/premium-input';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {
  initializeUserKeys,
  generateRandomSymmetricKey,
  encryptKeyForRecipient,
  decryptKeyWithSender,
  encryptMessagePayload,
  decryptMessagePayload,
} from '@/lib/crypto';

export default function ChannelChatScreen() {
  const { channelId } = useLocalSearchParams();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<any | null>(null);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState<boolean>(false);
  const [otherMember, setOtherMember] = useState<any | null>(null);
  const [channelSymmetricKey, setChannelSymmetricKey] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const receiverTypingTimeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const symmetricKeyRef = useRef<string | null>(null);

  const setSymmetricKey = (key: string | null) => {
    setChannelSymmetricKey(key);
    symmetricKeyRef.current = key;
  };

  // Keep track of active channel ID globally to suppress push notifications for the active room
  useEffect(() => {
    if (channelId) {
      (global as any).activeChannelId = channelId;
      if (Platform.OS !== 'web') {
        Notifications.dismissNotificationAsync(channelId as string).catch(() => {});
      }
    }
    return () => {
      (global as any).activeChannelId = null;
    };
  }, [channelId]);

  const decryptMessage = useCallback(async (msg: any, symmetricKey: string) => {
    if (msg.content && msg.content.startsWith('__E2EE__:')) {
      const ciphertext = msg.content.substring('__E2EE__:'.length);
      const decrypted = await decryptMessagePayload(ciphertext, symmetricKey);
      return {
        ...msg,
        content: decrypted?.text || '[Decryption Failed]',
      };
    }
    return msg;
  }, []);

  const markChannelAsRead = useCallback(async () => {
    if (!channelId || !user?.id) return;
    try {
      await supabase
        .from('channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.id);

      // Automatically mark in-app notifications for this chat room as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('entity_id', channelId)
        .in('type', ['chat', 'chat_channel'])
        .eq('is_read', false);
    } catch (err) {
      console.warn('Failed to update last_read_at:', err);
    }
  }, [channelId, user?.id]);

  const fetchChannelData = useCallback(async () => {
    if (!channelId || !user) return;
    try {
      // Fetch channel info along with members
      const { data: chanData, error: chanError } = await supabase
        .from('chat_channels')
        .select(`
          *,
          channel_members(
            user_id,
            user:user_id(
              id,
              full_name,
              avatar_url,
              is_online,
              last_seen_at
            )
          )
        `)
        .eq('id', channelId)
        .single();

      if (chanError) throw chanError;
      setChannel(chanData);

      // Determine "other member" for DMs
      if (chanData.type === 'direct') {
        const other = chanData.channel_members?.find((m: any) => m.user_id !== user?.id)?.user;
        if (other) {
          const { data: otherPriv } = await supabase
            .from('privacy_settings')
            .select('show_last_seen, show_online')
            .eq('user_id', other.id)
            .maybeSingle();

          setOtherMember({
            ...other,
            show_last_seen: otherPriv?.show_last_seen ?? 'everyone',
            show_online: otherPriv?.show_online ?? 'everyone',
          });
        }
      }

      // Establish E2EE keys
      let symmetricKey = symmetricKeyRef.current;
      try {
        if (!symmetricKey) {
          // 1. Initialize user public keys
          const myPubKey = await initializeUserKeys(user.id);

          // 2. Fetch my encrypted key for this channel
          const { data: myKeyData } = await supabase
            .from('channel_keys')
            .select('encrypted_key')
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (myKeyData) {
            // Decrypt key
            const creatorId = chanData.created_by || user.id;
            const { data: creatorKeyData } = await supabase
              .from('user_public_keys')
              .select('public_key')
              .eq('user_id', creatorId)
              .single();

            if (creatorKeyData) {
              symmetricKey = await decryptKeyWithSender(myKeyData.encrypted_key, creatorKeyData.public_key);
              setSymmetricKey(symmetricKey);
            }
          } else {
            // Create new key if we are creator/member and none exists
            const newKey = generateRandomSymmetricKey();
            const myEncryptedKey = await encryptKeyForRecipient(newKey, myPubKey);

            const inserts = [
              { channel_id: channelId, user_id: user.id, encrypted_key: myEncryptedKey }
            ];

            if (chanData.type === 'direct') {
              const other = chanData.channel_members?.find((m: any) => m.user_id !== user?.id)?.user;
              if (other) {
                const { data: otherKeyData } = await supabase
                  .from('user_public_keys')
                  .select('public_key')
                  .eq('user_id', other.id)
                  .maybeSingle();

                if (otherKeyData) {
                  const otherEncryptedKey = await encryptKeyForRecipient(newKey, otherKeyData.public_key);
                  inserts.push({
                    channel_id: channelId,
                    user_id: other.id,
                    encrypted_key: otherEncryptedKey
                  });
                }
              }
            }

            await supabase.from('channel_keys').insert(inserts);
            symmetricKey = newKey;
            setSymmetricKey(newKey);
          }
        }
      } catch (e2eeError) {
        console.warn('[E2EE] Setup failed, falling back to unencrypted channel:', e2eeError);
      }

      // Fetch message history
      const { data: msgData } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:sender_id(full_name, avatar_url),
          message_reads(user_id),
          reply_message:reply_to_id(
            id,
            content,
            sender:sender_id(full_name)
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);

      const msgs = msgData || [];
      
      // Decrypt messages
      const decryptedMsgs = symmetricKey
        ? await Promise.all(msgs.map(m => decryptMessage(m, symmetricKey as string)))
        : msgs;

      setMessages(decryptedMsgs);

      // Mark messages as read & delivered
      if (user) {
        if (msgs.length > 0) {
          const unreadIds = msgs.filter(m => m.sender_id !== user.id && !m.message_reads?.some((r: any) => r.user_id === user.id)).map(m => m.id);
          if (unreadIds.length > 0) {
            const reads = unreadIds.map(mId => ({ message_id: mId, user_id: user.id }));
            await supabase.from('message_reads').insert(reads);
          }
          
          const undelivered = msgs.filter(m => m.sender_id !== user.id && !m.delivered_at);
          if (undelivered.length > 0) {
            await supabase.from('chat_messages').update({ delivered_at: new Date().toISOString() }).in('id', undelivered.map(m => m.id));
          }
        }

        // Mark channel as read
        await markChannelAsRead();
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [channelId, user, decryptMessage, markChannelAsRead]);

  useEffect(() => {
    fetchChannelData();

    // Subscribe to messages, status changes and read receipts in realtime
    const messageChannel = supabase
      .channel(`chat:messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch sender details
          const { data: senderData } = await supabase
            .from('users')
            .select('full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          // Fetch reply message if reply_to_id is present
          let replyMsg = null;
          if (payload.new.reply_to_id) {
            const { data: rMsg } = await supabase
              .from('chat_messages')
              .select('id, content, sender:sender_id(full_name)')
              .eq('id', payload.new.reply_to_id)
              .single();
            replyMsg = rMsg;
          }

          let completeMessage: any = {
            ...payload.new,
            sender: senderData,
            reply_message: replyMsg,
            message_reads: [],
          };

          // Decrypt if key is established
          const activeKey = symmetricKeyRef.current;
          if (activeKey) {
            completeMessage = await decryptMessage(completeMessage, activeKey);
          }

          setMessages((prev) => {
            const filtered = prev.filter(
              (m) =>
                !(
                  m.isOptimistic &&
                  m.content === completeMessage.content &&
                  m.sender_id === completeMessage.sender_id
                )
            );
            if (filtered.some((m) => m.id === completeMessage.id)) return filtered;
            return [...filtered, completeMessage];
          });

          // Mark message as read and set delivered if sender_id !== current user
          if (payload.new.sender_id !== user?.id) {
            supabase
              .from('message_reads')
              .insert({ message_id: payload.new.id, user_id: user?.id })
              .then();
            if (!payload.new.delivered_at) {
              supabase
                .from('chat_messages')
                .update({ delivered_at: new Date().toISOString() })
                .eq('id', payload.new.id)
                .then();
            }
            // Mark channel as read
            markChannelAsRead();
          }

          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          let updatedMsg = payload.new;
          const activeKey = symmetricKeyRef.current;
          if (activeKey) {
            updatedMsg = await decryptMessage(payload.new, activeKey);
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? { ...msg, ...updatedMsg } : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === payload.new.message_id) {
                const reads = msg.message_reads || [];
                if (!reads.some((r: any) => r.user_id === payload.new.user_id)) {
                  return {
                    ...msg,
                    message_reads: [...reads, { user_id: payload.new.user_id }],
                  };
                }
              }
              return msg;
            })
          );
        }
      )
      .subscribe();

    // Subscribe to Presence and Typing Broadcast
    console.log('[Typing] Setting up presence channel for channel:', channelId);
    const presenceChannel = supabase.channel(`presence:${channelId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: user?.id },
      },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        if (otherMember) {
          const isOnline = Object.values(state)
            .flat()
            .some((p: any) => p?.user_id === otherMember.id);
          setIsOtherUserOnline(isOnline);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        console.log('[Typing] Received broadcast event payload:', payload);
        const { userId, isTyping } = payload;
        if (userId && userId !== user?.id) {
          if (isTyping) {
            setTypingUsers((prev) =>
              prev.includes(userId) ? prev : [...prev, userId]
            );

            // Clear existing timeout for this user
            if (receiverTypingTimeoutsRef.current[userId]) {
              clearTimeout(receiverTypingTimeoutsRef.current[userId]);
            }

            // Automatically clear typing status after 4 seconds of inactivity
            receiverTypingTimeoutsRef.current[userId] = setTimeout(() => {
              console.log('[Typing] Automatically clearing typing status for user due to inactivity:', userId);
              setTypingUsers((prev) => prev.filter((id) => id !== userId));
            }, 4000);
          } else {
            if (receiverTypingTimeoutsRef.current[userId]) {
              clearTimeout(receiverTypingTimeoutsRef.current[userId]);
              delete receiverTypingTimeoutsRef.current[userId];
            }
            setTypingUsers((prev) => prev.filter((id) => id !== userId));
          }
        }
      })
      .subscribe(async (status) => {
        console.log('[Typing] Presence channel status:', status);
        if (status === 'SUBSCRIBED' && user) {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      console.log('[Typing] Cleaning up channel subscriptions');
      supabase.removeChannel(messageChannel);
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      // Clear all typing timeouts
      Object.values(receiverTypingTimeoutsRef.current).forEach(clearTimeout);
      receiverTypingTimeoutsRef.current = {};
    };
  }, [channelId, fetchChannelData, otherMember?.id, user, decryptMessage]);

  // Sync isOtherUserOnline when otherMember changes
  useEffect(() => {
    if (presenceChannelRef.current && otherMember) {
      const state = presenceChannelRef.current.presenceState();
      const isOnline = Object.values(state)
        .flat()
        .some((p: any) => p?.user_id === otherMember.id);
      setIsOtherUserOnline(isOnline);
    }
  }, [otherMember]);

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (presenceChannelRef.current && user) {
      console.log('[Typing] Sending broadcast typing status:', text.length > 0);
      presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping: text.length > 0 },
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      if (text.length > 0) {
        typingTimeoutRef.current = setTimeout(() => {
          console.log('[Typing] Idle timeout reached, sending isTyping: false');
          presenceChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: user.id, isTyping: false },
          });
        }, 3000);
      }
    }
  };

  const handleDeleteMessage = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const isOwner = msg.sender_id === user?.id;
    const isAdmin = user?.role === 'admin' || user?.role === 'owner';

    const options: any[] = [{ text: 'Cancel', style: 'cancel' }];

    if (isOwner || isAdmin) {
      options.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('chat_messages')
              .delete()
              .eq('id', messageId);
            if (error) throw error;
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete message.');
          }
        },
      });
    }

    if (isOwner) {
      options.unshift({
        text: 'Delete for me',
        onPress: () => {
          // Locally remove — message still exists in DB for others
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        },
      });
    }

    Alert.alert('Delete Message', 'Choose how you want to delete this message.', options);
  }, [messages, user]);

  // Recording functions removed

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (presenceChannelRef.current && user) {
      console.log('[Typing] Message sent, sending typing broadcast isTyping: false');
      presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping: false },
      });
    }

    const optimisticMsgId = `optimistic-${Math.random()}`;
    const optimisticMessage = {
      id: optimisticMsgId,
      channel_id: channelId,
      sender_id: user?.id,
      content: textToSend,
      created_at: new Date().toISOString(),
      sender: {
        full_name: user?.fullName || 'Me',
        avatar_url: user?.avatarUrl,
      },
      message_reads: [],
      reactions: [],
      reply_message: replyToMessage
        ? {
            content: replyToMessage.content,
            sender: {
              full_name: replyToMessage.sender?.full_name || 'User',
            },
          }
        : null,
      reply_to_id: replyToMessage?.id || null,
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyToMessage(null);

    // Scroll to bottom
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      let finalContent = textToSend;
      if (channelSymmetricKey) {
        // Encrypt the message payload
        const encryptedData = await encryptMessagePayload(
          { text: textToSend },
          channelSymmetricKey
        );
        finalContent = `__E2EE__:${encryptedData}`;
      }

      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channelId,
        sender_id: user?.id,
        content: finalContent,
        reply_to_id: optimisticMessage.reply_to_id,
      });

      if (error) throw error;
    } catch (e: any) {
      console.error('[ChatSendMessageError]', e);
      Alert.alert('Send Error', e.message || 'Failed to send message.');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsgId));
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    let currentReactions = Array.isArray(msg.reactions) ? msg.reactions : [];
    const existingIndex = currentReactions.findIndex(
      (r: any) => r.user_id === user?.id
    );

    if (existingIndex > -1) {
      if (currentReactions[existingIndex].emoji === emoji) {
        currentReactions = currentReactions.filter(
          (r: any) => r.user_id !== user?.id
        );
      } else {
        currentReactions[existingIndex].emoji = emoji;
      }
    } else {
      currentReactions.push({ user_id: user?.id, emoji });
    }

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ reactions: currentReactions })
        .eq('id', messageId);

      if (error) throw error;
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  if (loading && !channel) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!channel) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Text style={{ color: colors.error }}>Channel not found or deleted.</Text>
      </ScreenContainer>
    );
  }

  const formatLastSeen = (dateString: string) => {
    if (!dateString) return 'Offline';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) {
      return 'Last seen just now';
    }
    if (diffMin < 60) {
      return `Last seen ${diffMin}m ago`;
    }
    if (diffHr < 24) {
      return `Last seen ${diffHr}h ago`;
    }
    if (diffDays === 1) {
      return 'Last seen yesterday';
    }
    if (diffDays < 7) {
      return `Last seen ${diffDays}d ago`;
    }
    return `Last seen on ${date.toLocaleDateString()}`;
  };

  const renderHeaderTitle = () => {
    if (channel.type === 'direct' && otherMember) {
      return otherMember.full_name;
    }
    return channel.type === 'org_general' ? 'general' : channel.name;
  };

  const renderHeaderSubtitle = () => {
    if (channel.type === 'direct' && otherMember) {
      const showOnline = otherMember.show_online !== 'nobody';
      const showLastSeen = otherMember.show_last_seen !== 'nobody';

      if (isOtherUserOnline && showOnline) {
        return 'Active now';
      }
      if (showLastSeen && otherMember.last_seen_at) {
        return formatLastSeen(otherMember.last_seen_at);
      }
      return 'Offline';
    }
    return channel.description;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScreenContainer>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={[styles.headerTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {renderHeaderTitle()}
              </Text>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            </View>
            {renderHeaderSubtitle() && (
              <Text
                style={[
                  styles.headerSubtitle,
                  {
                    color:
                      channel.type === 'direct' && isOtherUserOnline && otherMember?.show_online !== 'nobody'
                        ? '#22C55E'
                        : colors.muted,
                  },
                ]}
                numberOfLines={1}
              >
                {renderHeaderSubtitle()}
              </Text>
            )}
          </View>
        </View>

        {/* Message List */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isRead =
              item.message_reads &&
              item.message_reads.some((r: any) => r.user_id !== item.sender_id);

            // Determine if we need to show a date divider
            let showDateDivider = false;
            let dateText = '';
            if (index === 0) {
              showDateDivider = true;
            } else {
              const prevItem = messages[index - 1];
              const prevDate = new Date(prevItem.created_at).toDateString();
              const currDate = new Date(item.created_at).toDateString();
              if (prevDate !== currDate) {
                showDateDivider = true;
              }
            }

            if (showDateDivider) {
              const messageDate = new Date(item.created_at);
              const today = new Date();
              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);

              if (messageDate.toDateString() === today.toDateString()) {
                dateText = 'Today';
              } else if (messageDate.toDateString() === yesterday.toDateString()) {
                dateText = 'Yesterday';
              } else {
                dateText = messageDate.toLocaleDateString([], {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
              }
            }

            return (
              <View>
                {showDateDivider && (
                  <View style={styles.dateDivider}>
                    <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.dateText, { color: colors.muted, backgroundColor: colors.background }]}>
                      {dateText}
                    </Text>
                  </View>
                )}
                <ChatBubble
                  message={item}
                  onReply={setReplyToMessage}
                  onReact={handleReact}
                  onDelete={handleDeleteMessage}
                  isRead={isRead}
                />
              </View>
            );
          }}
          contentContainerStyle={{ paddingVertical: 20 }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Typing dots */}
        {typingUsers.length > 0 && <TypingIndicator />}

        {/* Reply Quoted Composer Bar */}
        {replyToMessage && (
          <View
            style={[
              styles.replyComposerBar,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopWidth: 1,
              },
            ]}
          >
            <View
              style={[
                styles.replyComposerLine,
                { backgroundColor: colors.primary },
              ]}
            />
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text
                style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}
              >
                Replying to {replyToMessage.sender?.full_name || 'User'}
              </Text>
              <Text
                style={{ fontSize: 12, color: colors.foreground }}
                numberOfLines={1}
              >
                {replyToMessage.content}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyToMessage(null)}
              style={{ padding: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <PremiumInput
            placeholder="Type a message..."
            value={inputText}
            onChangeText={handleTextChange}
            containerClassName="flex-1 mr-3"
            editable={!sending}
          />

          <Pressable
            onPress={handleSend}
            disabled={sending || !inputText.trim()}
            style={[
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity: sending || !inputText.trim() ? 0.4 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={16} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyComposerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  replyComposerLine: {
    width: 4,
    height: '80%',
    borderRadius: 2,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  dateLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    textTransform: 'capitalize',
  },
});


