import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function scheduleMeetingLocalNotifications(userId: string) {
  if (Platform.OS === 'web' || !userId) return;

  try {
    // Cancel all previously scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    // Fetch upcoming accepted meetings
    const { data: attendeesData, error } = await supabase
      .from('meeting_participants')
      .select(`
        meeting:meeting_id (
          id,
          title,
          description,
          start_time
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (error || !attendeesData) {
      console.warn('Failed to fetch meetings for notification scheduling:', error);
      return;
    }

    for (const item of attendeesData) {
      const meeting = item.meeting as any;
      if (!meeting) continue;

      const startTime = new Date(meeting.start_time);
      if (startTime <= now) continue;

      const timeString = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. 30 Minutes Before Notification
      const thirtyMinsBefore = new Date(startTime.getTime() - 30 * 60 * 1000);
      if (thirtyMinsBefore > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Upcoming Meeting in 30 mins',
            body: `"${meeting.title}" starts at ${timeString}`,
            sound: 'default',
            data: { meetingId: meeting.id },
          },
          trigger: { date: thirtyMinsBefore, type: SchedulableTriggerInputTypes.DATE },
        });
      }

      // 2. Start Time Notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Meeting Starting Now',
          body: `"${meeting.title}" is starting now. Tap to join!`,
          sound: 'default',
          data: { meetingId: meeting.id },
        },
        trigger: { date: startTime, type: SchedulableTriggerInputTypes.DATE },
      });
    }
  } catch (err) {
    console.error('Error scheduling meeting notifications:', err);
  }
}
