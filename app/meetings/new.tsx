import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { PremiumInput } from '@/components/ui/premium-input';
import { PremiumButton } from '@/components/ui/premium-button';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { PremiumSelect } from '@/components/ui/premium-select';
import { AttendeePicker } from '@/components/ui/attendee-picker';
import { useColors } from '@/hooks/use-colors';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

const DURATION_OPTIONS = [
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '45 minutes', value: '45' },
  { label: '1 hour', value: '60' },
  { label: '1.5 hours', value: '90' },
  { label: '2 hours', value: '120' },
];

const LINK_TYPE_OPTIONS = [
  { label: 'Google Meet', value: 'google_meet' },
  { label: 'Microsoft Teams', value: 'teams' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Jitsi', value: 'jitsi' },
  { label: 'Custom Link', value: 'custom' },
  { label: 'In-Person (No Link)', value: 'none' },
];

export default function NewMeetingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d;
  });
  const [duration, setDuration] = useState('30');
  const [linkType, setLinkType] = useState('google_meet');
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetingToEdit = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('meetings')
        .select(`
          *,
          attendees:meeting_attendees(user_id)
        `)
        .eq('id', editId)
        .single();

      if (data && !fetchError) {
        setTitle(data.title);
        setDescription(data.description || '');
        const startTime = new Date(data.start_time);
        setDate(startTime);
        setTime(startTime);
        setDuration(data.duration_minutes.toString());
        setLinkType(data.meeting_link_type || 'none');
        setMeetingLink(data.meeting_link || '');
        setLocation(data.location || '');
        setSelectedAttendees(data.attendees.map((a: any) => a.user_id));
      }
    } catch (e) {
      console.error('[NewMeetingScreen] Error loading meeting for editing:', e);
      setError('Failed to load meeting details.');
    }
  }, [editId]);

  useEffect(() => {
    let frameId: number;
    if (editId) {
      frameId = requestAnimationFrame(() => {
        fetchMeetingToEdit();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [editId, fetchMeetingToEdit]);

  const handleCreateMeeting = async () => {
    if (!title.trim()) {
      setError('Meeting title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Calculate start_time and end_time
      const startTime = new Date(date);
      startTime.setHours(time.getHours(), time.getMinutes(), 0, 0);

      const durationMinutes = parseInt(duration, 10);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      let meetingId = editId;

      if (editId) {
        // Update meeting
        const { error: meetingError } = await supabase
          .from('meetings')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            meeting_link: linkType === 'none' ? null : meetingLink.trim(),
            meeting_link_type: linkType === 'none' ? null : linkType,
            location: location.trim() || null,
          })
          .eq('id', editId);

        if (meetingError) throw meetingError;

        // Delete old attendees
        await supabase
          .from('meeting_attendees')
          .delete()
          .eq('meeting_id', editId);
      } else {
        // Insert meeting
        const { data: meetingData, error: meetingError } = await supabase
          .from('meetings')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            creator_id: user?.id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            meeting_link: linkType === 'none' ? null : meetingLink.trim(),
            meeting_link_type: linkType === 'none' ? null : linkType,
            location: location.trim() || null,
          })
          .select('id')
          .single();

        if (meetingError) throw meetingError;
        meetingId = meetingData.id;
      }

      // Insert creator as an accepted attendee
      const attendeesToInsert = [
        {
          meeting_id: meetingId,
          user_id: user?.id,
          rsvp_status: 'accepted',
        },
      ];

      // Add other attendees
      selectedAttendees.forEach(attendeeId => {
        if (attendeeId !== user?.id) {
          attendeesToInsert.push({
            meeting_id: meetingId,
            user_id: attendeeId,
            rsvp_status: 'pending',
          });
        }
      });

      const { error: attendeesError } = await supabase
        .from('meeting_attendees')
        .insert(attendeesToInsert);

      if (attendeesError) throw attendeesError;

      // Send notifications to attendees
      const notificationsToInsert = selectedAttendees
        .filter(id => id !== user?.id)
        .map(attendeeId => ({
          user_id: attendeeId,
          title: editId ? 'Meeting Rescheduled' : 'New Meeting Invitation',
          message: editId 
            ? `${user?.fullName} rescheduled/updated "${title.trim()}" to ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : `${user?.fullName} invited you to "${title.trim()}" on ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          type: 'meeting_invite',
          related_meeting_id: meetingId,
        }));

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }

      // Track activity
      await supabase.from('activity_feed').insert({
        user_id: user?.id,
        action_type: editId ? 'meeting_updated' : 'meeting_created',
        action_description: editId 
          ? `Updated details for meeting: ${title.trim()}`
          : `Created a meeting: ${title.trim()}`,
        related_meeting_id: meetingId,
      });

      // Schedule local notification 15 minutes before the meeting
      if (Platform.OS !== 'web') {
        const reminderTime = new Date(startTime.getTime() - 15 * 60000);
        if (reminderTime > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Meeting Reminder: ${title.trim()}`,
              body: `Starts in 15 minutes${location.trim() ? ` at ${location.trim()}` : ''}`,
              data: { meetingId },
            },
            trigger: reminderTime as any,
          });
        }
      }

      router.back();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create meeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View className="flex-row items-center justify-between px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top || 16 }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 p-2 -ml-2">
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">{editId ? 'Edit Meeting' : 'New Meeting'}</Text>
        </View>
        <Pressable 
          onPress={handleCreateMeeting} 
          disabled={isSubmitting || !title.trim()}
          className={!title.trim() ? 'opacity-50' : ''}
        >
          <Text className="text-base font-bold text-primary">{editId ? 'Save' : 'Schedule'}</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <PremiumInput
          label="Meeting Title"
          placeholder="e.g. Weekly Sync"
          value={title}
          onChangeText={setTitle}
          error={error?.includes('title') ? error : undefined}
        />

        <PremiumInput
          label="Description (Optional)"
          placeholder="What is this meeting about?"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View className="flex-row justify-between mb-4">
          <View className="flex-1 mr-2">
            <Text className="text-sm font-medium text-foreground mb-2 ml-1">Date</Text>
            <DatePicker
              value={date}
              onChange={setDate}
            />
          </View>
          <View className="flex-1 ml-2">
            <Text className="text-sm font-medium text-foreground mb-2 ml-1">Time</Text>
            <TimePicker
              value={time}
              onChange={setTime}
            />
          </View>
        </View>

        <PremiumSelect
          label="Duration"
          value={duration}
          options={DURATION_OPTIONS}
          onSelect={setDuration}
        />

        <PremiumSelect
          label="Location / Link Type"
          value={linkType}
          options={LINK_TYPE_OPTIONS}
          onSelect={setLinkType}
        />

        {linkType !== 'none' && linkType !== 'custom' && (
          <PremiumInput
            label="Meeting Link"
            placeholder={`Paste ${LINK_TYPE_OPTIONS.find(o => o.value === linkType)?.label} link here`}
            value={meetingLink}
            onChangeText={setMeetingLink}
            autoCapitalize="none"
          />
        )}

        {linkType === 'custom' && (
          <PremiumInput
            label="Custom Link"
            placeholder="https://..."
            value={meetingLink}
            onChangeText={setMeetingLink}
            autoCapitalize="none"
          />
        )}

        {linkType === 'none' && (
          <PremiumInput
            label="Physical Location"
            placeholder="e.g. Conference Room A"
            value={location}
            onChangeText={setLocation}
          />
        )}

        <AttendeePicker
          selectedIds={selectedAttendees}
          onSelect={(id) => setSelectedAttendees(prev => [...prev, id])}
          onRemove={(id) => setSelectedAttendees(prev => prev.filter(i => i !== id))}
        />

        {error && !error.includes('title') && (
          <View className="p-4 rounded-xl bg-error/10 border border-error/20 mb-6 mt-2">
            <Text className="text-error text-sm">{error}</Text>
          </View>
        )}

        <View className="h-12" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
