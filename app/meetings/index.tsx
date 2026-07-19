import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Video, CalendarPlus, Key, Users, Calendar, ChevronRight, Clock } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

export default function MeetingsDashboard() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchUpcomingMeetings();
    }, [])
  );

  const fetchUpcomingMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      if (!error && data) {
        setUpcoming(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="flex-1 bg-[#09090B] pt-16 px-6">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="text-white text-3xl font-bold">Meetings</Text>
          <Text className="text-[#A1A1AA] text-base mt-1">Connect securely</Text>
        </View>
        <View className="w-12 h-12 rounded-full bg-[#18181B] border border-white/10 items-center justify-center">
           <Video size={24} color="#2563EB" />
        </View>
      </View>

      {/* Action Buttons Grid */}
      <View className="flex-row justify-between mb-8">
        {/* Host Instant Meeting */}
        <Pressable 
          onPress={() => router.push('/meetings/pre-join')}
          className="w-[48%] aspect-square rounded-[24px] overflow-hidden shadow-xl"
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="flex-1 p-5 justify-between"
          >
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center backdrop-blur-md">
              <Video size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text className="text-white text-lg font-bold">Host Meeting</Text>
              <Text className="text-white/80 text-xs mt-1">Start instantly</Text>
            </View>
          </LinearGradient>
        </Pressable>

        <View className="w-[48%] justify-between">
          {/* Join with Code */}
          <Pressable 
            onPress={() => router.push('/meetings/pre-join')}
            className="w-full h-[47%] bg-[#18181B] rounded-[20px] p-4 border border-white/5 flex-row items-center space-x-3 active:bg-[#27272A] shadow-md"
          >
            <View className="w-10 h-10 rounded-full bg-[#27272A] items-center justify-center">
              <Key size={18} color="#A1A1AA" />
            </View>
            <View>
              <Text className="text-white font-semibold">Join</Text>
              <Text className="text-[#A1A1AA] text-[11px]">With code</Text>
            </View>
          </Pressable>

          {/* Schedule */}
          <Pressable 
            onPress={() => router.push('/meetings/new')}
            className="w-full h-[47%] bg-[#18181B] rounded-[20px] p-4 border border-white/5 flex-row items-center space-x-3 active:bg-[#27272A] shadow-md"
          >
            <View className="w-10 h-10 rounded-full bg-[#27272A] items-center justify-center">
              <CalendarPlus size={18} color="#A1A1AA" />
            </View>
            <View>
              <Text className="text-white font-semibold">Schedule</Text>
              <Text className="text-[#A1A1AA] text-[11px]">Plan ahead</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Upcoming Meetings List */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white text-lg font-bold">Upcoming</Text>
        <Pressable>
          <Text className="text-[#3B82F6] text-sm font-semibold">View all</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {loading ? (
          <ActivityIndicator size="small" color="#2563EB" className="mt-8" />
        ) : upcoming.length === 0 ? (
          <View className="items-center justify-center mt-12 bg-[#18181B] p-8 rounded-[24px] border border-white/5">
            <View className="w-16 h-16 rounded-full bg-[#27272A] items-center justify-center mb-4">
              <Calendar size={28} color="#A1A1AA" />
            </View>
            <Text className="text-white text-base font-semibold mb-1">No upcoming meetings</Text>
            <Text className="text-[#A1A1AA] text-sm text-center">Your schedule is clear. Enjoy your day!</Text>
          </View>
        ) : (
          upcoming.map((meeting) => (
            <Pressable 
              key={meeting.id}
              onPress={() => {
                if (meeting.meeting_link_type === 'coreflow') {
                  router.push({
                    pathname: '/meetings/room' as any,
                    params: { id: meeting.id, camera: '1', mic: '1' }
                  });
                } else if (meeting.meeting_link_type === 'none') {
                  // do nothing or show details
                } else {
                  // external link could be opened here or go to details
                }
              }}
              className="bg-[#18181B] border border-white/5 rounded-[20px] p-4 mb-3 flex-row items-center active:bg-[#27272A]"
            >
              <View className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 items-center justify-center mr-4">
                <Clock size={24} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base mb-1" numberOfLines={1}>{meeting.title}</Text>
                <Text className="text-[#A1A1AA] text-sm">{formatTime(meeting.start_time)} • {meeting.duration_minutes || 30} min</Text>
              </View>
              <ChevronRight size={20} color="#A1A1AA" />
            </Pressable>
          ))
        )}
        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
