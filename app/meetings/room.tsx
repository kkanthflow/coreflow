import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, Dimensions, Platform, Alert, TextInput, Modal, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitRoom, useRoomContext, VideoTrack, useLocalParticipant, useParticipant, useParticipants, AudioSession, RNKeyProvider } from '@livekit/react-native';
import { Track, ExternalE2EEKeyProvider, RoomOptions, VideoPresets, RoomEvent, RemoteTrackPublication, ConnectionState } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Users, MessageSquare, MoreHorizontal, FileText, X, Send, Play } from 'lucide-react-native';
import { Camera } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/hooks/use-auth';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { initializeUserKeys, decryptKeyWithSender } from '@/lib/crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

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
  return data.token;
};

export default function MeetingRoomScreen() {
  const router = useRouter();
  const { id, camera, mic } = useLocalSearchParams();
  const { session } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [e2eeOptions, setE2eeOptions] = useState<RoomOptions | undefined>(undefined);
  const [e2eeInitialized, setE2eeInitialized] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const serverUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://coreflow-eo6z5wme.livekit.cloud';

  // Synchronized Enterprise LiveKit Room Configuration (Matching Web)
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: true, // Enable automatic video tile resolution scaling based on view size
      dynacast: true,       // Pause stream layers that are not active/visible to others
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h1080.resolution,
      },
      publishDefaults: {
        screenShareEncoding: {
          maxBitrate: 3_500_000,
          maxFramerate: 30,
        },
        screenShareSimulcastLayers: [], // Single 1080p @ 30 FPS layer (no low-res downscaling)
        videoEncoding: {
          maxBitrate: 2_500_000, // Reduced slightly to avoid saturating upload bandwidth
          maxFramerate: 24,      // 24fps delivers cinema-smooth video without heavy network packet delays
        },
        videoSimulcastLayers: [
          VideoPresets.h1080,
          VideoPresets.h720,
          VideoPresets.h360,
        ],
        dtx: true,
        backupCodec: true, // Enable fallback codecs if primary has high latency
      },
      latency: false,
      ...(e2eeOptions || {}),
    }),
    [e2eeOptions]
  );

  const isWaitingRef = useRef(isWaiting);
  useEffect(() => {
    isWaitingRef.current = isWaiting;
  }, [isWaiting]);

  // Clean up ghost waiting room status if user leaves while waiting
  useEffect(() => {
    return () => {
      if (isWaitingRef.current && session?.user?.id) {
        const updateStatus = async () => {
          try {
            await supabase
              .from('meeting_participants')
              .update({ admission_status: 'left' })
              .eq('meeting_id', id)
              .eq('user_id', session.user.id);
          } catch (e) {}
        };
        updateStatus();
      }
    };
  }, [id, session?.user?.id]);

  useEffect(() => {
    if (!session?.access_token) return;

    let isMounted = true;

    async function connect() {
      if (!session?.access_token) return;
      try {
        // Configure native audio session routing to default to loudspeaker output on mobile
        try {
          await AudioSession.configureAudio({
            android: {
              // 'speaker' first means Android picks loudspeaker when no headphones plugged in
              preferredOutputList: ['speaker', 'bluetooth', 'headset', 'earpiece'],
              audioTypeOptions: {
                manageAudioFocus: true,
                // Use 'normal' mode (NOT 'inCommunication') — inCommunication forces earpiece
                audioMode: 'normal',
                audioFocusMode: 'gain',
                // Use 'music' stream so Android routes through media speaker, not call earpiece
                audioStreamType: 'music',
                audioAttributesUsageType: 'media',
                audioAttributesContentType: 'speech',
                // Force audio routing even if mode restriction applies on some devices
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
        
        // Fetch and set up native-bound E2EE encryption key matching the web
        const { data: keyData, error: keyError } = await supabase
          .from('meeting_keys')
          .select('encrypted_key')
          .eq('meeting_id', id)
          .eq('user_id', session.user.id)
          .single();

        if (!keyError && keyData?.encrypted_key) {
          try {
            const myPubKey = await initializeUserKeys(session.user.id);
            const decryptedKeyStr = await decryptKeyWithSender(keyData.encrypted_key, myPubKey);

            // RNKeyProvider is the React Native native-bound counterpart of ExternalE2EEKeyProvider
            const keyProvider = new RNKeyProvider({ sharedKey: true });
            await keyProvider.setSharedKey(decryptedKeyStr);

            if (isMounted) {
              setE2eeOptions({
                e2ee: {
                  keyProvider,
                  worker: undefined as any, // Not used by native RNKeyProvider, but typed
                },
              });
            }
          } catch (cryptoError) {
            console.error('Failed to initialize E2EE keys:', cryptoError);
          }
        }
        if (isMounted) setE2eeInitialized(true);

        const tk = await getLiveKitToken(id as string, session.access_token);
        if (isMounted) {
          setIsWaiting(false);
          setToken(tk);
        }
      } catch (e: any) {
        if (!isMounted) return;
        if (e.type === 'waiting_room') {
          setIsWaiting(true);
        } else {
          console.error('Connection error:', e);
          Alert.alert('Connection Error', e.message || 'Failed to connect to the meeting.');
        }
      }
    }
    
    connect();

    // Subscribe to admission_status changes if waiting
    const channel = supabase
      .channel(`waiting_room_${id}_${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meeting_participants',
          filter: `meeting_id=eq.${id}`,
        },
        (payload) => {
          if (payload.new.user_id === session.user.id && payload.new.admission_status === 'admitted') {
            if (isMounted) {
              setIsWaiting(false);
              connect();
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id, session?.access_token, session?.user?.id]);

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

  if (!token || !e2eeInitialized) {
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
      audio={mic === '1' ? { autoGainControl: true, echoCancellation: true, noiseSuppression: true } : false}
      video={camera === '1' ? { resolution: VideoPresets.h1080 } : false}
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
      <MeetingUI />
    </LiveKitRoom>
  );
}

function MeetingUI() {
  const room = useRoomContext();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const participants = useParticipants();

  const [waitingUsers, setWaitingUsers] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ id: string, text: string, sender: string, time: string, isSelf: boolean }[]>([]);

  // ── Guard: show spinner while LiveKit is still connecting ────────────────
  // Without this, the UI renders as a black screen during the WebSocket handshake
  if (room.state === ConnectionState.Connecting || room.state === ConnectionState.Reconnecting) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ color: '#A1A1AA', marginTop: 16, fontSize: 15 }}>
          {room.state === ConnectionState.Reconnecting ? 'Reconnecting…' : 'Connecting to room…'}
        </Text>
      </View>
    );
  }

  if (room.state === ConnectionState.Disconnected) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Disconnected</Text>
        <Text style={{ color: '#A1A1AA', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
          Lost connection to the meeting room.
        </Text>
        <Pressable
          onPress={() => router.replace('/meetings' as any)}
          style={{ backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Back to Meetings</Text>
        </Pressable>
      </View>
    );
  }



  // Detect active presenter
  const presenter = participants.find((p: any) => p.isScreenShareEnabled);
  const screenSharePub = presenter?.getTrackPublication(Track.Source.ScreenShare);

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

  // Automatically force loudspeaker output routing when room connection completes
  useEffect(() => {
    async function selectSpeaker() {
      try {
        const outputs = await AudioSession.getAudioOutputs();
        if (outputs.includes('speaker')) {
          await AudioSession.selectAudioOutput('speaker');
        }
      } catch (err) {
        console.warn('Loudspeaker routing force failed:', err);
      }
    }
    selectSpeaker();
  }, []);

  useEffect(() => {
    const handleData = (payload: Uint8Array, participant?: any) => {
      let str = '';
      try {
        if (typeof TextDecoder !== 'undefined') {
          str = new TextDecoder().decode(payload);
        } else {
          // Fallback that avoids stack overflow on large arrays
          str = payload.reduce((data, byte) => data + String.fromCharCode(byte), '');
        }
      } catch (err) {
        str = payload.reduce((data, byte) => data + String.fromCharCode(byte), '');
      }

      try {
        const msg = JSON.parse(str);
        if (msg.type === 'chat') {
          setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            text: msg.text,
            sender: participant?.name || participant?.identity || 'Someone',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: false,
          }]);
        }
      } catch (e) {}
    };
    
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !localParticipant) return;
    
    const msgObj = { type: 'chat', text: chatInput.trim() };
    const str = JSON.stringify(msgObj);
    
    let data;
    try {
      data = new TextEncoder().encode(str);
    } catch (err) {
      data = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) data[i] = str.charCodeAt(i);
    }
    
    try {
      await localParticipant.publishData(data, { reliable: true });
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        text: msgObj.text,
        sender: 'Me',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: true,
      }]);
      setChatInput('');
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [notesId, setNotesId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const defaultNotesTemplate = `# Meeting Notes\n\n**Agenda:**\n- \n\n**Decisions:**\n- \n\n**Action Items:**\n- `;

  const openNotes = async () => {
    setIsNotesOpen(true);
    if (!notesText && session?.user?.id) {
      const { data } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('meeting_id', id)
        .eq('author_id', session.user.id)
        .limit(1)
        .single();
      
      if (data) {
        setNotesText(data.content);
        setNotesId(data.id);
      } else {
        setNotesText(defaultNotesTemplate);
      }
    }
  };

  const saveNotes = async (text: string) => {
    if (!session?.user?.id) return;
    setIsSaving(true);
    try {
      if (notesId) {
        await supabase.from('meeting_notes').update({ content: text, updated_at: new Date().toISOString() }).eq('id', notesId);
      } else {
        const { data } = await supabase.from('meeting_notes').insert({
          meeting_id: id,
          author_id: session.user.id,
          content: text
        }).select('id').single();
        if (data) setNotesId(data.id);
      }
    } catch (e) {
      console.error('Failed to save notes', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesChange = (text: string) => {
    setNotesText(text);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveNotes(text);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

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
      .channel(`host_waiting_${id}`)
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
    ReactNativeForegroundService.stopAll();
    router.replace('/meetings' as any);
  };

  useEffect(() => {
    // Start the foreground service with camera + microphone type declared.
    // On Android 14+, the OS requires the service to declare these types at start-time
    // Camera + microphone foreground service types are declared in AndroidManifest
    // via withLiveKitForegroundService.js plugin (camera|microphone|mediaProjection).
    // That manifest declaration is what tells Android to allow continued camera capture
    // while backgrounded — no runtime JS property is needed here.
    ReactNativeForegroundService.start({
      id: 144,
      title: "Meeting Active",
      message: "Camera & microphone active — streaming in background",
      importance: 'high',
    });

    return () => {
      ReactNativeForegroundService.stopAll();
    };
  }, []);

  const getGridStyle = (count: number): any => {
    if (count === 0 || count === 1) return { width: '100%', height: '100%' };
    if (count === 2) return { width: '100%', height: '49%' };
    if (count === 3 || count === 4) return { width: '49%', height: '49%' };
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
            <View className="flex-1 rounded-2xl overflow-hidden bg-black border border-white/10">
              {presenter.isLocal ? (
                <View className="flex-1 items-center justify-center p-6 bg-[#121214]">
                  <MonitorUp size={48} color="#3B82F6" className="mb-4" />
                  <Text className="text-white text-xl font-bold text-center mb-2">You are presenting to everyone</Text>
                  <Text className="text-gray-400 text-sm text-center mb-6">Your screen is visible to all meeting participants in 1080p @ 30 FPS.</Text>
                  <Pressable
                    onPress={async () => {
                      try { await localParticipant?.setScreenShareEnabled(false); } catch (e) {}
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
  const participantState = useParticipant(participant);
  const isSpeaking = participantState.isSpeaking;
  const isCameraMuted = !participantState.cameraPublication || participantState.cameraPublication.isMuted;
  
  const trackRef = participantState.cameraPublication ? {
    participant,
    source: Track.Source.Camera,
    publication: participantState.cameraPublication,
    track: participantState.cameraPublication.track
  } : null;

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
      {isCameraMuted || !trackRef ? (
        <View className="flex-1 items-center justify-center bg-[#18181B]">
          <View className="w-16 h-16 rounded-full bg-[#27272A] items-center justify-center">
            <Text className="text-white text-xl font-bold">
              {(participant.name || participant.identity || '?').charAt(0).toUpperCase()}
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
});
