import React, { useState } from 'react';
import { View, Text, Switch, Pressable, ScrollView, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PremiumButton } from '@/components/ui/premium-button';

import { useAuth } from '@/hooks/use-auth';

export default function NotificationsPreferencesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updatePreferences } = useAuth();
  
  const [meetingInvites, setMeetingInvites] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const [roleChanges, setRoleChanges] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(false);
  const [emailDigest, setEmailDigest] = useState(true);

  React.useEffect(() => {
    if (user?.preferences) {
      const { meetingInvites, meetingReminders, roleUpdates, systemAlerts, weeklyDigest } = user.preferences;
      requestAnimationFrame(() => {
        setMeetingInvites(meetingInvites);
        setMeetingReminders(meetingReminders);
        setRoleChanges(roleUpdates);
        setSystemAlerts(systemAlerts);
        setEmailDigest(weeklyDigest);
      });
    }
  }, [user]);

  const handleSave = async () => {
    try {
      await updatePreferences({
        meetingInvites,
        meetingReminders,
        roleUpdates: roleChanges,
        systemAlerts,
        weeklyDigest: emailDigest,
      });
      Alert.alert("Success", "Notification preferences saved successfully.");
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to save preferences.");
    }
  };

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
          <Text className="text-xl font-bold text-foreground">Notification Preferences</Text>
        </View>

        {/* Push Notifications Section */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Push Notifications</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Meeting Invitations</Text>
                  <Text className="text-xs text-muted">Notify me of new meeting invites</Text>
                </View>
              </View>
              <Switch 
                value={meetingInvites} 
                onValueChange={setMeetingInvites}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="alarm-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Meeting Reminders</Text>
                  <Text className="text-xs text-muted">Send notifications 15m before meetings</Text>
                </View>
              </View>
              <Switch 
                value={meetingReminders} 
                onValueChange={setMeetingReminders}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="shield-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Role Updates</Text>
                  <Text className="text-xs text-muted">Alert me when my role is updated</Text>
                </View>
              </View>
              <Switch 
                value={roleChanges} 
                onValueChange={setRoleChanges}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">System Alerts</Text>
                  <Text className="text-xs text-muted">Notify about downtime & server maintenance</Text>
                </View>
              </View>
              <Switch 
                value={systemAlerts} 
                onValueChange={setSystemAlerts}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Email Digest Section */}
        <View className="px-6 mb-8">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Email Preferences</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="mail-unread-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Weekly Digest</Text>
                  <Text className="text-xs text-muted">Get weekly summary of tasks & meetings</Text>
                </View>
              </View>
              <Switch 
                value={emailDigest} 
                onValueChange={setEmailDigest}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <View className="px-6 pb-12">
          <PremiumButton
            variant="primary"
            size="lg"
            onPress={handleSave}
            className="w-full"
          >
            Save Preferences
          </PremiumButton>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
