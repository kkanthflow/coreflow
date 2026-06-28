import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, StatusBar, RefreshControl,
} from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { isToday, isTomorrow } from 'date-fns';
import { safeFormat } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientButton } from '@/components/ui/gradient-button';
import { ShimmerCard, ShimmerLoader } from '@/components/ui/shimmer-loader';
import { hasPermission } from '@/lib/permissions';

import { useColors } from '@/hooks/use-colors';

function MeetingCard({ meeting, userId, onPress, index }: { meeting: any; userId: string; onPress: () => void; index: number }) {
  const colors = useColors();
  const C = {
    bg: colors.background,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };

  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 70, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const now       = new Date();
  const startTime = new Date(meeting.start_time);
  const endTime   = new Date(meeting.end_time);
  const isLive    = now >= startTime && now <= endTime;
  const isMine    = meeting.creator_id === userId;

  const statusColor = meeting.is_cancelled ? C.error : isLive ? C.warning : startTime > now ? C.success : C.muted;
  const statusLabel = meeting.is_cancelled ? 'Cancelled' : isLive ? 'Live Now' : startTime > now ? 'Upcoming' : 'Past';

  const formatTime = (d: string) => {
    const date = new Date(d);
    if (isToday(date))    return `Today · ${safeFormat(date, 'h:mm a')}`;
    if (isTomorrow(date)) return `Tomorrow · ${safeFormat(date, 'h:mm a')}`;
    return safeFormat(date, 'MMM d · h:mm a');
  };

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim, marginBottom: 12 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: C.card,
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: pressed ? `${statusColor}40` : C.border,
          shadowColor: isLive ? C.warning : C.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isLive ? 0.3 : pressed ? 0.2 : 0.08,
          shadowRadius: isLive ? 12 : 8,
          elevation: isLive ? 6 : 3,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        {/* Left accent bar */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: statusColor }} />

        <View style={{ padding: 16, paddingLeft: 20 }}>
          {/* Top row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text
                style={{
                  color: meeting.is_cancelled ? C.muted : C.text,
                  fontSize: 16, fontWeight: '800',
                  textDecorationLine: meeting.is_cancelled ? 'line-through' : 'none',
                }}
                numberOfLines={1}
              >
                {meeting.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Ionicons name="time-outline" size={13} color={C.primary} />
                <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>{formatTime(meeting.start_time)}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>· {meeting.duration_minutes}m</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: `${statusColor}20`, borderWidth: 1, borderColor: `${statusColor}30` }}>
              {isLive && <View style={{ position: 'absolute', top: 4, left: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: C.warning, shadowColor: C.warning, shadowOpacity: 0.8, shadowRadius: 4 }} />}
              <Text style={{ color: statusColor, fontSize: 11, fontWeight: '800', marginLeft: isLive ? 10 : 0 }}>{statusLabel}</Text>
            </View>
          </View>

          {/* Description */}
          {meeting.description && (
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 }} numberOfLines={2}>
              {meeting.description}
            </Text>
          )}

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {meeting.creator?.avatar_url ? (
                <Image source={{ uri: meeting.creator.avatar_url }} style={{ width: 22, height: 22, borderRadius: 11 }} />
              ) : (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${C.primary}30`, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.primary, fontSize: 9, fontWeight: '800' }}>
                    {meeting.creator?.full_name?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              <Text style={{ color: C.muted, fontSize: 12 }}>
                {isMine ? 'You created this' : meeting.creator?.full_name}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="people-outline" size={14} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>
                {meeting.attendees?.length || 0}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function MeetingsScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const colors   = useColors();

  const C = {
    bg: colors.background,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };

  const [tab, setTab]         = useState<'upcoming' | 'past'>('upcoming');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-16)).current;

  const canSchedule = hasPermission(user?.role, 'schedule_meetings');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchMeetings = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      let query = supabase
        .from('meetings')
        .select('*, creator:creator_id(id, full_name, avatar_url), attendees:meeting_attendees(user_id, rsvp_status)')
        .order('start_time', { ascending: tab === 'upcoming' });

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date();
      setMeetings((data || []).filter(m => {
        const s = new Date(m.start_time);
        return tab === 'upcoming' ? s >= now : s < now;
      }));
    } catch (e) {
      console.error('Meetings fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, user]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchMeetings(); }, [fetchMeetings]));

  const onRefresh = () => { setRefreshing(true); fetchMeetings(); };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={styles.title}>Meetings</Text>
            <Text style={styles.subtitle}>{meetings.length} {tab} meeting{meetings.length !== 1 ? 's' : ''}</Text>
          </View>
          {canSchedule && (
            <GradientButton onPress={() => router.push('/meetings/new')} size="sm">
              + Schedule
            </GradientButton>
          )}
        </View>

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          {(['upcoming', 'past'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setLoading(true); }}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {loading ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        >
          {meetings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={36} color={C.muted} />
              </View>
              <Text style={styles.emptyTitle}>No {tab} meetings</Text>
              <Text style={styles.emptySub}>
                {tab === 'upcoming'
                  ? 'Nothing scheduled yet. Schedule a meeting to get started.'
                  : 'No past meetings on record.'}
              </Text>
            </View>
          ) : (
            meetings.map((m, i) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                userId={user?.id || ''}
                index={i}
                onPress={() => router.push(`/meetings/${m.id}` as any)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { color: '#F5F5FA', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#7A7A92', fontSize: 14, marginTop: 4 },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#181822',
    borderRadius: 16, padding: 4,
    borderWidth: 1, borderColor: '#2A2A3A',
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FF6B4A',
    shadowColor: '#FF6B4A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  tabLabel: { color: '#7A7A92', fontSize: 14, fontWeight: '700' },
  tabLabelActive: { color: '#FFFFFF' },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#181822', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#2A2A3A' },
  emptyTitle: { color: '#F5F5FA', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#7A7A92', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

