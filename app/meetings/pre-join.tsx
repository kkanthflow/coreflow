import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Mic, MicOff, Video, VideoOff, Settings, ChevronLeft, Plus } from 'lucide-react-native';
import { useAuth } from '@/hooks/use-auth';
import { initializeUserKeys, generateRandomSymmetricKey, encryptKeyForRecipient } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';

export default function PreJoinScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, activeWorkspace } = useAuth();
  
  const [meetingId, setMeetingId] = useState(id || '');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

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

  const handleJoin = () => {
    if (!meetingId.trim()) return;
    router.push({
      pathname: '/meetings/room' as any,
      params: { 
        id: meetingId, 
        camera: cameraEnabled ? '1' : '0', 
        mic: micEnabled ? '1' : '0' 
      }
    });
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

      router.push({
        pathname: '/meetings/room' as any,
        params: { 
          id: data.meeting.id, 
          camera: cameraEnabled ? '1' : '0', 
          mic: micEnabled ? '1' : '0' 
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View className="flex-1 bg-[#09090B] px-6 pt-16">
      {/* Header */}
      <View className="flex-row items-center mb-8">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10">
          <ChevronLeft size={28} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white text-2xl font-bold ml-2">CoreFlow Meeting</Text>
      </View>

      {/* Main Section - Camera Preview */}
      <View className="items-center mb-8">
        <View className="w-[65%] aspect-[3/4] bg-[#18181B] rounded-[24px] overflow-hidden shadow-2xl border border-white/5 relative">
          {cameraEnabled && camPermission?.granted ? (
            <CameraView style={{ flex: 1 }} facing="front" />
          ) : (
            <View className="flex-1 items-center justify-center bg-[#18181B]">
              <VideoOff size={48} color="#A1A1AA" />
            </View>
          )}

          {/* Floating Controls Overlay */}
          <View className="absolute bottom-6 left-0 right-0 flex-row justify-center space-x-4 px-4">
            <Pressable 
              onPress={() => setMicEnabled(!micEnabled)}
              className={`w-12 h-12 rounded-full items-center justify-center shadow-lg border border-white/10 overflow-hidden ${!micEnabled ? 'bg-[#EF4444]' : 'bg-transparent'}`}
            >
              {micEnabled && <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />}
              {!micEnabled && <View className="absolute inset-0 bg-[#EF4444]" />}
              {micEnabled ? <Mic size={22} color="#FFFFFF" /> : <MicOff size={22} color="#FFFFFF" />}
            </Pressable>
            
            <Pressable 
              onPress={() => setCameraEnabled(!cameraEnabled)}
              className={`w-12 h-12 rounded-full items-center justify-center shadow-lg border border-white/10 overflow-hidden ${!cameraEnabled ? 'bg-[#EF4444]' : 'bg-transparent'}`}
            >
              {cameraEnabled && <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />}
              {!cameraEnabled && <View className="absolute inset-0 bg-[#EF4444]" />}
              {cameraEnabled ? <Video size={22} color="#FFFFFF" /> : <VideoOff size={22} color="#FFFFFF" />}
            </Pressable>

            <Pressable className="w-12 h-12 rounded-full items-center justify-center shadow-lg border border-white/10 bg-transparent overflow-hidden">
              <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
              <Settings size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Input Section */}
      <View className="bg-[#18181B] rounded-2xl p-5 mb-8 border border-white/5">
        <Text className="text-[#A1A1AA] text-sm font-semibold mb-2">Meeting ID</Text>
        <TextInput
          className="bg-[#09090B] text-white p-4 rounded-xl text-base border border-[#27272A]"
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
          <View className="bg-[#27272A] py-4 items-center justify-center flex-row border border-white/10 rounded-full">
            <Plus size={20} color="#FFFFFF" className="mr-2" />
            <Text className="text-white text-lg font-bold">{isCreating ? 'Creating...' : 'Start Instant Meeting'}</Text>
          </View>
        </Pressable>

        <View className="flex-row items-center justify-center space-x-4 mb-2">
          <View className="h-px bg-white/10 flex-1" />
          <Text className="text-[#A1A1AA] text-sm">OR JOIN EXISTING</Text>
          <View className="h-px bg-white/10 flex-1" />
        </View>

        <Pressable 
          onPress={handleJoin}
          disabled={!meetingId.trim()}
          className={`rounded-full overflow-hidden ${!meetingId.trim() ? 'opacity-50' : 'opacity-100'}`}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-4 items-center justify-center"
          >
            <Text className="text-white text-lg font-bold">Join Now</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
