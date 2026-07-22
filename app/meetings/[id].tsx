import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Linking, Share } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { PremiumButton } from '@/components/ui/premium-button';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { scheduleMeetingLocalNotifications } from '@/lib/notifications-helper';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import clsx from 'clsx';
import { isPast } from 'date-fns';
import { safeFormat } from '@/lib/utils';

export default function MeetingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [meeting, setMeeting] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingRSVP, setIsUpdatingRSVP] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchMeeting = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          host:host_id(id, full_name, avatar_url, email, role),
          attendees:meeting_participants(
            id, 
            user_id, 
            status, 
            user:users(id, full_name, avatar_url, email, role)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setMeeting(data);
    } catch (err) {
      console.error('Error fetching meeting:', err);
      Alert.alert('Error', 'Failed to load meeting details.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMeeting();
    }, [id])
  );

  const handleRSVP = async (status: string) => {
    if (!meeting || !user) return;
    setIsUpdatingRSVP(true);
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .update({ status: status })
        .eq('meeting_id', meeting.id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Update local state optimistically
      setMeeting((prev: any) => ({
        ...prev,
        attendees: prev.attendees.map((a: any) => 
          a.user_id === user.id ? { ...a, status: status } : a
        )
      }));

      // Re-schedule meeting notifications locally based on new RSVP response
      scheduleMeetingLocalNotifications(user.id);
    } catch (err) {
      console.error('Error updating RSVP:', err);
      Alert.alert('Error', 'Failed to update your RSVP status.');
    } finally {
      setIsUpdatingRSVP(false);
    }
  };

  const handleCancelMeeting = () => {
    Alert.alert(
      'Cancel Meeting',
      'Are you sure you want to cancel this meeting? This action cannot be undone.',
      [
        { text: 'No, Keep it', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const { error } = await supabase
                .from('meetings')
                .update({ status: 'cancelled' })
                .eq('id', meeting.id);

              if (error) throw error;
              
              // Notify attendees
              const notificationPromises = meeting.attendees
                .filter((a: any) => a.user_id !== user?.id)
                .map((a: any) => 
                  supabase.from('notifications').insert({
                    user_id: a.user_id,
                    title: 'Meeting Cancelled',
                    message: `${user?.fullName} cancelled the meeting "${meeting.title}"`,
                    type: 'system',
                    related_meeting_id: meeting.id,
                  })
                );
                
              await Promise.all(notificationPromises);

              setTimeout(() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/home');
                }
              }, 100);
            } catch (err) {
              console.error('Error cancelling meeting:', err);
              Alert.alert('Error', 'Failed to cancel the meeting.');
              setIsCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleJoinLink = () => {
    if (meeting?.room_name) {
      router.push(`/meetings/pre-join?id=${meeting.id}` as any);
    } else if (meeting?.meeting_link) {
      Linking.openURL(meeting.meeting_link).catch(() => {
        Alert.alert('Error', 'Failed to open meeting link.');
      });
    }
  };

  const handleShareMeeting = async () => {
    if (!meeting) return;
    const link = `${process.env.EXPO_PUBLIC_WEB_URL || 'https://coreflow-meeting.vercel.app'}/meetings/${meeting.id}`;
    try {
      await Share.share({
        message: `Join my meeting "${meeting.title}" on CoreFlow: ${link}`,
        url: link,
        title: meeting.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!meeting) return null;

  const isCreator = meeting.host_id === user?.id;
  const isAdmin = ['managing_director', 'ceo', 'cto', 'hr'].includes(user?.role || '');
  const canModify = isCreator || isAdmin;
  
  const myAttendeeRecord = meeting.attendees.find((a: any) => a.user_id === user?.id);
  const myRsvp = myAttendeeRecord?.status;

  const acceptedCount = meeting.attendees.filter((a: any) => a.status === 'accepted').length;
  const pendingCount = meeting.attendees.filter((a: any) => a.status === 'pending').length;
  const declinedCount = meeting.attendees.filter((a: any) => a.status === 'declined').length;

  const meetingDate = new Date(meeting.start_time);
  const isMeetingPast = isPast(meetingDate);

  return (
    <ScreenContainer className="flex-1">
        {canModify && meeting.status !== 'cancelled' && !isMeetingPast ? (
          <Pressable 
            onPress={() => router.push(`/meetings/new?editId=${meeting.id}` as any)}
            className="p-2 -mr-2"
          >
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </Pressable>
        ) : (
          <View className="w-10" />
        )}

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {meeting.status === 'cancelled' && (
          <View className="bg-error/10 px-6 py-3 border-b border-error/20 flex-row items-center">
            <Ionicons name="warning" size={20} color={colors.error} />
            <Text className="text-error font-semibold ml-2">This meeting has been cancelled</Text>
          </View>
        )}

        <View className="px-6 pt-6 pb-4">
          <Text className={clsx(
            "text-2xl font-bold mb-2",
            meeting.status === 'cancelled' ? "text-muted line-through" : "text-foreground"
          )}>
            {meeting.title}
          </Text>
          
          <View className="flex-row items-center bg-primary/10 self-start px-3 py-1.5 rounded-full mb-6">
            <Ionicons name="time" size={16} color={colors.primary} />
            <Text className="text-primary font-bold ml-1.5">
              {safeFormat(meetingDate, 'EEEE, MMM d • h:mm a')}
            </Text>
          </View>

          {meeting.description && (
            <View className="mb-6">
              <Text className="text-base text-muted leading-relaxed">
                {meeting.description}
              </Text>
            </View>
          )}

          {/* Details Card */}
          <View className="rounded-2xl border border-border p-4 mb-6" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 rounded-full bg-muted/20 items-center justify-center mr-3">
                <Ionicons name="hourglass-outline" size={20} color={colors.foreground} />
              </View>
              <View>
                <Text className="text-xs text-muted mb-0.5">Duration</Text>
                <Text className="text-base font-semibold text-foreground">{meeting.duration_minutes} minutes</Text>
              </View>
            </View>
            
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 rounded-full bg-muted/20 items-center justify-center mr-3">
                <Ionicons name={meeting.room_name || meeting.meeting_link ? 'videocam-outline' : 'location-outline'} size={20} color={colors.foreground} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted mb-0.5">
                  {meeting.room_name || meeting.meeting_link ? 'Platform' : 'Location'}
                </Text>
                {!meeting.room_name && !meeting.meeting_link ? (
                  <Text className="text-base font-semibold text-foreground">{meeting.location || 'TBD'}</Text>
                ) : (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-foreground capitalize">
                      {meeting.room_name ? 'CoreFlow Native' : 'External Link'}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Pressable onPress={handleShareMeeting} className="bg-primary/10 px-4 py-1.5 rounded-full">
                        <Text className="text-primary text-sm font-bold">Share</Text>
                      </Pressable>
                      {(meeting.room_name || meeting.meeting_link) && meeting.status !== 'cancelled' && !isMeetingPast && (
                        <Pressable onPress={handleJoinLink} className="bg-primary px-4 py-1.5 rounded-full">
                          <Text className="text-white text-sm font-bold">Join</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View className="flex-row items-center">
              {meeting.host?.avatar_url ? (
                <Image source={{ uri: meeting.host.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
              ) : (
                <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
                  <Text className="text-primary font-bold text-lg">{meeting.host?.full_name?.charAt(0) || '?'}</Text>
                </View>
              )}
              <View>
                <Text className="text-xs text-muted mb-0.5">Organizer</Text>
                <Text className="text-base font-semibold text-foreground">{meeting.host?.full_name}</Text>
              </View>
            </View>
          </View>

          {/* RSVP Section (Only if attendee and not cancelled and not past) */}
          {meeting.status !== 'cancelled' && !isMeetingPast && myAttendeeRecord && !isCreator && (
            <View className="mb-8">
              <Text className="text-base font-bold text-foreground mb-3">Your RSVP</Text>
              <View className="flex-row gap-2">
                <PremiumButton
                  variant={myRsvp === 'accepted' ? 'primary' : 'outline'}
                  onPress={() => handleRSVP('accepted')}
                  disabled={isUpdatingRSVP}
                  className="flex-1"
                >
                  Accept
                </PremiumButton>
                <PremiumButton
                  variant={myRsvp === 'tentative' ? 'secondary' : 'outline'}
                  onPress={() => handleRSVP('tentative')}
                  disabled={isUpdatingRSVP}
                  className="flex-1"
                >
                  Maybe
                </PremiumButton>
                <PremiumButton
                  variant={myRsvp === 'declined' ? 'secondary' : 'outline'}
                  onPress={() => handleRSVP('declined')}
                  disabled={isUpdatingRSVP}
                  className="flex-1 border-error/50"
                  style={myRsvp === 'declined' ? { backgroundColor: colors.error, borderColor: colors.error } : undefined}
                >
                  <Text style={{ color: myRsvp === 'declined' ? 'white' : colors.error, fontWeight: '600' }}>Decline</Text>
                </PremiumButton>
              </View>
            </View>
          )}

          {/* Attendees List */}
          <View className="mb-8">
            <View className="flex-row items-end justify-between mb-4">
              <Text className="text-lg font-bold text-foreground">Attendees</Text>
              <Text className="text-sm text-muted">{acceptedCount} going • {pendingCount} pending</Text>
            </View>
            
            <View className="gap-3">
              {meeting.attendees.map((attendee: any) => (
                <View 
                  key={attendee.id}
                  className="flex-row items-center justify-between p-3 rounded-xl border border-border"
                  style={{ backgroundColor: colors.surface }}
                >
                  <View className="flex-row items-center flex-1">
                    {attendee.user?.avatar_url ? (
                      <Image source={{ uri: attendee.user.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                    ) : (
                      <View className="w-9 h-9 rounded-full bg-primary/20 items-center justify-center">
                        <Text className="text-primary font-bold">{attendee.user?.full_name?.charAt(0)}</Text>
                      </View>
                    )}
                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-sm font-semibold text-foreground mr-2">{attendee.user?.full_name}</Text>
                        {attendee.user_id === meeting.host_id && (
                          <View className="bg-primary/20 px-1.5 py-0.5 rounded">
                            <Text className="text-[10px] font-bold text-primary">Organizer</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-xs text-muted mt-0.5 capitalize">{attendee.user?.role?.replace('_', ' ')}</Text>
                    </View>
                  </View>
                  
                  <View className={clsx(
                    "px-2 py-1 rounded",
                    attendee.status === 'accepted' ? 'bg-success/10' :
                    attendee.status === 'declined' ? 'bg-error/10' :
                    attendee.status === 'tentative' ? 'bg-warning/10' : 'bg-muted/10'
                  )}>
                    <Text className={clsx(
                      "text-xs font-bold capitalize",
                      attendee.status === 'accepted' ? 'text-success' :
                      attendee.status === 'declined' ? 'text-error' :
                      attendee.status === 'tentative' ? 'text-warning' : 'text-muted'
                    )}>
                      {attendee.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Admin / Creator Controls */}
          {canModify && meeting.status !== 'cancelled' && !isMeetingPast && (
            <View className="mb-12 mt-4 pt-6 border-t border-border">
              <PremiumButton
                variant="outline"
                onPress={handleCancelMeeting}
                disabled={isCancelling}
                className="border-error/30"
              >
                <View className="flex-row items-center">
                  <Ionicons name="trash-outline" size={20} color={colors.error} className="mr-2" />
                  <Text className="text-error font-semibold text-base">Cancel Meeting</Text>
                </View>
              </PremiumButton>
            </View>
          )}

          <View className="h-12" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
