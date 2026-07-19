import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitRoom, useRoomContext, VideoTrack, AudioTrack, useParticipantTracks, useLocalParticipant, useTracks, useDataChannel } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';

// In a real app, this would be fetched from your backend endpoint: /api/meetings/:id/join
const getLiveKitToken = async (roomId: string, token: string) => {
  return 'dummy_token';
};

export default function MeetingRoomScreen() {
  const { id, camera, mic } = useLocalSearchParams();
  const { session } = useAuth();
  
  const [token, setToken] = useState<string | null>(null);
  const serverUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://dummy.livekit.cloud';

  useEffect(() => {
    async function connect() {
      if (!session?.access_token) return;
      try {
        const tk = await getLiveKitToken(id as string, session.access_token);
        setToken(tk);
      } catch (e) {
        console.error(e);
      }
    }
    connect();
  }, [id, session]);

  if (!token) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Connecting to secure room...</Text>
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
    >
      <MeetingUI />
    </LiveKitRoom>
  );
}

function MeetingUI() {
  const room = useRoomContext();
  const router = useRouter();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleLeave = () => {
    room.disconnect();
    router.replace('/meetings' as any);
  };

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
  };

  const toggleCamera = () => {
    localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
  };

  const toggleScreenShare = () => {
    localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled);
  };

  return (
    <View style={styles.roomContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>CoreFlow Meeting</Text>
        <Text style={styles.subtitle}>{room.name}</Text>
      </View>
      
      <View style={styles.mainContent}>
        {/* Video Grid */}
        <View style={styles.videoGrid}>
          {tracks.length === 0 ? (
            <View style={styles.placeholderVideo}>
              <Ionicons name="person" size={64} color="#374151" />
              <Text style={styles.participantName}>Waiting for others to join...</Text>
            </View>
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={(item) => item.participant.identity + item.source}
              renderItem={({ item }) => (
                <View style={styles.videoWrapper}>
                   <VideoTrack trackRef={item} style={styles.videoElement} />
                   <Text style={styles.videoLabel}>{item.participant.name || item.participant.identity}</Text>
                </View>
              )}
            />
          )}
        </View>

        {/* Chat Sidebar Overlay */}
        {isChatOpen && (
          <View style={styles.chatOverlay}>
             <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>In-Meeting Chat</Text>
                <Pressable onPress={() => setIsChatOpen(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
             </View>
             <ChatComponent />
          </View>
        )}
      </View>

      <View style={styles.controlsBar}>
        <Pressable style={[styles.controlBtn, !localParticipant.isMicrophoneEnabled && styles.controlBtnOff]} onPress={toggleMic}>
          <Ionicons name={localParticipant.isMicrophoneEnabled ? "mic" : "mic-off"} size={24} color="#fff" />
        </Pressable>
        <Pressable style={[styles.controlBtn, !localParticipant.isCameraEnabled && styles.controlBtnOff]} onPress={toggleCamera}>
          <Ionicons name={localParticipant.isCameraEnabled ? "videocam" : "videocam-off"} size={24} color="#fff" />
        </Pressable>
        <Pressable style={[styles.controlBtn, !localParticipant.isScreenShareEnabled && styles.controlBtnOff]} onPress={toggleScreenShare}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </Pressable>
        <Pressable style={[styles.controlBtn, isChatOpen && styles.controlBtnActive]} onPress={() => setIsChatOpen(!isChatOpen)}>
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
        </Pressable>
        <Pressable style={[styles.controlBtn, styles.leaveBtn]} onPress={handleLeave}>
          <Ionicons name="call" size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function ChatComponent() {
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  const [inputText, setInputText] = useState('');
  const { send } = useDataChannel('chat', (msg) => {
    const decoder = new TextDecoder();
    const text = decoder.decode(msg.payload);
    setMessages(prev => [...prev, { sender: msg.participant?.name || 'Unknown', text }]);
  });

  const handleSend = () => {
    if (!inputText.trim()) return;
    const encoder = new TextEncoder();
    send(encoder.encode(inputText.trim()), { reliable: true });
    setMessages(prev => [...prev, { sender: 'You', text: inputText.trim() }]);
    setInputText('');
  };

  return (
    <View style={styles.chatContainer}>
      <FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.chatMsg}>
            <Text style={styles.chatSender}>{item.sender}</Text>
            <Text style={styles.chatText}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          value={inputText}
          onChangeText={setInputText}
        />
        <Pressable onPress={handleSend} style={styles.chatSendBtn}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
  },
  roomContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  videoGrid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: 120,
  },
  placeholderVideo: {
    width: '100%',
    aspectRatio: 3/4,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantName: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
  },
  videoWrapper: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  videoElement: {
    flex: 1,
  },
  videoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
  },
  chatOverlay: {
    width: 300,
    backgroundColor: '#1F2937',
    borderLeftWidth: 1,
    borderColor: '#374151',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderColor: '#374151',
  },
  chatTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  chatMsg: {
    marginBottom: 12,
  },
  chatSender: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  chatText: {
    color: '#fff',
    fontSize: 14,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  chatSendBtn: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.8)',
    gap: 16,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnOff: {
    backgroundColor: '#4B5563',
  },
  controlBtnActive: {
    backgroundColor: '#2563EB',
  },
  leaveBtn: {
    backgroundColor: '#EF4444',
  }
});
