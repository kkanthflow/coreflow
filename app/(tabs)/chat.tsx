import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  Animated, StatusBar, TextInput,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { ChannelListItem } from '@/components/ui/channel-list-item';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ShimmerCard } from '@/components/ui/shimmer-loader';

import { decryptKeyWithSender, decryptMessagePayload } from '@/lib/crypto';
import { useColors } from '@/hooks/use-colors';

export default function ChatScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const colors   = useColors();
  const colorScheme = useColorScheme();

  const C = {
    bg: colors.background,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    error: colors.error,
    info: colors.info,
  };

  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchChannels = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      // Fetch blocks
      const { data: blockedList } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);
      const blockedIds = (blockedList || []).map((b: any) => b.blocked_id);

      // Fetch mutes
      const { data: mutedList } = await supabase
        .from('channel_mutes')
        .select('channel_id')
        .eq('user_id', user.id);
      const mutedChannelIds = (mutedList || []).map((m: any) => m.channel_id);

      // Fetch channels along with members
      const { data, error } = await supabase
        .from('chat_channels')
        .select(`
          *,
          channel_members(
            user_id,
            last_read_at,
            user:user_id(
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enhance with unread counts and last message details
      const channelsWithStats = await Promise.all(
        (data || []).map(async (ch: any) => {
          const { data: lastMsgData } = await supabase
            .from('chat_messages')
            .select('content, created_at, sender_id')
            .eq('channel_id', ch.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMsg = lastMsgData && lastMsgData[0];
          
          let lastMsgText = lastMsg?.content || ch.description || 'No messages yet';

          // Decrypt if encrypted
          if (lastMsgText && lastMsgText.startsWith('__E2EE__:')) {
            const { data: myKeyData } = await supabase
              .from('channel_keys')
              .select('encrypted_key')
              .eq('channel_id', ch.id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (myKeyData) {
              const creatorId = ch.created_by || user.id;
              const { data: creatorKeyData } = await supabase
                .from('user_public_keys')
                .select('public_key')
                .eq('user_id', creatorId)
                .single();

              if (creatorKeyData) {
                try {
                  const symmetricKey = await decryptKeyWithSender(myKeyData.encrypted_key, creatorKeyData.public_key);
                  const ciphertext = lastMsgText.substring('__E2EE__:'.length);
                  const decrypted = await decryptMessagePayload(ciphertext, symmetricKey);
                  lastMsgText = decrypted?.text || '[Decryption Failed]';
                } catch (err) {
                  console.warn('Error decrypting preview:', err);
                }
              }
            }
          }
          
          const myMembership = ch.channel_members?.find((m: any) => m.user_id === user.id);
          const lastReadAt = myMembership?.last_read_at || ch.created_at;

          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .gt('created_at', lastReadAt)
            .neq('sender_id', user.id);

          let displayName = ch.name;
          let isBlocked = false;
          const other = ch.channel_members?.find((m: any) => m.user_id !== user.id)?.user;
          
          if (ch.type === 'direct') {
            if (other) {
              displayName = other.full_name;
              isBlocked = blockedIds.includes(other.id);
            }
          }

          const isMuted = mutedChannelIds.includes(ch.id);

          return {
            ...ch,
            name: displayName,
            unreadCount: count || 0,
            lastMessageText: lastMsgText,
            lastMessageTime: lastMsg?.created_at || ch.created_at,
            isBlocked,
            isMuted,
          };
        })
      );

      // Filter out blocked DMs and sort by activity
      const activeChannels = channelsWithStats
        .filter((ch: any) => !ch.isBlocked)
        .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

      setChannels(activeChannels);
    } catch (e) {
      console.error('Chat channels error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchChannels();
    }, [fetchChannels])
  );

  useEffect(() => {
    if (!user) return;

    const listChannel = supabase
      .channel('chat:list-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          fetchChannels();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_channels',
        },
        () => {
          fetchChannels();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_members',
        },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(listChannel);
    };
  }, [user, fetchChannels]);

  const filtered = channels.filter(ch =>
    !search || ch.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View>
            <Text style={[styles.title, { color: C.text }]}>Messages</Text>
            <Text style={styles.subtitle}>{channels.length} channel{channels.length !== 1 ? 's' : ''}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/chat/new-dm' as any)}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: pressed ? '#FF6B4A30' : '#FF6B4A20',
              borderWidth: 1, borderColor: '#FF6B4A40',
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Ionicons name="create-outline" size={20} color={C.primary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
          <Ionicons name="search-outline" size={16} color={C.muted} />
          <TextInput
            placeholder="Search channels..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, color: C.text, fontSize: 14, marginLeft: 8 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {loading ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ChannelListItem
              channel={item}
              onPress={() => router.push(`/chat/${item.id}` as any)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="chatbubbles-outline" size={36} color={C.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.text }]}>{search ? 'No channels found' : 'No conversations'}</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try a different search term' : 'Start a direct message or join a project thread.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { color: '#F5F5FA', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#7A7A92', fontSize: 14, marginTop: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#181822',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#2A2A3A',
  },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#181822', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#2A2A3A' },
  emptyTitle: { color: '#F5F5FA', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#7A7A92', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

