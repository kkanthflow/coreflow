import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hasPermission } from '@/lib/permissions';

export default function TestAccountsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTestAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all active test accounts from test_accounts table and join with users
      const { data, error } = await supabase
        .from('test_accounts')
        .select(`
          id,
          created_at,
          deleted_at,
          users:user_id(id, full_name, email, role)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (data && !error) {
        setAccounts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let frameId: number;
    if (user) {
      frameId = requestAnimationFrame(() => {
        fetchTestAccounts();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [user, fetchTestAccounts]);

  const handleSoftDelete = (testAccountId: string, userId: string, userName: string) => {
    Alert.alert(
      'Delete Test Account',
      `Are you sure you want to soft delete ${userName}? This will restrict their access without removing database records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => executeSoftDelete(testAccountId, userId)
        }
      ]
    );
  };

  const executeSoftDelete = async (testAccountId: string, userId: string) => {
    try {
      // 1. Mark as deleted in test_accounts
      const { error: testAccError } = await supabase
        .from('test_accounts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', testAccountId);
        
      if (testAccError) throw testAccError;

      // 2. We could also disable the auth user or change role to an inactive state.
      // For this implementation, we just mark the test account as deleted as per requirements.
      // Optionally, we could remove them from user_organizations to truly cut access.
      
      Alert.alert('Success', 'Test account has been soft deleted.');
      fetchTestAccounts(); // Refresh list
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete test account');
    }
  };

  const canManageTestAccounts = hasPermission(user?.role, 'manage_test_accounts');

  if (!canManageTestAccounts) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Ionicons name="lock-closed" size={48} color={colors.error} className="mb-4" />
        <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
        <Text className="text-muted text-center">You do not have permission to manage test accounts.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="px-6 pt-6 pb-4 flex-row items-center border-b border-border">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Test Accounts</Text>
      </View>

      <View className="px-6 py-4 bg-primary/10 border-b border-border">
        <View className="flex-row items-start">
          <Ionicons name="information-circle" size={20} color={colors.primary} className="mr-2 mt-0.5" />
          <Text className="flex-1 text-sm text-foreground">
            Soft-deleting a test account preserves its related data (meetings, logs) for testing integrity, but flags the account as inactive.
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }}
          renderItem={({ item }) => {
            const userData = item.users || {};
            return (
              <View 
                className="flex-row items-center p-4 mb-4 rounded-2xl border border-border"
                style={{ backgroundColor: colors.surface }}
              >
                <View className="w-12 h-12 rounded-full items-center justify-center bg-tertiary/20 mr-4">
                  <Ionicons name="flask" size={20} color={colors.tertiary} />
                </View>
                
                <View className="flex-1">
                  <Text className="text-base font-bold text-foreground mb-1">
                    {userData.full_name || 'Unknown User'}
                  </Text>
                  <Text className="text-xs text-muted mb-1">{userData.email}</Text>
                  <Text className="text-xs text-muted">Created: {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                <Pressable
                  onPress={() => handleSoftDelete(item.id, userData.id, userData.full_name)}
                  className="w-10 h-10 rounded-full items-center justify-center border border-error/30"
                  style={{ backgroundColor: `${colors.error}10` }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} className="mb-4" />
              <Text className="text-lg text-foreground font-medium text-center">No active test accounts</Text>
              <Text className="text-sm text-muted text-center mt-2">All test accounts have been cleaned up.</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
