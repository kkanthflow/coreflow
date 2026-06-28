import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { RoleBadge } from '@/components/ui/role-badge';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { hasPermission } from '@/lib/permissions';

export default function TeamDirectoryScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      // 1. Get current user's organizations
      const { data: myOrgs, error: orgsError } = await supabase
        .from('user_organizations')
        .select('org_id')
        .eq('user_id', user.id);
        
      if (orgsError) {
        throw new Error(`Failed to fetch orgs: ${orgsError.message}`);
      }
        
      const orgIds = myOrgs?.map(o => o.org_id) || [];
      console.log('[TeamDirectory] Current user orgIds:', orgIds);
      
      if (orgIds.length === 0) {
        // Fallback: Fetch all users in the system if no organization links exist
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, role, avatar_url, department');
        if (error) {
          throw new Error(`Failed to fetch fallback users: ${error.message}`);
        }
        if (data) {
          const sorted = [...data].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
          setMembers(sorted);
        }
      } else {
        // 2. Fetch user IDs in those organizations
        const { data: orgUsers, error: orgUsersError } = await supabase
          .from('user_organizations')
          .select('user_id')
          .in('org_id', orgIds);
        
        if (orgUsersError) {
          throw new Error(`Failed to fetch org user IDs: ${orgUsersError.message}`);
        }
        
        const userIds = orgUsers?.map(u => u.user_id) || [];
        
        if (userIds.length > 0) {
          // 3. Fetch user profiles for those IDs
          const { data: profiles, error: profilesError } = await supabase
            .from('users')
            .select('id, full_name, email, role, avatar_url, department')
            .in('id', userIds);
            
          if (profilesError) {
            throw new Error(`Failed to fetch user profiles: ${profilesError.message}`);
          }
          
          if (profiles) {
            const sorted = [...profiles].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
            setMembers(sorted);
          }
        } else {
          setMembers([]);
        }
      }
    } catch (e: any) {
      console.error('[TeamDirectory] Error fetching members:', e);
      setFetchError(e.message || String(e));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let frameId: number;
    if (user) {
      frameId = requestAnimationFrame(() => {
        fetchTeamMembers();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [user, fetchTeamMembers]);

  const filteredMembers = members.filter((m) => {
    const matchesSearch = 
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter ? m.role === roleFilter : true;
    
    return matchesSearch && matchesRole;
  });

  const roles = Array.from(new Set(members.map(m => m.role))).filter(Boolean);

  const canViewDirectory = hasPermission(user?.role, 'view_team_directory');

  if (!canViewDirectory) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Ionicons name="lock-closed" size={48} color={colors.error} className="mb-4" />
        <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
        <Text className="text-muted text-center">You do not have permission to view the team directory.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="px-6 pt-6 pb-4">
        <View className="flex-row items-center mb-6">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">Team Directory</Text>
        </View>

        <View 
          className="flex-row items-center px-4 py-3 rounded-xl border border-border mb-4"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="search" size={20} color={colors.muted} className="mr-2" />
          <TextInput
            placeholder="Search team members..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-foreground font-medium"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {roles.length > 0 && (
          <View className="mb-4">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ role: null, label: 'All' }, ...roles.map(r => ({ role: r, label: r.replace('_', ' ') }))]}
              keyExtractor={(item, index) => item.role || 'all'}
              renderItem={({ item }) => {
                const isActive = roleFilter === item.role;
                return (
                  <Pressable
                    onPress={() => setRoleFilter(item.role)}
                    className="px-4 py-2 rounded-full mr-2 border"
                    style={{ 
                      backgroundColor: isActive ? colors.primary : 'transparent',
                      borderColor: isActive ? colors.primary : colors.border
                    }}
                  >
                    <Text 
                      className="font-medium capitalize"
                      style={{ color: isActive ? '#fff' : colors.foreground }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable 
              onPress={() => router.push(`/team/${item.id}` as any)}
              className="flex-row items-center p-4 mb-3 rounded-2xl border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="relative">
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} className="w-12 h-12 rounded-full mr-4" />
                ) : (
                  <View className="w-12 h-12 rounded-full mr-4 items-center justify-center bg-primary/20">
                    <Text className="text-primary font-bold text-lg">
                      {item.full_name?.charAt(0) || '?'}
                    </Text>
                  </View>
                )}
                {/* Active Status indicator mockup */}
                <View className="absolute bottom-0 right-4 w-3 h-3 rounded-full bg-success border-2" style={{ borderColor: colors.surface }} />
              </View>
              
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground mb-1">
                  {item.full_name}
                </Text>
                <Text className="text-sm text-muted mb-2">
                  {item.email}
                </Text>
                <RoleBadge role={item.role} size="sm" />
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="py-12 items-center px-4">
              <Ionicons name="people-outline" size={48} color={colors.muted} className="mb-4" />
              <Text className="text-lg text-foreground font-medium text-center">No members found</Text>
              <Text className="text-sm text-muted text-center mt-2 mb-6">Try adjusting your search filters.</Text>
              
              <View className="p-4 rounded-xl border border-border w-full mt-4 bg-surface" style={{ backgroundColor: colors.surface }}>
                <Text className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">Diagnostic Info:</Text>
                <Text className="text-xs text-foreground mb-1">Email: {user?.email || 'N/A'}</Text>
                <Text className="text-xs text-foreground mb-1">User ID: {user?.id || 'N/A'}</Text>
                <Text className="text-xs text-foreground mb-1">Role: {user?.role || 'N/A'}</Text>
                <Text className="text-xs text-foreground mb-1">Org ID: {user?.organizationId || 'N/A'}</Text>
                <Text className="text-xs text-foreground mb-1">Org Name: {user?.organizationName || 'N/A'}</Text>
                {fetchError && (
                  <Text className="text-xs text-error mt-2 font-semibold">Error: {fetchError}</Text>
                )}
              </View>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
