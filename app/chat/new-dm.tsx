import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NewDMScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    async function loadMembers() {
      if (!user?.organizationId) {
        console.log('[NewDM] No organization ID for user:', user);
        setLoading(false); 
        return; 
      }

      console.log('[NewDM] Fetching members for org:', user.organizationId);
      setFetchError(null);

      try {
        const { data: orgUsers, error: orgUsersError } = await supabase
          .from('user_organizations')
          .select('user_id')
          .eq('org_id', user.organizationId);

        if (orgUsersError) {
          console.error('[NewDM] Error fetching member IDs:', orgUsersError);
          setFetchError(orgUsersError.message);
          setLoading(false);
          return;
        }

        const userIds = orgUsers?.map(u => u.user_id) || [];
        
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', userIds);

          if (profilesError) {
            console.error('[NewDM] Error fetching profiles:', profilesError);
            setFetchError(profilesError.message);
          }

          if (profiles) {
            const list = profiles.filter((u: any) => u && u.id !== user.id);
            console.log('[NewDM] Processed user list:', list);
            setUsers(list);
          }
        } else {
          setUsers([]);
        }
      } catch (err: any) {
        console.error('[NewDM] Query exception:', err);
        setFetchError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    loadMembers();
  }, [user]);

  const handleStartDM = async (targetUserId: string, targetName: string) => {
    setLoading(true);

    try {
      // Get the fresh active session
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      if (!currentUserId) {
        throw new Error("No active session found. Please log in again.");
      }

      // Fetch the active organization ID for this user from user_organizations
      const { data: userOrg, error: userOrgError } = await supabase
        .from('user_organizations')
        .select('org_id, role')
        .eq('user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      if (userOrgError || !userOrg) {
        throw new Error(userOrgError?.message || "You do not belong to any organization.");
      }

      const activeOrgId = userOrg.org_id;

      // 1. Check if a DM channel already exists between these two users
      const { data: myDMs, error: dmsError } = await supabase
        .from('chat_channels')
        .select(`
          id,
          name,
          type,
          channel_members(user_id)
        `)
        .eq('org_id', activeOrgId)
        .eq('type', 'direct');

      if (dmsError) throw dmsError;

      const existingDM = (myDMs || []).find((dm: any) => {
        const members = dm.channel_members || [];
        return (
          members.length === 2 &&
          members.some((m: any) => m.user_id === currentUserId) &&
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
          org_id: activeOrgId,
          name: `DM: ${user?.fullName || 'User'} & ${targetName}`,
          type: 'direct',
          is_private: true,
          created_by: currentUserId,
        })
        .select('id')
        .single();

      if (chanError) throw chanError;

      // 3. Add both users to channel members
      const { error: membersError } = await supabase.from('channel_members').insert([
        { channel_id: newChan.id, user_id: currentUserId, role: 'member' },
        { channel_id: newChan.id, user_id: targetUserId, role: 'member' },
      ]);

      if (membersError) throw membersError;

      router.replace(`/chat/${newChan.id}` as any);
    } catch (e: any) {
      console.error('[NewDM] Error starting chat:', e);
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
            <View style={[styles.empty, { paddingHorizontal: 24 }]}>
              <Ionicons name="people-outline" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                No team members found to chat with
              </Text>
              
              <View style={{
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginTop: 20,
                width: '100%'
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8, textTransform: 'uppercase' }}>
                  Diagnostic Info:
                </Text>
                <Text style={{ fontSize: 12, color: colors.foreground, marginBottom: 4 }}>Email: {user?.email || 'N/A'}</Text>
                <Text style={{ fontSize: 12, color: colors.foreground, marginBottom: 4 }}>User ID: {user?.id || 'N/A'}</Text>
                <Text style={{ fontSize: 12, color: colors.foreground, marginBottom: 4 }}>Role: {user?.role || 'N/A'}</Text>
                <Text style={{ fontSize: 12, color: colors.foreground, marginBottom: 4 }}>Org ID: {user?.organizationId || 'N/A'}</Text>
                <Text style={{ fontSize: 12, color: colors.foreground, marginBottom: 4 }}>Org Name: {user?.organizationName || 'N/A'}</Text>
                {fetchError && (
                  <Text style={{ fontSize: 12, color: colors.error, marginTop: 8, fontWeight: '600' }}>Error: {fetchError}</Text>
                )}
              </View>
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

