import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitRoom, useRoomContext, VideoTrack, useLocalParticipant, useTracks, useParticipant } from '@livekit/react-native';
import { Track, ExternalE2EEKeyProvider, RoomOptions } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Users, MessageSquare, MoreHorizontal } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/hooks/use-auth';
import Animated, { useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { initializeUserKeys, decryptKeyWithSender } from '@/lib/crypto';

const { width } = Dimensions.get('window');

const getLiveKitToken = async (roomId: string, token: string) => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const res = await fetch(`${baseUrl}/api/meetings/${roomId}/join`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch token from backend');
  const data = await res.json();
  return data.token;
};

export default function MeetingRoomScreen() {
  const { id, camera, mic } = useLocalSearchParams();
  const { session } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [e2eeOptions, setE2eeOptions] = useState<RoomOptions | null>(null);
  const serverUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://dummy.livekit.cloud';

  useEffect(() => {
    async function connect() {
      if (!session?.access_token) return;
      try {
        const { data: keyData, error: keyError } = await supabase
          .from('meeting_keys')
          .select('encrypted_key')
          .eq('meeting_id', id)
          .eq('user_id', session.user.id)
          .single();

        if (keyError) throw new Error('Could not fetch meeting key. Are you invited?');

        const myPubKey = await initializeUserKeys(session.user.id);
        const decryptedKeyStr = await decryptKeyWithSender(keyData.encrypted_key, myPubKey);

        const keyProvider = new ExternalE2EEKeyProvider();
        await keyProvider.setKey(decryptedKeyStr);

        setE2eeOptions({
          e2ee: {
            keyProvider,
            worker: undefined as any,
          }
        });

        const tk = await getLiveKitToken(id as string, session.access_token);
        setToken(tk);
      } catch (e) {
        console.error(e);
      }
    }
    connect();
  }, [id, session]);

  if (!token || !e2eeOptions) {
    return (
      <View className="flex-1 bg-[#09090B] justify-center items-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-[#A1A1AA] mt-4 text-base">Joining secure room...</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={mic === '1'}
      video={camera === '1'}
      options={e2eeOptions}
    >
      <MeetingUI />
    </LiveKitRoom>
  );
}

function MeetingUI() {
  const room = useRoomContext();
  const router = useRouter();
  const { localParticipant } = useLocalParticipant();
  // Filter for camera tracks to build the grid
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const handleLeave = () => {
    room.disconnect();
    router.replace('/meetings' as any);
  };

  const getGridStyle = (): any => {
    const count = tracks.length;
    if (count === 0 || count === 1) return { width: '100%', height: '100%' };
    if (count === 2) return { width: '100%', height: '49%' };
    if (count === 3 || count === 4) return { width: '49%', height: '49%' };
    // Responsive grid for 5+
    return { width: '48%', height: width * 0.6 };
  };

  return (
    <View className="flex-1 bg-[#09090B]">
      {/* Top Overlay */}
      <View className="absolute top-12 left-0 right-0 z-10 px-6 flex-row justify-between items-center">
        <View className="flex-row items-center space-x-2">
          <View className="bg-[#18181B]/80 px-3 py-1.5 rounded-full border border-white/10 flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-[#22C55E] mr-2" />
            <Text className="text-white text-sm font-semibold">{room.name || 'Meeting'}</Text>
          </View>
        </View>
        <View className="bg-[#18181B]/80 px-3 py-1.5 rounded-full border border-white/10">
          <Text className="text-[#A1A1AA] text-xs">Encrypted</Text>
        </View>
      </View>
      
      {/* Main Video Grid */}
      <View className="flex-1 px-2 pt-28 pb-32">
        {tracks.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <View className="w-24 h-24 rounded-full bg-[#18181B] items-center justify-center mb-4 border border-white/5">
              <Users size={32} color="#A1A1AA" />
            </View>
            <Text className="text-[#A1A1AA] text-base">Waiting for others to join...</Text>
          </View>
        ) : (
          <View className="flex-1 flex-row flex-wrap justify-between content-start gap-y-2">
            {tracks.map((track) => (
              <View key={track.participant.identity + track.source} style={getGridStyle()}>
                <ParticipantTile trackRef={track} />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Floating Bottom Toolbar */}
      <View className="absolute bottom-8 left-4 right-4 z-20">
        <View className="rounded-full overflow-hidden shadow-2xl border border-white/10 bg-transparent">
          <BlurView intensity={Platform.OS === 'ios' ? 60 : 100} tint="dark" className="flex-row justify-evenly items-center py-4 px-2">
            
            <Pressable 
              onPress={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
              className={`w-12 h-12 rounded-full items-center justify-center ${!localParticipant.isMicrophoneEnabled ? 'bg-[#27272A]' : 'bg-[#18181B]'}`}
            >
              {localParticipant.isMicrophoneEnabled ? <Mic size={20} color="#FFFFFF" /> : <MicOff size={20} color="#EF4444" />}
            </Pressable>

            <Pressable 
              onPress={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
              className={`w-12 h-12 rounded-full items-center justify-center ${!localParticipant.isCameraEnabled ? 'bg-[#27272A]' : 'bg-[#18181B]'}`}
            >
              {localParticipant.isCameraEnabled ? <Video size={20} color="#FFFFFF" /> : <VideoOff size={20} color="#EF4444" />}
            </Pressable>

            <Pressable className="w-12 h-12 rounded-full items-center justify-center bg-[#18181B]">
              <MonitorUp size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable className="w-12 h-12 rounded-full items-center justify-center bg-[#18181B]">
              <MessageSquare size={20} color="#FFFFFF" />
            </Pressable>
            
            <Pressable className="w-12 h-12 rounded-full items-center justify-center bg-[#18181B]">
              <MoreHorizontal size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable onPress={handleLeave} className="w-12 h-12 rounded-full items-center justify-center bg-[#EF4444]">
              <PhoneOff size={20} color="#FFFFFF" />
            </Pressable>

          </BlurView>
        </View>
      </View>
    </View>
  );
}

function ParticipantTile({ trackRef }: { trackRef: any }) {
  const participantState = useParticipant(trackRef.participant);
  const isSpeaking = participantState.isSpeaking;
  const participant = trackRef.participant;

  // Active speaker animation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: isSpeaking ? '#22C55E' : 'rgba(255,255,255,0.08)',
      borderWidth: isSpeaking ? 2 : 1,
      transform: [
        { scale: withTiming(isSpeaking ? 1.02 : 1, { duration: 200, easing: Easing.out(Easing.ease) }) }
      ]
    };
  }, [isSpeaking]);

  return (
    <Animated.View className="flex-1 bg-[#18181B] rounded-[20px] overflow-hidden relative shadow-lg" style={animatedStyle}>
      {trackRef.publication?.isMuted ? (
        <View className="flex-1 items-center justify-center bg-[#18181B]">
          <View className="w-16 h-16 rounded-full bg-[#27272A] items-center justify-center">
            <Text className="text-white text-xl font-bold">
              {(participant.name || participant.identity).charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
      ) : (
        <VideoTrack trackRef={trackRef} style={{ flex: 1 }} />
      )}
      
      {/* Participant Info Overlay */}
      <View className="absolute bottom-3 left-3 flex-row items-center bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md">
        {!participant.isMicrophoneEnabled && (
          <MicOff size={14} color="#EF4444" style={{ marginRight: 6 }} />
        )}
        <Text className="text-white text-xs font-semibold" numberOfLines={1}>
          {participant.name || participant.identity}
        </Text>
      </View>
    </Animated.View>
  );
}
