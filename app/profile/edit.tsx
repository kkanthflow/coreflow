import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    job_title: '',
    department: '',
    bio: '',
    phone_number: '',
    email: '',
    timezone: '',
    language: 'English',
  });
  
  // To track unsaved changes
  const [originalData, setOriginalData] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user?.id]);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', user?.id).single();
      if (error) throw error;
      if (data) {
        const payload = {
          full_name: data.full_name || '',
          job_title: data.job_title || '',
          department: data.department || '',
          bio: data.bio || '',
          phone_number: data.phone_number || '',
          email: data.email || '',
          timezone: data.timezone || '',
          language: data.language || 'English',
        };
        setFormData(payload);
        setOriginalData(payload);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load profile data.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasUnsavedChanges = () => {
    if (!originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const handleBackPress = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave without saving?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Discard Changes', style: 'destructive', onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('users').update({
        full_name: formData.full_name,
        department: formData.department,
        // Extend with other fields once DB schema supports them or save in metadata JSON
      }).eq('id', user?.id);
      
      if (error) throw error;
      
      setOriginalData(formData);
      Alert.alert('Success', 'Profile updated successfully.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-border" style={{ borderColor: colors.border }}>
        <Pressable 
          onPress={handleBackPress}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-bold text-foreground">Edit Profile</Text>
        <View className="w-10 h-10" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} className="px-6 pt-6">
          <View className="mb-6">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Full Name *</Text>
            <TextInput
              placeholder="Full Name"
              placeholderTextColor={colors.muted}
              value={formData.full_name}
              onChangeText={(t) => setFormData(p => ({ ...p, full_name: t }))}
              className="px-4 py-3 rounded-2xl border border-border text-base text-foreground"
              style={{ backgroundColor: colors.surface }}
            />
          </View>
          
          <View className="mb-6">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Department</Text>
            <TextInput
              placeholder="Engineering"
              placeholderTextColor={colors.muted}
              value={formData.department}
              onChangeText={(t) => setFormData(p => ({ ...p, department: t }))}
              className="px-4 py-3 rounded-2xl border border-border text-base text-foreground"
              style={{ backgroundColor: colors.surface }}
            />
          </View>

          <View className="mb-6">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Email (Read Only)</Text>
            <TextInput
              value={formData.email}
              editable={false}
              className="px-4 py-3 rounded-2xl border border-border text-base text-muted"
              style={{ backgroundColor: colors.surface, opacity: 0.7 }}
            />
          </View>

          <View className="mb-12">
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              className="p-4 rounded-2xl items-center justify-center flex-row"
              style={{ backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
              ) : null}
              <Text className="text-white font-bold text-base">Save Changes</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
