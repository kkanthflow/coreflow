import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NewDMScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.organizationId) return;

    // Fetch members of the same organization
    supabase
      .from('user_organizations')
      .select(`
        user_id,
        users (
          id,
          full_name,
          email
        )
      `)
      .eq('org_id', user.organizationId)
      .then(({ data, error }) => {
        if (data && !error) {
          const list = data
            .map((d: any) => d.users)
            .filter((u: any) => u && u.id !== user.id);
          setUsers(list);
        }
        setLoading(false);
      });
  }, [user]);

  const handleStartDM = async (targetUserId: string, targetName: string) => {
    if (!user?.organizationId || !user?.id) return;
    setLoading(true);

    try {
      // 1. Check if a DM channel already exists between these two users
      const { data: myDMs } = await supabase
        .from('chat_channels')
        .select(`
          id,
          name,
          type,
          channel_members(user_id)
        `)
        .eq('org_id', user.organizationId)
        .eq('type', 'direct');

      const existingDM = (myDMs || []).find((dm: any) => {
        const members = dm.channel_members || [];
        return (
          members.length === 2 &&
          members.some((m: any) => m.user_id === user.id) &&
          members.some((m: any) => m.user_id === targetUserId)
        );
      });

      if (existingDM) {
        // Redirect to existing channel
        router.replace(`/chat/${existingDM.id}` as any);
        return;
      }

      // 2. If it doesn't exist, create a new channel
      const { data: newChan, error: chanError } = await supabase
        .from('chat_channels')
        .insert({
          org_id: user.organizationId,
          name: `DM: ${user.fullName} & ${targetName}`,
          type: 'direct',
          is_private: true,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (chanError) throw chanError;

      // 3. Add both users to channel members
      await supabase.from('channel_members').insert([
        { channel_id: newChan.id, user_id: user.id, role: 'member' },
        { channel_id: newChan.id, user_id: targetUserId, role: 'member' },
      ]);

      router.replace(`/chat/${newChan.id}` as any);
    } catch (e: any) {
      Alert.alert('Error starting chat', e.message || 'An error occurred.');
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Conversation</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleStartDM(item.id, item.full_name)}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {item.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.full_name}</Text>
                <Text style={[styles.email, { color: colors.muted }]}>{item.email}</Text>
              </View>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.muted }}>No team members found to chat with.</Text>
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  email: {
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
});
