import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacySettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOnline, setShowOnline] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [showLastSeen, setShowLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [readReceipts, setReadReceipts] = useState<boolean>(true);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [mutedChannels, setMutedChannels] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadPrivacySettings();
  }, [user]);

  const loadPrivacySettings = async () => {
    try {
      setLoading(true);
      // 1. Load preferences
      const { data: settings, error: settingsError } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      if (settings) {
        setShowOnline(settings.show_online);
        setShowLastSeen(settings.show_last_seen);
        setReadReceipts(settings.enable_read_receipts);
      } else {
        // Create default settings if not exists
        await supabase.from('privacy_settings').insert({
          user_id: user?.id,
          show_online: 'everyone',
          show_last_seen: 'everyone',
          enable_read_receipts: true,
        });
      }

      // 2. Load blocked users
      const { data: blocks, error: blocksError } = await supabase
        .from('user_blocks')
        .select('blocked_id, blocked:blocked_id(id, full_name, email)');

      if (blocksError) throw blocksError;
      setBlockedUsers(blocks || []);

      // 3. Load muted channels
      const { data: mutes, error: mutesError } = await supabase
        .from('channel_mutes')
        .select('channel_id, channel:channel_id(id, name, type)');

      if (mutesError) throw mutesError;
      setMutedChannels(mutes || []);

    } catch (err: any) {
      console.error('Error loading privacy settings:', err);
      Alert.alert('Error', 'Failed to load privacy settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetting = async (key: string, value: any) => {
    if (!user) return;
    try {
      setSaving(true);
      const updates = {
        [key]: value,
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('privacy_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error saving setting:', err);
      Alert.alert('Error', 'Failed to save setting.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);

      if (error) throw error;
      setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedId));
      Alert.alert('Success', 'User unblocked successfully.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Failed to unblock user.');
    }
  };

  const handleUnmute = async (channelId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('channel_mutes')
        .delete()
        .eq('user_id', user.id)
        .eq('channel_id', channelId);

      if (error) throw error;
      setMutedChannels(prev => prev.filter(m => m.channel_id !== channelId));
      Alert.alert('Success', 'Chat unmuted.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Failed to unmute chat.');
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-4 flex-row items-center">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">Privacy Controls</Text>
        </View>

        {/* Visibility Options */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Status Visibility</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            
            {/* Show Online */}
            <View className="p-4 border-b border-border">
              <Text className="text-base font-semibold text-foreground">Who can see my online status</Text>
              <View className="flex-row gap-2 mt-3">
                {(['everyone', 'contacts', 'nobody'] as const).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setShowOnline(option);
                      handleSaveSetting('show_online', option);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl items-center border border-border"
                    style={{
                      backgroundColor: showOnline === option ? colors.primary : 'transparent',
                      borderColor: showOnline === option ? colors.primary : colors.border
                    }}
                  >
                    <Text className="text-xs font-bold capitalize" style={{ color: showOnline === option ? '#FFFFFF' : colors.foreground }}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Show Last Seen */}
            <View className="p-4">
              <Text className="text-base font-semibold text-foreground">Who can see my last seen status</Text>
              <View className="flex-row gap-2 mt-3">
                {(['everyone', 'contacts', 'nobody'] as const).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setShowLastSeen(option);
                      handleSaveSetting('show_last_seen', option);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl items-center border border-border"
                    style={{
                      backgroundColor: showLastSeen === option ? colors.primary : 'transparent',
                      borderColor: showLastSeen === option ? colors.primary : colors.border
                    }}
                  >
                    <Text className="text-xs font-bold capitalize" style={{ color: showLastSeen === option ? '#FFFFFF' : colors.foreground }}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

          </View>
        </View>

        {/* Read Receipts */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Messaging</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 mr-4">
                <Text className="text-base font-semibold text-foreground">Read Receipts</Text>
                <Text className="text-xs text-muted">If turned off, you won't send or receive read receipts.</Text>
              </View>
              <Switch 
                value={readReceipts} 
                onValueChange={(val) => {
                  setReadReceipts(val);
                  handleSaveSetting('enable_read_receipts', val);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Blocked Users */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Blocked Users</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            {blockedUsers.length === 0 ? (
              <View className="p-4 items-center">
                <Text className="text-sm text-muted">No blocked users</Text>
              </View>
            ) : (
              blockedUsers.map((item) => (
                <View key={item.blocked_id} className="flex-row items-center justify-between p-4 border-b border-border">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-semibold text-foreground">{item.blocked?.full_name || 'User'}</Text>
                    <Text className="text-xs text-muted">{item.blocked?.email || ''}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleUnblock(item.blocked_id)}
                    className="py-1 px-3 rounded-lg bg-primary/10 border border-primary/20"
                  >
                    <Text className="text-xs font-bold text-primary">Unblock</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Muted Chats */}
        <View className="px-6 mb-12">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Muted Conversations</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            {mutedChannels.length === 0 ? (
              <View className="p-4 items-center">
                <Text className="text-sm text-muted">No muted conversations</Text>
              </View>
            ) : (
              mutedChannels.map((item) => (
                <View key={item.channel_id} className="flex-row items-center justify-between p-4 border-b border-border">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-semibold text-foreground">{item.channel?.name || 'Muted Channel'}</Text>
                    <Text className="text-xs text-muted capitalize">{item.channel?.type || ''}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleUnmute(item.channel_id)}
                    className="py-1 px-3 rounded-lg bg-primary/10 border border-primary/20"
                  >
                    <Text className="text-xs font-bold text-primary">Unmute</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}
