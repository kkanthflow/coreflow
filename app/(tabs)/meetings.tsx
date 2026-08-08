import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Video, CalendarPlus, Key, Users, Calendar, ChevronRight, Clock, Play } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, FadeInUp, FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '@/components/ui/skeleton';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { scheduleMeetingLocalNotifications } from '@/lib/notifications-helper';
import { ActivityIndicator } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ActionCard = React.memo(function ActionCard({ title, subtitle, icon: Icon, delay, onPress, active, loading }: any) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      entering={FadeInUp.delay(delay).duration(350).springify()}
      onPressIn={() => {
        scale.value = withSpring(0.97);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={onPress}
      style={animatedStyle}
      className={`flex-1 rounded-[24px] p-4 border mb-3 flex-row items-center space-x-4 shadow-lg ${active ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]/30' : 'bg-white dark:bg-[#1E2128] border-gray-200 dark:border-[rgba(255,255,255,0.06)]'}`}
    >
      <View className={`w-12 h-12 rounded-2xl items-center justify-center shadow-md ${active ? 'bg-[#FF6B4A]' : 'bg-gray-100 dark:bg-[#27272A]'}`}>
        {loading ? (
          <ActivityIndicator size="small" color={active ? "#FFFFFF" : "#FF6B4A"} />
        ) : (
          <Icon size={22} color={active ? "#FFFFFF" : "#FF6B4A"} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-black dark:text-white text-base font-bold">{title}</Text>
        <Text className="text-gray-500 dark:text-[#A1A1AA] text-xs mt-0.5">{subtitle}</Text>
      </View>
    </AnimatedPressable>
  );
});

const TimelineCard = React.memo(function TimelineCard({ meeting, delay }: any) {
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const startTime = new Date(meeting.start_time);
  const endTime = new Date(startTime.getTime() + (meeting.duration_minutes || 30) * 60000);
  
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const router = useRouter();

  return (
    <AnimatedPressable
      entering={FadeInRight.delay(delay).duration(250).springify()}
      onPressIn={() => {
        scale.value = withSpring(0.97);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={() => router.push(`/meetings/${meeting.id}` as any)}
      style={animatedStyle}
      className="bg-white dark:bg-[#1E2128] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] border-l-4 border-l-[#FF6B4A] rounded-[20px] p-4 mb-4 flex-row justify-between items-center shadow-lg"
    >
      <View className="flex-1">
        <Text className="text-gray-500 dark:text-[#A1A1AA] text-xs font-semibold mb-1">
          {formatTime(meeting.start_time)} - {formatTime(endTime.toISOString())}
        </Text>
        <Text className="text-black dark:text-white text-lg font-bold mb-1" numberOfLines={1}>{meeting.title}</Text>
        {meeting.description && (
          <Text className="text-gray-500 dark:text-[#A1A1AA] text-sm mb-3" numberOfLines={1}>{meeting.description}</Text>
        )}
        <View className="flex-row items-center space-x-2 mt-1">
          <View className="flex-row">
            <View className="w-6 h-6 rounded-full bg-[#FF6B4A]/20 border border-white dark:border-[#1E2128] items-center justify-center -mr-2 z-20">
               <Text className="text-[10px] text-[#FF6B4A] font-bold">K</Text>
            </View>
            <View className="w-6 h-6 rounded-full bg-[#3B82F6]/20 border border-[#1E2128] items-center justify-center z-10">
               <Text className="text-[10px] text-[#3B82F6] font-bold">S</Text>
            </View>
          </View>
          <Text className="text-[#A1A1AA] text-xs ml-3">+2 others</Text>
        </View>
      </View>
      
      <View className="bg-[#FF6B4A]/10 px-4 py-2 rounded-xl">
        <Text className="text-[#FF6B4A] font-bold text-sm">Join</Text>
      </View>
    </AnimatedPressable>
  );
});

export default function MeetingsDashboard() {
  const router = useRouter();
  const { session, user, activeWorkspace } = useAuth();
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [past, setPast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStartingInstant, setIsStartingInstant] = useState(false);

  const handleInstantMeeting = React.useCallback(async () => {
    if (!user) return;
    setIsStartingInstant(true);
    try {
      let realWorkspaceId = activeWorkspace?.id === 'independent' ? null : activeWorkspace?.id;
      if (activeWorkspace?.id && activeWorkspace.id !== 'independent') {
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('id')
          .eq('organization_id', activeWorkspace.id)
          .limit(1)
          .single();
        if (wsData) {
          realWorkspaceId = wsData.id;
        }
      }

      const roomName = `cf-meeting-${Math.random().toString(36).substring(2, 10)}`;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          workspace_id: realWorkspaceId,
          title: `${user.fullName || 'User'}'s Instant Meeting`,
          host_id: user.id,
          room_name: roomName,
          meeting_link_type: 'coreflow',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'scheduled',
        })
        .select('id')
        .single();

      if (meetingError) throw meetingError;

      await supabase.from('meeting_participants').insert({
        meeting_id: meetingData.id,
        user_id: user.id,
        role: 'host',
        status: 'accepted',
        can_share_screen: true,
        can_record: true,
        can_present: true,
        can_invite: true,
      });

      router.push(`/meetings/pre-join?id=${meetingData.id}` as any);
    } catch (e: any) {
      console.error('Error starting instant meeting:', e);
    } finally {
      setIsStartingInstant(false);
    }
  }, [user, activeWorkspace, router]);

  const handleCreateMeeting = React.useCallback(() => {
    router.push('/meetings/new');
  }, [router]);

  const handleJoinMeeting = React.useCallback(() => {
    router.push('/meetings/pre-join');
  }, [router]);

  const fetchMeetings = React.useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data: upcomingData } = await supabase
        .from('meetings')
        .select('*')
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(3);

      const { data: pastData } = await supabase
        .from('meetings')
        .select('*')
        .lt('start_time', now)
        .order('start_time', { ascending: false })
        .limit(2);

      if (upcomingData) setUpcoming(upcomingData);
      if (pastData) setPast(pastData);
      
      if (user?.id) {
        scheduleMeetingLocalNotifications(user.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      fetchMeetings();
    }, [fetchMeetings])
  );



  return (
    <TabScreenWrapper>
      <Animated.View entering={FadeIn.duration(350)} className="flex-1 bg-gray-50 dark:bg-[#0B0B0D] pt-8 px-6">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-black dark:text-white text-3xl font-bold tracking-tight">Meetings</Text>
            <Text className="text-gray-500 dark:text-[#A1A1AA] text-base mt-1">Connect securely</Text>
          </View>
          <Pressable 
            onPress={() => router.push('/meetings/pre-join')}
            className="w-12 h-12 rounded-full bg-white dark:bg-[#17181D] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] items-center justify-center shadow-lg"
          >
             <Video size={22} color="#FF6B4A" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* Quick Actions */}
          <View className="mb-8">
            <ActionCard 
              title="Instant Meeting" 
              subtitle="Start instantly" 
              icon={Play} 
              delay={0}
              active={true}
              loading={isStartingInstant}
              onPress={handleInstantMeeting} 
            />
            <ActionCard 
              title="Create Meeting" 
              subtitle="Schedule your meeting" 
              icon={CalendarPlus} 
              delay={80}
              onPress={handleCreateMeeting} 
            />
            <ActionCard 
              title="Join with Code" 
              subtitle="Enter meeting code" 
              icon={Key} 
              delay={160}
              onPress={handleJoinMeeting} 
            />
          </View>

          {/* Upcoming Meetings List */}
          <Animated.View entering={FadeInUp.delay(240).duration(350)}>
            <Text className="text-black dark:text-white text-xl font-bold mb-4">Upcoming</Text>
            
            {loading ? (
              <View className="space-y-4">
                <Skeleton className="w-full h-32 rounded-[20px] bg-gray-200 dark:bg-[#1E2128]" />
                <Skeleton className="w-full h-32 rounded-[20px] bg-gray-200 dark:bg-[#1E2128]" />
              </View>
            ) : upcoming.length === 0 ? (
              <Animated.View entering={FadeIn.duration(500)} className="items-center justify-center py-10 bg-white dark:bg-[#17181D] rounded-[24px] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] shadow-lg">
                <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#1E2128] items-center justify-center mb-4">
                  <Calendar size={28} color="#FF6B4A" />
                </View>
                <Text className="text-black dark:text-white text-base font-bold mb-1">No upcoming meetings</Text>
                <Text className="text-gray-500 dark:text-[#A1A1AA] text-sm text-center px-8">Your schedule is clear. Enjoy your day!</Text>
              </Animated.View>
            ) : (
              upcoming.map((meeting, idx) => (
                <TimelineCard key={meeting.id} meeting={meeting} delay={250 + (idx * 100)} />
              ))
            )}
          </Animated.View>

          {/* Past Meetings List */}
          {!loading && past.length > 0 && (
            <Animated.View entering={FadeInUp.delay(400).duration(350)} className="mt-6 mb-10">
              <Text className="text-black dark:text-white text-lg font-bold mb-4">Past Meetings</Text>
              {past.map((meeting) => (
                <Pressable 
                  key={meeting.id}
                  onPress={() => router.push(`/meetings/${meeting.id}` as any)}
                  className="bg-white dark:bg-[#17181D] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-[16px] p-4 mb-3 flex-row items-center justify-between shadow-sm"
                >
                  <View>
                    <Text className="text-black dark:text-white font-bold text-sm mb-1">{meeting.title}</Text>
                    <Text className="text-gray-500 dark:text-[#A1A1AA] text-xs">Completed • {meeting.duration_minutes || 30} min</Text>
                  </View>
                  <Text className="text-[#FF6B4A] text-xs font-semibold">View Details</Text>
                </Pressable>
              ))}
            </Animated.View>
          )}
          
          <View className="h-20" />
        </ScrollView>
      </Animated.View>
    </TabScreenWrapper>
  );
}
