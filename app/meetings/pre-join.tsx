import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Platform, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Mic, MicOff, Video, VideoOff, Settings, ChevronLeft, Plus } from 'lucide-react-native';
import { useAuth } from '@/hooks/use-auth';
import { initializeUserKeys, generateRandomSymmetricKey, encryptKeyForRecipient } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

export default function PreJoinScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, activeWorkspace } = useAuth();
  
  const [isFocused, setIsFocused] = useState(true);
  
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );
  
  const [meetingId, setMeetingId] = useState(id || '');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!camPermission?.granted) {
      requestCamPermission();
    }
  }, [camPermission]);

  useEffect(() => {
    if (!micPermission?.granted) {
      requestMicPermission();
    }
  }, [micPermission]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 800 }),
        withTiming(1, { duration: 800 }),
        withTiming(1, { duration: 3400 }) // Total 5s cycle
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }]
  }));

  const [isJoining, setIsJoining] = useState(false);
  const [meetingState, setMeetingState] = useState<'idle' | 'loading' | 'pending' | 'accepted' | 'declined' | 'ended' | 'not_invited'>('idle');
  const [meetingHostId, setMeetingHostId] = useState<string | null>(null);

  // Fetch meeting & invitation state
  useEffect(() => {
    if (!meetingId || !session?.user?.id) {
      setMeetingState('idle');
      return;
    }

    let isMounted = true;

    const checkAccess = async () => {
      if (isMounted) setMeetingState('loading');
      
      try {
        // 1. Fetch Meeting
        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .select('id, host_id, status, end_time')
          .eq('id', meetingId)
          .single();

        if (meetingError || !meeting) {
          if (isMounted) setMeetingState('not_invited');
          return;
        }
        
        if (isMounted) setMeetingHostId(meeting.host_id);

        // Removed end_time block so meetings don't expire

        if (meeting.status === 'completed') {
          if (isMounted) setMeetingState('ended');
          return;
        }

        // Host always has access
        if (meeting.host_id === session.user.id) {
          if (isMounted) setMeetingState('accepted');
          return;
        }

        // 2. Fetch Invitation
        const { data: inv, error: invError } = await supabase
          .from('meeting_invitations')
          .select('status')
          .eq('meeting_id', meetingId)
          .eq('user_id', session.user.id)
          .single();

        if (invError || !inv) {
          if (isMounted) setMeetingState('not_invited');
          return;
        }

        if (isMounted) setMeetingState(inv.status as any);

      } catch (err) {
        console.error('Error checking access:', err);
      }
    };

    checkAccess();

    // 3. Subscribe to realtime updates for the invitation
    const channel = supabase.channel(`invitation-${meetingId}-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meeting_invitations', filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          if (payload.new && payload.new.user_id === session.user.id) {
            setMeetingState(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [meetingId, session]);

  const handleAcceptInvitation = async () => {
    if (!meetingId || !session?.user?.id) return;
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      await fetch(`${baseUrl}/api/meetings/${meetingId}/invitations/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      // Realtime will update the state
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineInvitation = async () => {
    if (!meetingId || !session?.user?.id) return;
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      await fetch(`${baseUrl}/api/meetings/${meetingId}/invitations/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoin = () => {
    if (!meetingId.trim() || isJoining) return;
    
    setIsJoining(true);
    // Force unmount the camera hardware before navigating
    setIsFocused(false);
    
    // Wait for the React render cycle to fully unmount the CameraView
    setTimeout(() => {
      router.push({
        pathname: '/meetings/room' as any,
        params: { 
          id: meetingId, 
          camera: cameraEnabled ? '1' : '0', 
          mic: micEnabled ? '1' : '0' 
        }
      });
    }, 300); // 300ms is plenty of time for React Native to detach the camera surface
  };

  const handleStartInstant = async () => {
    if (!session?.access_token || !activeWorkspace?.id) return;
    setIsCreating(true);
    try {
      const symKey = generateRandomSymmetricKey();
      const myPubKey = await initializeUserKeys(session.user.id);
      const encryptedKey = await encryptKeyForRecipient(symKey, myPubKey);

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          'x-workspace-id': activeWorkspace.id
        },
        body: JSON.stringify({
          title: 'Instant Meeting',
          startTime: new Date().toISOString(),
        })
      });
      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();
      
      const { error: keyError } = await supabase.from('meeting_keys').insert({
        meeting_id: data.meeting.id,
        user_id: session.user.id,
        encrypted_key: encryptedKey
      });

      if (keyError) console.error('Error inserting meeting key:', keyError);

      setIsFocused(false);
      
      setTimeout(() => {
        router.push({
          pathname: '/meetings/room' as any,
          params: { 
            id: data.meeting.id, 
            camera: cameraEnabled ? '1' : '0', 
            mic: micEnabled ? '1' : '0' 
          }
        });
      }, 300);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(350)} className="flex-1 bg-[#0B0B0D] px-6 pt-16">
      {/* Header */}
      <View className="flex-row items-center mb-8">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10">
          <ChevronLeft size={28} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white text-2xl font-bold ml-2 tracking-tight">Join Meeting</Text>
      </View>

      {/* Main Section - Camera Preview */}
      <View className="items-center mb-10">
        <View className="w-[75%] aspect-[3/4] bg-[#1E2128] rounded-[24px] overflow-hidden shadow-2xl border border-[rgba(255,255,255,0.06)] relative">
          {(cameraEnabled && camPermission?.granted && isFocused && !isJoining) ? (
            <CameraView style={{ flex: 1 }} facing="front" />
          ) : (
            <View className="flex-1 items-center justify-center bg-[#17181D]">
              <VideoOff size={48} color="#FF6B4A" opacity={0.5} />
            </View>
          )}

          {/* Floating Controls Overlay */}
          <View className="absolute bottom-6 left-0 right-0 flex-row justify-center space-x-6 px-4">
            <Pressable 
              onPress={() => setMicEnabled(!micEnabled)}
              className={`w-14 h-14 rounded-full items-center justify-center shadow-lg border border-[rgba(255,255,255,0.1)] overflow-hidden ${!micEnabled ? 'bg-[#EF4444]' : 'bg-transparent'}`}
            >
              {micEnabled && <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={StyleSheet.absoluteFill} />}
              {!micEnabled && <View className="absolute inset-0 bg-[#EF4444]" />}
              {micEnabled ? <Mic size={24} color="#FFFFFF" /> : <MicOff size={24} color="#FFFFFF" />}
            </Pressable>
            
            <Pressable 
              onPress={() => setCameraEnabled(!cameraEnabled)}
              className={`w-14 h-14 rounded-full items-center justify-center shadow-lg border border-[rgba(255,255,255,0.1)] overflow-hidden ${!cameraEnabled ? 'bg-[#EF4444]' : 'bg-transparent'}`}
            >
              {cameraEnabled && <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={StyleSheet.absoluteFill} />}
              {!cameraEnabled && <View className="absolute inset-0 bg-[#EF4444]" />}
              {cameraEnabled ? <Video size={24} color="#FFFFFF" /> : <VideoOff size={24} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Input Section */}
      <View className="bg-[#1E2128] rounded-[20px] p-5 mb-8 border border-[rgba(255,255,255,0.06)] shadow-lg">
        <Text className="text-[#A1A1AA] text-sm font-semibold mb-2">Meeting Code</Text>
        <TextInput
          className="bg-[#0B0B0D] text-white p-4 rounded-[16px] text-base border border-[rgba(255,255,255,0.04)]"
          placeholder="e.g. cf-meeting-8d72af93"
          placeholderTextColor="#6B7280"
          value={meetingId}
          onChangeText={setMeetingId}
          autoCapitalize="none"
        />
      </View>

      <View className="flex-1" />

      {/* Buttons */}
      <View className="pb-10 space-y-4 flex-col gap-4">
        <Pressable 
          onPress={handleStartInstant}
          disabled={isCreating}
          className={`rounded-full overflow-hidden ${isCreating ? 'opacity-50' : 'opacity-100'}`}
        >
          <View className="bg-[#1E2128] py-4 items-center justify-center flex-row border border-[rgba(255,255,255,0.06)] rounded-full">
            <Plus size={20} color="#FFFFFF" className="mr-2" />
            <Text className="text-white text-lg font-bold">{isCreating ? 'Creating...' : 'Start Instant Meeting'}</Text>
          </View>
        </Pressable>

        <View className="flex-row items-center justify-center space-x-4 mb-2">
          <View className="h-px bg-white/10 flex-1" />
          <Text className="text-[#A1A1AA] text-xs font-semibold tracking-wider">OR JOIN EXISTING</Text>
          <View className="h-px bg-white/10 flex-1" />
        </View>

        <Animated.View style={pulseStyle}>
          {(meetingState === 'pending') && (
            <View className="space-y-3">
              <Pressable onPress={handleAcceptInvitation} className="rounded-full overflow-hidden">
                <View className="py-4 items-center justify-center bg-green-500">
                  <Text className="text-white text-lg font-bold">Accept Invitation</Text>
                </View>
              </Pressable>
              <Pressable onPress={handleDeclineInvitation} className="rounded-full overflow-hidden mt-3">
                <View className="py-4 items-center justify-center bg-transparent border border-red-500/50">
                  <Text className="text-red-500 text-lg font-bold">Decline</Text>
                </View>
              </Pressable>
            </View>
          )}

          {(meetingState === 'declined') && (
            <View className="py-4 items-center justify-center bg-[#2c2c2e] rounded-full">
              <Text className="text-gray-400 text-lg font-bold">Invitation Declined</Text>
            </View>
          )}

          {(meetingState === 'ended') && (
            <View className="py-4 items-center justify-center bg-[#2c2c2e] rounded-full">
              <Text className="text-gray-400 text-lg font-bold">Meeting Ended</Text>
            </View>
          )}

          {(meetingState === 'not_invited' && meetingId.trim()) && (
            <View className="py-4 items-center justify-center bg-[#2c2c2e] rounded-full">
              <Text className="text-gray-400 text-lg font-bold">Access Denied</Text>
            </View>
          )}

          {(meetingState === 'accepted' || meetingState === 'idle' || meetingState === 'loading' || (meetingState === 'not_invited' && !meetingId.trim())) && (
            <Pressable 
              onPress={handleJoin}
              disabled={!meetingId.trim() || meetingState === 'loading'}
              className={`rounded-full overflow-hidden ${(!meetingId.trim() || meetingState === 'loading') ? 'opacity-50' : 'opacity-100'}`}
            >
              <View className="py-4 items-center justify-center bg-[#FF6B4A]">
                <Text className="text-white text-lg font-bold">{meetingState === 'loading' ? 'Checking Access...' : 'Join Now'}</Text>
              </View>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}
