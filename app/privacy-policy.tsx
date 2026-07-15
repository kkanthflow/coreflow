import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const colors = useColors();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate/perform network request to fetch policy. If offline, fall back directly.
      // We wait 500ms to ensure visual loading feedback works.
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e) {
      setError('Failed to load the latest policy version. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy Policy</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
          <Pressable
            onPress={fetchPolicy}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { color: colors.foreground }]}>Privacy Policy</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Last Updated: June 25, 2026</Text>

          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Welcome to CoreFlow. We are committed to protecting your personal and organizational data. This Privacy Policy explains how we collect, use, store, and share your information when you use our mobile application (CoreFlow) and the associated backend APIs and systems.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>1. Information We Collect</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            We collect several types of data depending on your interactions with the Services:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>User Profile:</Text> Email address, full name, phone number, bio, job title, location, LinkedIn URL, and avatar images.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>Organization Info:</Text> Name, description, industry, website, size category, and logo URL.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>Financial Data:</Text> Clients, invoices, items, rates, taxes, currencies, payments, and receipts.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>Departments & Employees:</Text> Structure, color, lead user, and reassignments.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>Chat Metadata:</Text> Chat channels, memberships, mutes, read receipts, and E2EE keys.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>Voice Messages:</Text> Audio recording files captured by the microphone, transient local device cache files, and transcripts or files stored in organization cloud storage buckets.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>Push Notifications:</Text> Unique hardware and installation device IDs, operating system platforms, last seen timestamps, app versions, and Firebase Cloud Messaging (FCM) push tokens.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• <Text style={{ fontWeight: 'bold' }}>Workspace Audit Logs:</Text> Event activity (e.g. role changes, department deletions) with actor IDs.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>2. How We Use Your Information</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            CoreFlow uses your data for the following essential business purposes:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• To operate and manage accounts, invoices, and projects.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• For security monitoring, access validation, and preventing abuse.</Text>
            <Text style={[styles.bulletPoint, { color: colors.foreground }]}>• Compliance requirements, audit records, and tax calculations.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>3. Data Ownership</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            All organization-owned data remains the property of the organization. CoreFlow acts as a service provider and processor under the direction of the Organization Owner.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>4. End-to-End Encryption</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Chat messages are protected using end-to-end encryption (E2EE). CoreFlow does not hold the private keys required to decrypt message content. Users are solely responsible for safeguarding their local encryption keys. No transmission is absolutely guaranteed to be secure.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>5. Audit Logging</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            We maintain structural logs in activity_logs (visible to workspace owners and admins) tracking modifications, role updates, and department deletions to prevent orphaned records.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>6. Contact Information</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            If you have questions about this policy, please contact our team at support@coreflow.app.
          </Text>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: '300',
  },
  bulletList: {
    paddingLeft: 12,
    marginBottom: 16,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '300',
  },
});
