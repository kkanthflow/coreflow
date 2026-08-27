import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, Dimensions, Platform, Alert, TextInput, Modal, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitRoom, useRoomContext, VideoTrack, useLocalParticipant, useParticipant, useRemoteParticipants, useConnectionState, useTracks, AudioSession, RNKeyProvider } from '@livekit/react-native';
import { Track, ExternalE2EEKeyProvider, RoomOptions, VideoPresets, RoomEvent, ParticipantEvent, RemoteTrackPublication, ConnectionState } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Users, MessageSquare, MoreHorizontal, FileText, X, Send, Play, Volume2, VolumeX } from 'lucide-react-native';
import { Camera } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/hooks/use-auth';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const getLiveKitToken = async (roomId: string, token: string) => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
  const res = await fetch(`${baseUrl}/api/meetings/${roomId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const contentType = res.headers.get("content-type");
  let data: any = {};
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    throw new Error(`Server returned HTML/Text instead of JSON: ${text.slice(0, 100)}`);
  }

  if (!res.ok) {
    if (data.error === 'waiting_room') {
      throw { type: 'waiting_room' };
    }
    throw new Error(data.details || data.error || 'Failed to fetch token from backend');
  }
  return { token: data.token, roomUrl: data.roomUrl as string };
};

export default function MeetingRoomScreen() {
  const router = useRouter();
  const { id, camera, mic } = useLocalSearchParams();
  const { session: hookSession, isLoading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [e2eeOptions, setE2eeOptions] = useState<RoomOptions | undefined>(undefined);
  const [e2eeInitialized, setE2eeInitialized] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  // Synchronized Enterprise LiveKit Room Configuration (Matching Web)
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        simulcast: true,
        screenShareEncoding: {
          maxBitrate: 3_500_000,
          maxFramerate: 30,
        },
        screenShareSimulcastLayers: [],
        videoEncoding: {
          maxBitrate: 2_000_000,
          maxFramerate: 24,
        },
        videoSimulcastLayers: [
          VideoPresets.h720,
          VideoPresets.h360,
        ],
        dtx: true,
        backupCodec: true,
      },
    }),
    []
  );

  const isWaitingRef = useRef(isWaiting);
  useEffect(() => {
    isWaitingRef.current = isWaiting;
  }, [isWaiting]);

  // Clean up ghost waiting room status if user leaves while waiting
  useEffect(() => {
    return () => {
      if (isWaitingRef.current && hookSession?.user?.id) {
        const updateStatus = async () => {
          try {
            await supabase
              .from('meeting_participants')
              .update({ admission_status: 'left' })
              .eq('meeting_id', id)
              .eq('user_id', hookSession.user.id);
          } catch (e) { }
        };
        updateStatus();
      }
    };
  }, [id, hookSession?.user?.id]);

  useEffect(() => {
    if (token) return;

    let isMounted = true;

    async function connect() {
      try {
        setConnError(null);
        let activeSession = hookSession;
        if (!activeSession?.access_token) {
          const { data: sessData } = await supabase.auth.getSession();
          activeSession = sessData?.session;
        }

        if (!activeSession?.access_token) {
          if (authLoading) return;
          throw new Error('Not authenticated. Please log in again.');
        }

        // Configure native audio session routing for call clarity - default to loudspeaker for video conference
        try {
          await AudioSession.configureAudio({
            android: {
              preferredOutputList: ['speaker', 'bluetooth', 'headset', 'earpiece'],
              audioTypeOptions: {
                manageAudioFocus: true,
                audioMode: 'inCommunication',
                audioFocusMode: 'gain',
                audioStreamType: 'voiceCall',
                audioAttributesUsageType: 'voiceCommunication',
                audioAttributesContentType: 'speech',
                forceHandleAudioRouting: true,
              }
            },
            ios: {
              defaultOutput: 'speaker'
            }
          });
        } catch (audioErr) {
          console.warn('AudioSession configuration warning:', audioErr);
        }

        const result = await getLiveKitToken(id as string, activeSession.access_token);
        if (isMounted) {
          setIsWaiting(false);
          setToken(result.token);
          const rawUrl = result.roomUrl || process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://coreflow-eo6z5wme.livekit.cloud';
          const cleanUrl = rawUrl.replace(/^["']|["']$/g, '').trim();
          setServerUrl(cleanUrl);
        }
      } catch (e: any) {
        if (!isMounted) return;
        if (e.type === 'waiting_room') {
          setIsWaiting(true);
        } else {
          console.error('Connection error:', e);
          const errMsg = e.message || 'Failed to connect to the meeting.';
          setConnError(errMsg);
          Alert.alert('Connection Error', errMsg, [
            { text: 'Back to Meetings', onPress: () => router.replace('/meetings' as any) }
          ]);
        }
      }
    }

    connect();

    // Subscribe to admission_status changes if waiting
    const currentUserId = hookSession?.user?.id;
    let channel: any = null;
    if (currentUserId) {
      channel = supabase
        .channel(`waiting_room_${id}_${currentUserId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'meeting_participants',
            filter: `meeting_id=eq.${id}`,
          },
          (payload) => {
            if (payload.new.user_id === currentUserId && payload.new.admission_status === 'admitted') {
              if (isMounted) {
                setIsWaiting(false);
                connect();
              }
            }

          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [id, hookSession, authLoading, token]);

  if (isWaiting) {
    return (
      <View className="flex-1 bg-[#09090B] justify-center items-center px-8">
        <Users size={64} color="#3B82F6" className="mb-6" />
        <Text className="text-white text-2xl font-bold mb-3 text-center">Waiting Room</Text>
        <Text className="text-[#A1A1AA] text-base text-center mb-8">
          You'll join the meeting when the host admits you.
        </Text>
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
  }

  if (connError) {
    return (
      <View className="flex-1 bg-[#09090B] justify-center items-center px-8">
        <Text className="text-red-500 text-xl font-bold mb-3 text-center">Connection Failed</Text>
        <Text className="text-[#A1A1AA] text-sm text-center mb-8">{connError}</Text>
        <Pressable
          onPress={() => router.replace('/meetings' as any)}
          className="bg-[#2563EB] px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Back to Meetings</Text>
        </Pressable>
      </View>
    );
  }

  if (!token || !serverUrl) {
    return (
      <View className="flex-1 bg-[#09090B] justify-center items-center px-8">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-[#A1A1AA] mt-4 text-base font-medium">Connecting to meeting...</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={mic === '1' ? { autoGainControl: true, echoCancellation: true, noiseSuppression: true } : false}
      video={camera === '1'}
      options={roomOptions}
      onError={(error) => {
        console.error('[LiveKitRoom] Connection error:', error);
        Alert.alert(
          'Connection Failed',
          error?.message || 'Could not connect to the meeting room. Please check your internet connection and try again.',
          [{ text: 'OK', onPress: () => router.replace('/meetings' as any) }]
        );
      }}
    >
      <MeetingUI initialCameraEnabled={camera === '1'} />
    </LiveKitRoom>
  );
}

function MeetingUI({ initialCameraEnabled }: { initialCameraEnabled?: boolean }) {
  const room = useRoomContext();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const participants = useRemoteParticipants();

  const [waitingUsers, setWaitingUsers] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ id: string, text: string, sender: string, time: string, isSelf: boolean }[]>([]);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState<any>(null);
  const isHost = meetingDetails?.host_id === session?.user?.id;

  useEffect(() => {
    if (!id) return;
    supabase
      .from('meetings')
      .select('id, host_id, title, status')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMeetingDetails(data);
      });
  }, [id]);

  const connectionState = useConnectionState(room);

  // Connection timeout fallback: if stuck connecting for > 15 seconds, show retry
  useEffect(() => {
    if (connectionState === ConnectionState.Connecting || connectionState === ConnectionState.Reconnecting || connectionState === undefined) {
      const timeout = setTimeout(() => {
        setConnectTimedOut(true);
      }, 15000);
      return () => clearTimeout(timeout);
    } else {
      setConnectTimedOut(false);
    }
  }, [connectionState]);

  const toggleAudioOutput = async () => {
    try {
      const targetOutput = isSpeakerOn ? 'earpiece' : 'speaker';
      const outputs = await AudioSession.getAudioOutputs();
      if (outputs.includes(targetOutput)) {
        await AudioSession.selectAudioOutput(targetOutput);
        setIsSpeakerOn(!isSpeakerOn);
      } else {
        // Fallback if specific output is not found
        await AudioSession.selectAudioOutput(isSpeakerOn ? outputs[0] : 'speaker');
        setIsSpeakerOn(!isSpeakerOn);
      }
    } catch (err) {
      console.warn('Audio output switch failed:', err);
    }
  };

  // Add event listeners for debugging LiveKit connection and tracks
  useEffect(() => {
    const onConnected = () => console.log('[LiveKit] Connected to room:', room.name);
    const onDisconnected = () => console.log('[LiveKit] Disconnected from room');
    const onStateChanged = (state: ConnectionState) => console.log('[LiveKit] ConnectionStateChanged:', state);
    const onMediaError = (error: Error) => console.error('[LiveKit] MediaDevicesError:', error);
    const onTrackSubscribed = (track: Track, pub: RemoteTrackPublication, participant: any) => {
      console.log(`[LiveKit] TrackSubscribed: ${track.kind} from ${participant.identity}`);
    };
    const onTrackPublished = (pub: any, participant: any) => {
      console.log(`[LiveKit] TrackPublished: ${pub.kind} from ${participant.identity}`);
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ConnectionStateChanged, onStateChanged);
    room.on(RoomEvent.MediaDevicesError, onMediaError);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackPublished, onTrackPublished);

    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.ConnectionStateChanged, onStateChanged);
      room.off(RoomEvent.MediaDevicesError, onMediaError);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
    };
  }, [room]);

  const [renderCounter, setRenderCounter] = useState(0);

  useEffect(() => {
    const forceRender = () => setRenderCounter(c => c + 1);

    room.on(RoomEvent.TrackPublished, forceRender);
    room.on(RoomEvent.TrackUnpublished, forceRender);
    room.on(RoomEvent.TrackMuted, forceRender);
    room.on(RoomEvent.TrackUnmuted, forceRender);
    room.on(RoomEvent.ParticipantConnected, forceRender);
    room.on(RoomEvent.ParticipantDisconnected, forceRender);

    return () => {
      room.off(RoomEvent.TrackPublished, forceRender);
      room.off(RoomEvent.TrackUnpublished, forceRender);
      room.off(RoomEvent.TrackMuted, forceRender);
      room.off(RoomEvent.TrackUnmuted, forceRender);
      room.off(RoomEvent.ParticipantConnected, forceRender);
      room.off(RoomEvent.ParticipantDisconnected, forceRender);
    };
  }, [room]);

  // Screen share listener
  const screenShareTrack = useTracks([Track.Source.ScreenShare], { onlySubscribed: false })[0];
  const presenter = screenShareTrack?.participant;
  const screenSharePub = screenShareTrack?.publication;

  useEffect(() => {
    if (presenter && !presenter.isLocal && screenSharePub) {
      const pubAny = screenSharePub as any;
      if (typeof pubAny.setPriority === 'function') {
        pubAny.setPriority('high');
      }
      if (typeof pubAny.setSubscribed === 'function') {
        pubAny.setSubscribed(true);
      }
    }
  }, [presenter, screenSharePub]);

  useEffect(() => {
    async function selectSpeaker() {
      try {
        await AudioSession.startAudioSession();
        const outputs = await AudioSession.getAudioOutputs();
        console.log('[AudioSession] Available outputs:', outputs);
        if (outputs.includes('speaker')) {
          await AudioSession.selectAudioOutput('speaker');
          console.log('[AudioSession] Selected speaker (loudspeaker)');
          setIsSpeakerOn(true);
        } else if (outputs.includes('bluetooth')) {
          await AudioSession.selectAudioOutput('bluetooth');
        } else if (outputs.includes('headset')) {
          await AudioSession.selectAudioOutput('headset');
        }
      } catch (err) {
        console.warn('Speaker routing force failed:', err);
      }
    }

    if (room.state === ConnectionState.Connected) {
      selectSpeaker();
    }

    // Call on connected, track subscribed, and delayed to ensure native routing catches after WebRTC audio track init
    const timer1 = setTimeout(selectSpeaker, 300);
    const timer2 = setTimeout(selectSpeaker, 1200);

    room.on(RoomEvent.Connected, selectSpeaker);
    room.on(RoomEvent.TrackSubscribed, selectSpeaker);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      room.off(RoomEvent.Connected, selectSpeaker);
      room.off(RoomEvent.TrackSubscribed, selectSpeaker);
    };
  }, [room]);

  // Chat data listener (supports both Mobile custom packets and LiveKit standard web Chat component)
  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array, participant?: any, _kind?: any, _topic?: string) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        let messageText = '';
        try {
          const parsed = JSON.parse(decoded);
          messageText = parsed.message || parsed.text || decoded;
        } catch {
          messageText = decoded;
        }

        if (messageText && messageText.trim()) {
          setMessages(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            text: messageText,
            sender: participant?.name || participant?.identity || 'Participant',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: false
          }]);
        }
      } catch (err) {
        console.error('Error handling data message:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => { room.off(RoomEvent.DataReceived, handleDataReceived); };
  }, [room]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !localParticipant) return;
    const textToSend = chatInput.trim();
    setChatInput('');
    try {
      // Standard LiveKit Chat Protocol format required by @livekit/components-react web <Chat />
      const payload = JSON.stringify({
        id: Date.now().toString(),
        message: textToSend,
        text: textToSend,
        timestamp: Date.now()
      });
      await localParticipant.publishData(new TextEncoder().encode(payload), {
        reliable: true,
        topic: 'lk-chat-topic'
      });
      setMessages(prev => [...prev, {
        id: Date.now().toString() + Math.random(),
        text: textToSend,
        sender: 'You',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: true
      }]);
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notes synchronization with backend (shared across web and mobile)
  const openNotes = async () => {
    setIsNotesOpen(true);
    if (!session?.access_token || !id) return;
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
      const res = await fetch(`${baseUrl}/api/meetings/${id}/notes`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notes?.content) {
          setNotesText(data.notes.content);
        }
      }
    } catch (e) { }
  };

  const handleNotesChange = (text: string) => {
    setNotesText(text);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(async () => {
      if (!session?.access_token || !id) return;
      setIsSaving(true);
      try {
        const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
        await fetch(`${baseUrl}/api/meetings/${id}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ content: text })
        });
      } catch (e) { } finally {
        setIsSaving(false);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  // Waiting room management for Host
  useEffect(() => {
    const fetchWaiting = async () => {
      const { data } = await supabase
        .from('meeting_participants')
        .select('*, users(full_name, email)')
        .eq('meeting_id', id)
        .eq('admission_status', 'waiting');
      if (data) setWaitingUsers(data);
    };

    fetchWaiting();

    const channel = supabase
      .channel(`waiting_room_host_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_participants', filter: `meeting_id=eq.${id}` },
        () => fetchWaiting()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const admitUser = async (userId: string) => {
    const { error } = await supabase.from('meeting_participants').update({ admission_status: 'admitted' }).eq('meeting_id', id).eq('user_id', userId);
    if (error) Alert.alert('Error admitting user', error.message);
  };
  const denyUser = async (userId: string) => {
    const { error } = await supabase.from('meeting_participants').update({ admission_status: 'rejected' }).eq('meeting_id', id).eq('user_id', userId);
    if (error) Alert.alert('Error denying user', error.message);
  };

  const handleLeave = () => {
    if (isHost) {
      Alert.alert(
        'Leave or End Meeting',
        'As the host, do you want to end the meeting for all participants or just leave?',
        [
          {
            text: 'Leave Only',
            style: 'default',
            onPress: () => {
              try { room.disconnect(); } catch {}
              router.replace('/meetings' as any);
            }
          },
          {
            text: 'End Meeting for All',
            style: 'destructive',
            onPress: async () => {
              try {
                await supabase
                  .from('meetings')
                  .update({ status: 'completed', ended_at: new Date().toISOString() })
                  .eq('id', id);

                const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
                if (session?.access_token) {
                  fetch(`${baseUrl}/api/meetings/${id}/end`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` }
                  }).catch(() => {});
                }
              } catch (e) {
                console.error('Error ending meeting:', e);
              } finally {
                try { room.disconnect(); } catch {}
                router.replace('/meetings' as any);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      try { room.disconnect(); } catch {}
      router.replace('/meetings' as any);
    }
  };

  const getGridStyle = (count: number): any => {
    if (count === 0 || count === 1) return { width: '100%', height: '100%', minHeight: 200 };
    if (count === 2) return { width: '100%', height: '49%', minHeight: 180 };
    if (count === 3 || count === 4) return { width: '49%', height: '49%', minHeight: 150 };
    return { width: '48%', height: width * 0.6, minHeight: 140 };
  };

  // ── Guard: show spinner while LiveKit is still connecting ────────────────
  if (connectionState === ConnectionState.Connecting || connectionState === ConnectionState.Reconnecting || connectionState === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ color: '#A1A1AA', marginTop: 16, fontSize: 15, textAlign: 'center' }}>
          {connectionState === ConnectionState.Reconnecting ? 'Reconnecting to room…' : 'Connecting to room…'}
        </Text>
        {connectTimedOut && (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ color: '#F59E0B', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
              Connection is taking longer than expected.
            </Text>
            <Pressable
              onPress={handleLeave}
              style={{ backgroundColor: '#27272A', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Cancel & Return</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Disconnected</Text>
        <Text style={{ color: '#A1A1AA', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
          Lost connection to the meeting room.
        </Text>
        <Pressable
          onPress={handleLeave}
          style={{ backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Back to Meetings</Text>
        </Pressable>
      </View>
    );
  }

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

      {/* Waiting Room Banner */}
      {waitingUsers.length > 0 && (
        <View className="absolute z-20 left-4 right-4 bg-[#2563EB] rounded-xl p-4 shadow-xl border border-blue-400" style={{ top: insets.top + 60 }}>
          <Text className="text-white font-bold text-base mb-2">
            {waitingUsers.length} {waitingUsers.length === 1 ? 'person is' : 'people are'} waiting to join
          </Text>
          {waitingUsers.map(u => (
            <View key={u.user_id} className="flex-row justify-between items-center mb-2">
              <Text className="text-white">{u.users?.full_name || u.users?.email || 'Unknown'}</Text>
              <View className="flex-row gap-2">
                <Pressable onPress={() => denyUser(u.user_id)} className="bg-red-500/80 px-3 py-1 rounded-full"><Text className="text-white text-xs font-bold">Deny</Text></Pressable>
                <Pressable onPress={() => admitUser(u.user_id)} className="bg-white px-3 py-1 rounded-full"><Text className="text-blue-600 text-xs font-bold">Admit</Text></Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Main Content (Presenter Mode vs Camera Grid) */}
      <View className="flex-1 px-2 pt-28 pb-32">
        {presenter && screenSharePub ? (
          /* ── Presenter Mode (Google Meet parity) ── */
          <View className="flex-1 flex-col gap-2">
            <View className="flex-1 rounded-2xl bg-black border border-white/10">
              {presenter.isLocal ? (
                <View className="flex-1 items-center justify-center p-6 bg-[#121214]">
                  <MonitorUp size={48} color="#3B82F6" className="mb-4" />
                  <Text className="text-white text-xl font-bold text-center mb-2">You are presenting to everyone</Text>
                  <Text className="text-gray-400 text-sm text-center mb-6">Your screen is visible to all meeting participants in 1080p @ 30 FPS.</Text>
                  <Pressable
                    onPress={async () => {
                      try { await localParticipant?.setScreenShareEnabled(false); } catch (e) { }
                    }}
                    className="bg-red-600 px-6 py-3 rounded-full flex-row items-center gap-2"
                  >
                    <Text className="text-white font-bold text-sm">Stop Presenting</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-1 relative justify-center items-center">
                  <VideoTrack
                    trackRef={{
                      participant: presenter as any,
                      publication: screenSharePub as any,
                      source: Track.Source.ScreenShare
                    }}
                    style={{ width: '100%', height: '100%' }}
                    objectFit="contain"
                  />
                  <View className="absolute top-3 left-3 bg-black/70 px-3 py-1.5 rounded-full border border-white/10 flex-row items-center gap-2">
                    <MonitorUp size={14} color="#3B82F6" />
                    <Text className="text-white text-xs font-semibold">{presenter.name || presenter.identity} is presenting</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Horizontal Filmstrip for Camera Feeds */}
            <View className="h-28">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {[localParticipant, ...participants].filter(Boolean).map((participant: any) => (
                  <View key={participant.identity} className="w-36 h-28">
                    <ParticipantTile participant={participant} />
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* ── Camera Grid Mode ── */
          (() => {
            const allParticipants = [localParticipant, ...participants].filter(Boolean);
            return allParticipants.length === 0 ? (
              <View className="flex-1 justify-center items-center">
                <View className="w-24 h-24 rounded-full bg-[#18181B] items-center justify-center mb-4 border border-white/5">
                  <Users size={32} color="#A1A1AA" />
                </View>
                <Text className="text-[#A1A1AA] text-base">Waiting for others to join...</Text>
              </View>
            ) : (
              <View className="flex-1 flex-row flex-wrap justify-between content-start gap-y-2">
                {allParticipants.map((participant: any) => (
                  <View key={participant.identity} style={getGridStyle(allParticipants.length)}>
                    <ParticipantTile participant={participant} />
                  </View>
                ))}
              </View>
            );
          })()
        )}
      </View>

      {/* Floating Bottom Toolbar */}
      <View className="absolute bottom-8 left-4 right-4 z-20">
        <View className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black/20">
          <BlurView intensity={Platform.OS === 'ios' ? 60 : 100} tint="dark">
            <View className="flex-row justify-evenly items-center py-4 px-2">
              <Pressable
                onPress={async () => {
                  try {
                    if (!isMicrophoneEnabled) {
                      const { granted } = await Camera.requestMicrophonePermissionsAsync();
                      if (!granted) {
                        Alert.alert('Permission Denied', 'Microphone permission is required.');
                        return;
                      }
                    }
                    await localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
                  } catch (e: any) {
                    Alert.alert('Permission Denied', 'Could not access microphone.');
                  }
                }}
                className={`w-12 h-12 rounded-full items-center justify-center ${!isMicrophoneEnabled ? 'bg-[#27272A]' : 'bg-[#18181B]'}`}
              >
                {isMicrophoneEnabled ? <Mic size={20} color="#FFFFFF" /> : <MicOff size={20} color="#EF4444" />}
              </Pressable>

              <Pressable
                onPress={async () => {
                  try {
                    if (!isCameraEnabled) {
                      const { granted } = await Camera.requestCameraPermissionsAsync();
                      if (!granted) {
                        Alert.alert('Permission Denied', 'Camera permission is required.');
                        return;
                      }
                    }
                    await localParticipant?.setCameraEnabled(!isCameraEnabled);
                  } catch (e: any) {
                    Alert.alert('Permission Denied', 'Could not access camera.');
                  }
                }}
                className={`w-12 h-12 rounded-full items-center justify-center ${!isCameraEnabled ? 'bg-[#27272A]' : 'bg-[#18181B]'}`}
              >
                {isCameraEnabled ? <Video size={20} color="#FFFFFF" /> : <VideoOff size={20} color="#EF4444" />}
              </Pressable>

              <Pressable
                onPress={async () => {
                  try {
                    await localParticipant?.setScreenShareEnabled(!isScreenShareEnabled);
                  } catch (e: any) {
                    Alert.alert('Screen Share Error', 'Could not start screen share. Please check permissions.');
                  }
                }}
                className={`w-12 h-12 rounded-full items-center justify-center ${isScreenShareEnabled ? 'bg-[#2563EB]' : 'bg-[#18181B]'}`}
              >
                <MonitorUp size={20} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={toggleAudioOutput}
                className={`w-12 h-12 rounded-full items-center justify-center ${isSpeakerOn ? 'bg-[#2563EB]' : 'bg-[#18181B]'}`}
              >
                {isSpeakerOn ? <Volume2 size={20} color="#FFFFFF" /> : <VolumeX size={20} color="#A1A1AA" />}
              </Pressable>

              <Pressable onPress={openNotes} className="w-12 h-12 rounded-full items-center justify-center bg-[#18181B]">
                <FileText size={20} color="#FFFFFF" />
              </Pressable>

              <Pressable onPress={() => setIsChatOpen(true)} className="w-12 h-12 rounded-full items-center justify-center bg-[#18181B]">
                <MessageSquare size={20} color="#FFFFFF" />
              </Pressable>

              <Pressable onPress={handleLeave} className="w-12 h-12 rounded-full items-center justify-center bg-[#EF4444]">
                <PhoneOff size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </BlurView>
        </View>
      </View>

      {/* Notes Modal */}
      <Modal visible={isNotesOpen} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setIsNotesOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#09090B]">
          <View className="flex-row justify-between items-center p-4 border-b border-white/10 mt-2">
            <View className="flex-row items-center gap-2">
              <FileText size={24} color="#2563EB" />
              <Text className="text-white font-bold text-lg">My Notes</Text>
              {isSaving && <ActivityIndicator size="small" color="#2563EB" />}
            </View>
            <Pressable onPress={() => setIsNotesOpen(false)} className="p-2">
              <X size={24} color="#A1A1AA" />
            </Pressable>
          </View>
          <TextInput
            className="flex-1 p-4 text-white text-base"
            multiline
            textAlignVertical="top"
            placeholder="Type your notes here..."
            placeholderTextColor="#71717A"
            value={notesText}
            onChangeText={handleNotesChange}
            style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={isChatOpen} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setIsChatOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#09090B]">
          <View className="flex-row justify-between items-center p-4 border-b border-white/10 mt-2">
            <View className="flex-row items-center gap-2">
              <MessageSquare size={24} color="#2563EB" />
              <Text className="text-white font-bold text-lg">Meeting Chat</Text>
            </View>
            <Pressable onPress={() => setIsChatOpen(false)} className="p-2">
              <X size={24} color="#A1A1AA" />
            </Pressable>
          </View>

          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View className={`max-w-[80%] rounded-2xl p-3 ${item.isSelf ? 'bg-[#2563EB] self-end' : 'bg-[#27272A] self-start'}`}>
                <View className="flex-row justify-between items-end mb-1 gap-4">
                  <Text className={`font-semibold text-xs ${item.isSelf ? 'text-blue-100' : 'text-gray-300'}`}>{item.sender}</Text>
                  <Text className={`text-[10px] ${item.isSelf ? 'text-blue-200' : 'text-gray-400'}`}>{item.time}</Text>
                </View>
                <Text className="text-white text-sm">{item.text}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-10">
                <Text className="text-[#A1A1AA]">No messages yet. Say hi!</Text>
              </View>
            }
          />

          <View className="p-4 border-t border-white/10 flex-row items-center gap-2 mb-2">
            <TextInput
              className="flex-1 bg-[#27272A] text-white p-3 rounded-full"
              placeholder="Type a message..."
              placeholderTextColor="#71717A"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendChatMessage}
            />
            <Pressable onPress={sendChatMessage} className="w-12 h-12 rounded-full bg-[#2563EB] items-center justify-center">
              <Send size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const ParticipantTile = memo(function ParticipantTile({ participant }: { participant: any }) {
  const [, setUpdateTrigger] = useState(0);

  useEffect(() => {
    if (!participant) return;
    const forceUpdate = () => setUpdateTrigger(v => v + 1);

    if (typeof participant.on === 'function') {
      participant.on(ParticipantEvent.TrackPublished, forceUpdate);
      participant.on(ParticipantEvent.TrackUnpublished, forceUpdate);
      participant.on(ParticipantEvent.TrackSubscribed, forceUpdate);
      participant.on(ParticipantEvent.TrackUnsubscribed, forceUpdate);
      participant.on(ParticipantEvent.TrackMuted, forceUpdate);
      participant.on(ParticipantEvent.TrackUnmuted, forceUpdate);
      participant.on(ParticipantEvent.IsSpeakingChanged, forceUpdate);
    }

    return () => {
      if (typeof participant.off === 'function') {
        participant.off(ParticipantEvent.TrackPublished, forceUpdate);
        participant.off(ParticipantEvent.TrackUnpublished, forceUpdate);
        participant.off(ParticipantEvent.TrackSubscribed, forceUpdate);
        participant.off(ParticipantEvent.TrackUnsubscribed, forceUpdate);
        participant.off(ParticipantEvent.TrackMuted, forceUpdate);
        participant.off(ParticipantEvent.TrackUnmuted, forceUpdate);
        participant.off(ParticipantEvent.IsSpeakingChanged, forceUpdate);
      }
    };
  }, [participant]);

  const participantState = useParticipant(participant);
  const isSpeaking = participantState?.isSpeaking ?? participant?.isSpeaking ?? false;

  // Use useTracks to retrieve camera tracks
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });

  const participantTrackRef = cameraTracks.find(
    t => t.participant?.identity === participant?.identity
  );

  const cameraPub = participantTrackRef?.publication || participantState?.cameraPublication ||
    (typeof participant?.getTrackPublication === 'function' ? participant.getTrackPublication(Track.Source.Camera) : null);

  const isLocal = participant?.isLocal ?? false;
  const isLocalCamActive = isLocal && Boolean(participant?.isCameraEnabled || (cameraPub && !cameraPub.isMuted));
  const isRemoteCamActive = !isLocal && Boolean(
    participant?.isCameraEnabled || (cameraPub && !cameraPub.isMuted) || (participantTrackRef?.publication && !participantTrackRef.publication.isMuted)
  );

  const hasValidVideo = Boolean(isLocal ? isLocalCamActive : isRemoteCamActive);

  const resolvedTrackRef = participantTrackRef || (cameraPub ? {
    participant,
    source: Track.Source.Camera,
    publication: cameraPub,
    track: cameraPub.track
  } : (participant ? {
    participant,
    source: Track.Source.Camera
  } : null));

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: isSpeaking ? '#22C55E' : 'rgba(255,255,255,0.08)',
      borderWidth: isSpeaking ? 2 : 1,
      transform: [
        { scale: withTiming(isSpeaking ? 1.02 : 1, { duration: 200 }) }
      ]
    };
  }, [isSpeaking]);

  const initials = ((participant.name || participant.identity || '?').charAt(0) || '?').toUpperCase();

  return (
    <Animated.View className="flex-1 bg-[#18181B] rounded-[20px] relative shadow-lg overflow-hidden" style={[animatedStyle, { flex: 1, backgroundColor: '#18181B' }]}>
      {(!hasValidVideo || !resolvedTrackRef) ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18181B' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#27272A', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>
              {initials}
            </Text>
          </View>
        </View>
      ) : (
        <VideoTrack
          trackRef={resolvedTrackRef as any}
          style={{ flex: 1, width: '100%', height: '100%' }}
          objectFit="cover"
          mirror={isLocal}
          zOrder={0}
        />
      )}

      {/* Participant Info Overlay */}
      <View className="absolute bottom-3 left-3 flex-row items-center bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md">
        {!participant.isMicrophoneEnabled && (
          <MicOff size={14} color="#EF4444" style={{ marginRight: 6 }} />
        )}
        <Text className="text-white text-xs font-semibold" numberOfLines={1}>
          {participant.name || participant.identity}{isLocal ? ' (You)' : ''}
        </Text>
      </View>
    </Animated.View>
  );
});
