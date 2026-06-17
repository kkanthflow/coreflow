import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import clsx from 'clsx';
import { isPast, isToday, isTomorrow, formatRelative } from 'date-fns';
import { safeFormat } from '@/lib/utils';

export default function MeetingsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          creator:creator_id(id, full_name, avatar_url),
          attendees:meeting_attendees(user_id, rsvp_status)
        `)
        .order('start_time', { ascending: activeTab === 'upcoming' });

      if (error) throw error;

      const now = new Date();
      
      const filtered = (data || []).filter(meeting => {
        const startTime = new Date(meeting.start_time);
        if (activeTab === 'upcoming') {
          return startTime >= now;
        } else {
          return startTime < now;
        }
      });

      setMeetings(filtered);
    } catch (err) {
      console.error('Error fetching meetings:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMeetings();
    }, [activeTab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMeetings();
  };

  const getMeetingStatusColor = (meeting: any) => {
    if (meeting.is_cancelled) return colors.error;
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(meeting.end_time);
    
    if (now >= startTime && now <= endTime) return colors.warning; // In progress
    if (startTime > now) return colors.primary; // Upcoming
    return colors.muted; // Past
  };

  const formatMeetingTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return `Today at ${safeFormat(date, 'h:mm a')}`;
    if (isTomorrow(date)) return `Tomorrow at ${safeFormat(date, 'h:mm a')}`;
    return safeFormat(date, 'MMM d, yyyy • h:mm a');
  };

  return (
    <ScreenContainer className="flex-1">
      <View className="px-6 pt-6 pb-2">
        <Text className="text-3xl font-bold text-foreground mb-6">Meetings</Text>
        
        <View className="flex-row bg-border/50 p-1 rounded-xl mb-4">
          <Pressable
            onPress={() => setActiveTab('upcoming')}
            className={clsx(
              'flex-1 py-2.5 rounded-lg items-center',
              activeTab === 'upcoming' ? 'bg-background' : ''
            )}
            style={activeTab === 'upcoming' ? { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 } : undefined}
          >
            <Text className={clsx(
              'text-sm font-semibold',
              activeTab === 'upcoming' ? 'text-foreground' : 'text-muted'
            )}>
              Upcoming
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('past')}
            className={clsx(
              'flex-1 py-2.5 rounded-lg items-center',
              activeTab === 'past' ? 'bg-background' : ''
            )}
            style={activeTab === 'past' ? { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 } : undefined}
          >
            <Text className={clsx(
              'text-sm font-semibold',
              activeTab === 'past' ? 'text-foreground' : 'text-muted'
            )}>
              Past
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {meetings.length === 0 ? (
            <View className="py-12 items-center justify-center">
              <Ionicons name="calendar-outline" size={64} color={colors.muted} className="mb-4 opacity-50" />
              <Text className="text-lg font-semibold text-foreground mb-2">No {activeTab} meetings</Text>
              <Text className="text-sm text-muted text-center max-w-[250px]">
                {activeTab === 'upcoming' 
                  ? 'You have no scheduled meetings coming up. Take a break or schedule one!'
                  : 'You have no past meetings on record.'}
              </Text>
            </View>
          ) : (
            <View className="gap-4 pb-24">
              {meetings.map((meeting) => (
                <Pressable
                  key={meeting.id}
                  onPress={() => router.push(`/meetings/${meeting.id}` as any)}
                  className="p-4 rounded-2xl border border-border"
                  style={{ backgroundColor: colors.surface }}
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 pr-4">
                      <Text className={clsx(
                        "text-lg font-bold mb-1",
                        meeting.is_cancelled ? "text-muted line-through" : "text-foreground"
                      )} numberOfLines={1}>
                        {meeting.title}
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={14} color={colors.muted} className="mr-1" />
                        <Text className="text-sm font-medium text-primary">
                          {formatMeetingTime(meeting.start_time)}
                        </Text>
                        <Text className="text-sm text-muted ml-1">
                          ({meeting.duration_minutes}m)
                        </Text>
                      </View>
                    </View>
                    
                    <View 
                      className="px-2 py-1 rounded border items-center justify-center"
                      style={{ 
                        backgroundColor: meeting.is_cancelled ? `${colors.error}15` : `${getMeetingStatusColor(meeting)}15`,
                        borderColor: meeting.is_cancelled ? `${colors.error}30` : `${getMeetingStatusColor(meeting)}30`
                      }}
                    >
                      <Text 
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: meeting.is_cancelled ? colors.error : getMeetingStatusColor(meeting) }}
                      >
                        {meeting.is_cancelled ? 'Cancelled' : (new Date(meeting.start_time) > new Date() ? 'Upcoming' : 'Past')}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mt-2 pt-3 border-t border-border">
                    <View className="flex-row items-center">
                      {meeting.creator?.avatar_url ? (
                        <Image source={{ uri: meeting.creator.avatar_url }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                      ) : (
                        <View className="w-6 h-6 rounded-full bg-primary/20 items-center justify-center">
                          <Text className="text-primary text-xs font-bold">
                            {meeting.creator?.full_name?.charAt(0) || '?'}
                          </Text>
                        </View>
                      )}
                      <Text className="text-sm text-muted ml-2">
                        {meeting.creator_id === user?.id ? 'You created this' : `Created by ${meeting.creator?.full_name}`}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <Ionicons name="people" size={14} color={colors.muted} className="mr-1" />
                      <Text className="text-sm text-muted font-medium">
                        {meeting.attendees?.length || 0}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <View className="absolute bottom-6 right-6">
        <Pressable
          onPress={() => router.push('/meetings/new')}
          className="w-14 h-14 rounded-full items-center justify-center bg-primary"
          style={{ shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
        >
          <Ionicons name="add" size={32} color="white" />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
