import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ProfileDetailsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchMemberDetails();
  }, [id]);

  const fetchMemberDetails = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (data) setMember(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!member) {
    return (
      <ScreenContainer className="justify-center items-center">
        <Text style={{ color: colors.foreground }}>User not found</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="px-6 pt-6 pb-4 flex-row items-center border-b border-border" style={{ borderColor: colors.border }}>
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full items-center justify-center mr-4" style={{ backgroundColor: colors.surface }}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-bold text-foreground">Personal Details</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} className="px-6 pt-6">
        <View className="p-5 rounded-2xl border border-border mb-6" style={{ backgroundColor: colors.surface }}>
          <DetailRow label="Full Name" value={member.full_name || 'Not provided'} />
          <DetailRow label="Email" value={member.email || 'Not provided'} />
          <DetailRow label="Department" value={member.department || 'Not provided'} />
          <DetailRow label="Phone" value={member.phone_number || 'Not provided'} />
          <DetailRow label="Member Since" value={new Date(member.created_at).toLocaleDateString()} hideBorder />
        </View>
        <Text className="text-sm font-bold text-muted mb-4 uppercase tracking-wider ml-2">System Info</Text>
        <View className="p-5 rounded-2xl border border-border mb-12" style={{ backgroundColor: colors.surface }}>
          <DetailRow label="User ID" value={member.id} />
          <DetailRow label="Auth Provider" value="Email" />
          <DetailRow label="Last Active" value={member.updated_at ? new Date(member.updated_at).toLocaleString() : 'Unknown'} hideBorder />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({ label, value, hideBorder = false }: { label: string, value: string, hideBorder?: boolean }) {
  const colors = useColors();
  return (
    <View className={`py-4 ${!hideBorder ? 'border-b' : ''}`} style={{ borderColor: colors.border }}>
      <Text className="text-xs text-muted font-bold mb-1 uppercase">{label}</Text>
      <Text className="text-base text-foreground">{value}</Text>
    </View>
  );
}
