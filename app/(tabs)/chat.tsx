import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  Animated, StatusBar, TextInput,
} from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { ChannelListItem } from '@/components/ui/channel-list-item';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { ShimmerCard, ShimmerLoader } from '@/components/ui/shimmer-loader';

const C = {
  bg: '#07070B', card: '#181822', border: '#2A2A3A',
  primary: '#FF6B4A', text: '#F5F5FA', textSec: '#B4B4C7',
  muted: '#7A7A92', error: '#F87171', info: '#60A5FA',
};

export default function ChatScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-16)).current;

  const isFreelancer = user?.role === 'freelancer';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchChannels = useCallback(async () => {
    if (!user?.organizationId || isFreelancer) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .select('*, channel_members(user_id)')
        .eq('org_id', user.organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const filtered = (data || []).filter((ch: any) => {
        if (['org_general', 'org_announcement', 'project'].includes(ch.type)) return true;
        return (ch.channel_members || []).some((m: any) => m.user_id === user.id);
      });

      setChannels(filtered);
    } catch (e) {
      console.error('Chat channels error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId, user?.id, isFreelancer]);

  useFocusEffect(useCallback(() => { fetchChannels(); }, [fetchChannels]));

  if (isFreelancer) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: `${C.error}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: `${C.error}30` }}>
          <Ionicons name="lock-closed" size={32} color={C.error} />
        </View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 10 }}>Access Restricted</Text>
        <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Freelancers don't have access to company-wide channels. Communicate through project discussion pages.
        </Text>
      </View>
    );
  }

  const filtered = channels.filter(ch =>
    !search || ch.name?.toLowerCase().includes(search.toLowerCase())
  );

  const channelTypeIcon = (type: string) => {
    switch (type) {
      case 'org_general':      return 'grid-outline';
      case 'org_announcement': return 'megaphone-outline';
      case 'project':          return 'briefcase-outline';
      default:                 return 'chatbubble-outline';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View>
            <Text style={styles.title}>Messages</Text>
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
        <View style={styles.searchBar}>
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
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={36} color={C.muted} />
              </View>
              <Text style={styles.emptyTitle}>{search ? 'No channels found' : 'No conversations'}</Text>
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
