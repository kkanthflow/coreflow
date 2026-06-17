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
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { ChatBubble } from '@/components/ui/chat-bubble';
import { TypingIndicator } from '@/components/ui/typing-indicator';
import { PremiumInput } from '@/components/ui/premium-input';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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
  
  const listRef = useRef<FlatList>(null);

  const fetchChannelData = useCallback(async () => {
    if (!channelId) return;
    try {
      // Fetch channel info
      const { data: chanData, error: chanError } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (chanError) throw chanError;
      setChannel(chanData);

      // Fetch message history
      const { data: msgData } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:sender_id(full_name, avatar_url)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);

      setMessages(msgData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchChannelData();

    // Subscribe to new messages in realtime
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
          // Fetch sender details for the new message
          const { data: senderData } = await supabase
            .from('users')
            .select('full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const completeMessage = {
            ...payload.new,
            sender: senderData,
          };

          setMessages((prev) => [...prev, completeMessage]);
          
          // Scroll to bottom
          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [channelId, fetchChannelData]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: channelId,
          sender_id: user?.id,
          content: inputText.trim(),
        });

      if (error) throw error;
      setInputText('');
    } catch (e: any) {
      console.error(e);
    } finally {
      setSending(false);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScreenContainer>
        {/* Header */}
        <View style={styles.header}>
          <Pressable 
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {channel.type === 'org_general' ? 'general' : channel.name}
            </Text>
            {channel.description && (
              <Text style={[styles.headerSubtitle, { color: colors.muted }]} numberOfLines={1}>
                {channel.description}
              </Text>
            )}
          </View>
        </View>

        {/* Message List */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ paddingVertical: 20 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Typing dots */}
        {typingUsers.length > 0 && <TypingIndicator />}

        {/* Input Bar */}
        <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <PremiumInput
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            containerClassName="flex-1 mr-3"
            editable={!sending}
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendBtn,
              { 
                backgroundColor: inputText.trim() ? colors.primary : colors.border,
                opacity: sending ? 0.7 : 1
              }
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
});
