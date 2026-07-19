import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function MeetingsDashboard() {
  const router = useRouter();
  const { session } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Meetings Dashboard</Text>
      
      <Pressable 
        style={styles.button}
        onPress={() => router.push('/meetings/pre-join')}
      >
        <Text style={styles.buttonText}>Start a New Meeting</Text>
      </Pressable>

      <Text style={styles.subtext}>Upcoming Meetings (Placeholder)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subtext: {
    color: '#9CA3AF',
  }
});
