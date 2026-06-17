import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase';
import { PremiumInput } from './premium-input';
import { RoleBadge } from './role-badge';
import { Image } from 'expo-image';
import { useAuth } from '@/hooks/use-auth';

export interface Attendee {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface AttendeePickerProps {
  label?: string;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function AttendeePicker({
  label = 'Attendees',
  selectedIds,
  onSelect,
  onRemove,
  disabled = false,
}: AttendeePickerProps) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useAuth();

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Get current user's organizations
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id);
        
      const orgIds = myOrgs?.map(o => o.organization_id) || [];
      
      if (orgIds.length === 0) {
        setUsers([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch users in those organizations
      let query = supabase
        .from('user_organizations')
        .select('user_id, users!inner(id, full_name, email, role, avatar_url)')
        .in('organization_id', orgIds);
      
      if (searchQuery) {
        query = query.ilike('users.full_name', `%${searchQuery}%`);
      }
      
      const { data, error } = await query.limit(50);
      
      if (data && !error) {
        // Deduplicate users since they might share multiple orgs
        const uniqueUsers = new Map<string, Attendee>();
        data.forEach((d: any) => {
          if (d.users && !uniqueUsers.has(d.users.id)) {
            uniqueUsers.set(d.users.id, {
              id: d.users.id,
              fullName: d.users.full_name,
              email: d.users.email,
              role: d.users.role,
              avatarUrl: d.users.avatar_url,
            });
          }
        });
        setUsers(Array.from(uniqueUsers.values()));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [user, searchQuery]);

  useEffect(() => {
    let frameId: number;
    if (isOpen && user) {
      frameId = requestAnimationFrame(() => {
        fetchUsers();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isOpen, searchQuery, user, fetchUsers]);

  const selectedAttendees = users.filter(u => selectedIds.includes(u.id));

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2 ml-1">
        <Text className="text-sm font-medium text-foreground">
          {label} ({selectedIds.length})
        </Text>
        <Pressable onPress={() => !disabled && setIsOpen(true)}>
          <Text className="text-sm font-bold text-primary">+ Add</Text>
        </Pressable>
      </View>

      {selectedAttendees.length > 0 ? (
        <View className="gap-2">
          {selectedAttendees.map(user => (
            <View 
              key={user.id}
              className="flex-row items-center justify-between p-3 rounded-xl border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row items-center flex-1">
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                ) : (
                  <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
                    <Text className="text-primary font-bold">{user.fullName.charAt(0)}</Text>
                  </View>
                )}
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-foreground">{user.fullName}</Text>
                  <Text className="text-xs text-muted truncate">{user.email}</Text>
                </View>
              </View>
              <Pressable 
                onPress={() => onRemove(user.id)}
                className="p-1"
              >
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => !disabled && setIsOpen(true)}
          className="items-center justify-center py-6 rounded-xl border border-dashed border-border"
        >
          <Ionicons name="people" size={24} color={colors.muted} className="mb-2" />
          <Text className="text-sm text-muted">Tap to invite attendees</Text>
        </Pressable>
      )}

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View className="flex-1 bg-background pt-12">
          <View className="flex-row items-center justify-between px-4 pb-4 border-b border-border">
            <Text className="text-xl font-bold text-foreground">Select Attendees</Text>
            <Pressable onPress={() => setIsOpen(false)}>
              <Text className="text-base font-medium text-primary">Done</Text>
            </Pressable>
          </View>
          
          <View className="p-4">
            <PremiumInput
              label=""
              placeholder="Search by name..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {isLoading && users.length === 0 ? (
            <ActivityIndicator color={colors.primary} className="mt-4" />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <Pressable
                    onPress={() => {
                      if (isSelected) {
                        onRemove(item.id);
                      } else {
                        onSelect(item.id);
                      }
                    }}
                    className={clsx(
                      'flex-row items-center justify-between p-4 rounded-xl mb-3 border',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                    style={{ backgroundColor: isSelected ? undefined : colors.surface }}
                  >
                    <View className="flex-row items-center flex-1">
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                          <Text className="text-primary font-bold text-lg">{item.fullName.charAt(0)}</Text>
                        </View>
                      )}
                      <View className="ml-3 flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>{item.fullName}</Text>
                        </View>
                        <Text className="text-sm text-muted mb-1">{item.email}</Text>
                        <RoleBadge role={item.role as any} size="sm" />
                      </View>
                    </View>
                    
                    <View className={clsx(
                      'w-6 h-6 rounded-full border items-center justify-center ml-2',
                      isSelected ? 'bg-primary border-primary' : 'border-muted'
                    )}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
