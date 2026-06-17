import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { ChannelListItem } from '@/components/ui/channel-list-item';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { canAccessOrgChat } from '@/lib/permissions';

export default function ChatScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isFreelancer = user?.role === 'freelancer';

  const fetchChannels = useCallback(async () => {
    if (!user?.organizationId || isFreelancer) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // Query channels matching RLS rules:
      // 1. Org General/Announcements for org
      // 2. Project channels where user is a project member or general org member
      // 3. Direct Message channels where user is explicit member
      const { data, error } = await supabase
        .from('chat_channels')
        .select(`
          *,
          channel_members(user_id)
        `)
        .eq('org_id', user.organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter channels where we have permission or membership
      const filtered = (data || []).filter((ch: any) => {
        if (ch.type === 'org_general' || ch.type === 'org_announcement') {
          return true;
        }
        if (ch.type === 'project') {
          return true;
        }
        // DM: must be a member
        const members = ch.channel_members || [];
        return members.some((m: any) => m.user_id === user.id);
      });

      setChannels(filtered);
    } catch (e) {
      console.error('Error fetching chat channels:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId, user?.id, isFreelancer]);

  useFocusEffect(
    useCallback(() => {
      fetchChannels();
    }, [fetchChannels])
  );

  if (isFreelancer) {
    return (
      <ScreenContainer style={styles.lockedContainer}>
        <Ionicons name="lock-closed" size={64} color={colors.error} style={{ marginBottom: 16 }} />
        <Text style={[styles.lockedTitle, { color: colors.foreground }]}>Access Gated</Text>
        <Text style={[styles.lockedSubtitle, { color: colors.muted }]}>
          Freelancers do not have access to company-wide channels or general chat. You can communicate directly through project discussion pages.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Messages</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Slack-style threads & direct messaging
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/chat/new-dm' as any)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <ChannelListItem
              channel={item}
              onPress={() => router.push(`/chat/${item.id}` as any)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.muted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No conversations</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                Start a direct message or join organization project threads.
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  lockedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
