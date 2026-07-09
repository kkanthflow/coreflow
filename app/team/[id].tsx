import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, Modal, TextInput, KeyboardAvoidingView, Alert, Platform, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { RoleBadge } from '@/components/ui/role-badge';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { hasPermission } from '@/lib/permissions';

export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [member, setMember] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Profile States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchMemberProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
        
      if (data && !error) {
        setMember(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let frameId: number;
    if (id) {
      frameId = requestAnimationFrame(() => {
        fetchMemberProfile();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [id, fetchMemberProfile]);

  const canManageRoles = hasPermission(user?.role, 'manage_roles');

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!member) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Ionicons name="person-outline" size={48} color={colors.muted} className="mb-4" />
        <Text className="text-xl font-bold text-foreground mb-2">Member Not Found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-3 rounded-xl bg-primary">
          <Text className="text-primary-foreground font-bold">Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable 
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.foreground} />
            </Pressable>
            <Text className="text-xl font-bold text-foreground">Member Profile</Text>
          </View>
          {user?.id === member.id && (
            <Pressable 
              onPress={() => {
                setFullName(member.full_name || '');
                setIsEditModalVisible(true);
              }}
              className="px-4 py-2 rounded-xl flex-row items-center gap-1.5"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text className="text-sm font-bold" style={{ color: colors.primary }}>Edit</Text>
            </Pressable>
          )}
        </View>

        {/* Profile Info */}
        <View className="px-6 py-6 items-center">
          <View className="relative mb-6">
            {member.avatar_url ? (
              <Image source={{ uri: member.avatar_url }} className="w-32 h-32 rounded-full" />
            ) : (
              <View className="w-32 h-32 rounded-full items-center justify-center bg-primary/20">
                <Text className="text-primary font-bold text-5xl">
                  {member.full_name?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <View className="absolute bottom-1 right-2 w-6 h-6 rounded-full bg-success border-4" style={{ borderColor: colors.background }} />
          </View>
          
          <Text className="text-2xl font-bold text-foreground mb-2">{member.full_name}</Text>
          <RoleBadge role={member.role} size="lg" />
          
          {member.department && (
            <Text className="text-base text-muted mt-3 font-medium">
              Department: {member.department}
            </Text>
          )}
        </View>

        {/* Contact Info Card */}
        <View className="px-6 mb-8">
          <Text className="text-lg font-bold text-foreground mb-4">Contact Information</Text>
          <View className="p-4 rounded-2xl border border-border" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10 mr-4">
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Email</Text>
                <Text className="text-base text-foreground font-medium">{member.email}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10 mr-4">
                <Ionicons name="time-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Joined</Text>
                <Text className="text-base text-foreground font-medium">
                  {new Date(member.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Admin Actions */}
        {canManageRoles && user?.id !== member.id && (
          <View className="px-6 pb-12">
            <Text className="text-lg font-bold text-error mb-4">Admin Actions</Text>
            <View className="p-4 rounded-2xl border border-error/30" style={{ backgroundColor: `${colors.error}10` }}>
              <Text className="text-sm text-foreground mb-4">
                You have permission to manage this user&apos;s role and access level within the organization.
              </Text>
              <Pressable 
                onPress={() => router.push(`/admin/roles?userId=${member.id}` as any)}
                className="flex-row items-center justify-center py-3 rounded-xl bg-error"
              >
                <Ionicons name="shield" size={18} color="#fff" className="mr-2" />
                <Text className="text-white font-bold text-base">Manage Role</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      {isEditModalVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} className="justify-end bg-black/50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => { if (!isUpdating) setIsEditModalVisible(false); }} />
            <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-foreground">Edit Profile</Text>
                <Pressable
                  onPress={() => { if (!isUpdating) setIsEditModalVisible(false); }}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              
              <Text className="text-xs text-muted mb-4">
                Update your public profile display name.
              </Text>

              <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Full Name *</Text>
              <TextInput
                placeholder="Krishnakanth"
                placeholderTextColor={colors.muted}
                value={fullName}
                onChangeText={setFullName}
                editable={!isUpdating}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-6"
                style={{ backgroundColor: colors.surface }}
              />

              <Pressable
                onPress={async () => {
                  if (!fullName.trim()) {
                    Alert.alert('Validation Error', 'Full Name is required.');
                    return;
                  }
                  setIsUpdating(true);
                  try {
                    const { error } = await supabase
                      .from('users')
                      .update({ full_name: fullName.trim() })
                      .eq('id', user?.id);

                    if (error) throw error;

                    Alert.alert('Success', 'Profile updated successfully.');
                    setIsEditModalVisible(false);
                    fetchMemberProfile();
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Could not update profile.');
                  } finally {
                    setIsUpdating(false);
                  }
                }}
                disabled={isUpdating}
                className="p-4 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.primary, opacity: isUpdating ? 0.6 : 1 }}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-base">Save Changes</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </ScreenContainer>
  );
}
