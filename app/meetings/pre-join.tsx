import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';

export default function PreJoinScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  
  const [meetingId, setMeetingId] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const handleJoin = () => {
    if (!meetingId.trim()) return;
    
    // In a real flow, we'd validate the meeting ID via our backend,
    // get a LiveKit token, and then pass it to the room.
    router.push({
      pathname: '/meetings/room' as any,
      params: { 
        id: meetingId, 
        camera: cameraEnabled ? '1' : '0', 
        mic: micEnabled ? '1' : '0' 
      }
    });
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      <Text style={styles.title}>Join a Meeting</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Meeting ID or Link</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. cf-meeting-8d72af93"
          placeholderTextColor="#6b7280"
          value={meetingId}
          onChangeText={setMeetingId}
          autoCapitalize="none"
        />

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Ionicons name={cameraEnabled ? "videocam" : "videocam-off"} size={20} color="#fff" style={styles.icon} />
            <Text style={styles.settingLabel}>Turn on camera</Text>
          </View>
          <Switch 
            value={cameraEnabled} 
            onValueChange={setCameraEnabled}
            trackColor={{ false: '#374151', true: '#2563EB' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Ionicons name={micEnabled ? "mic" : "mic-off"} size={20} color="#fff" style={styles.icon} />
            <Text style={styles.settingLabel}>Turn on microphone</Text>
          </View>
          <Switch 
            value={micEnabled} 
            onValueChange={setMicEnabled}
            trackColor={{ false: '#374151', true: '#2563EB' }}
          />
        </View>
      </View>

      <Pressable 
        style={[styles.joinBtn, !meetingId.trim() && styles.joinBtnDisabled]}
        onPress={handleJoin}
        disabled={!meetingId.trim()}
      >
        <Text style={styles.joinBtnText}>Join Meeting</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
    paddingTop: 60,
  },
  backBtn: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1F2937',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  joinBtn: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinBtnDisabled: {
    backgroundColor: '#374151',
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
