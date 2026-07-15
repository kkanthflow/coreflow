import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';

export default function TermsAndConditionsScreen() {
  const router = useRouter();
  const colors = useColors();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate/perform network request.
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e) {
      setError('Failed to load terms and conditions. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Terms & Conditions</Text>
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
            onPress={fetchTerms}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { color: colors.foreground }]}>Terms of Service</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Last Updated: June 25, 2026</Text>

          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Please read these Terms of Service ("Terms") carefully before using the CoreFlow mobile application and any backend systems, tools, or APIs provided by CoreFlow (collectively, the "Services").
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            By accessing or using our Services, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you must immediately uninstall the app and discontinue any use of the Services.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>2. User Responsibilities & Account Security</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            You are responsible for maintaining the confidentiality of your account credentials, OAuth tokens, and safeguarding the cryptographic keys used for end-to-end encrypted chats. CoreFlow does not hold copy recovery phrases for your local storage keys.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>3. Organization Administration</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Organization Owners and Super Administrators possess ultimate control within their workspaces, including assigning user roles, permissions, department lists, and employee groups.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>4. Department Deletion & Reassignment Rules</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Before a department is soft-deleted, administrators must reassign active employees and projects to an alternative department. Workspace administrators assume full liability for the outcome of these reassignment decisions.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>5. Acceptable Use Policy</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            You agree not to upload illegal or malicious content, attempt to bypass Supabase database Row-Level Security (RLS), launch denial-of-service attacks, or reverse-engineer the CoreFlow mobile application.
          </Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            By using Voice Messages, you authorize the app to access your device microphone to capture audio and store recordings in your workspace storage. Users assume full liability for the content of voice recordings. By enabling Push Notifications, you agree to receive automated notifications dispatched via Firebase Cloud Messaging based on your organization configurations.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>6. Subscription & Billing Terms</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Paid plans automatically renew under subscription fee metrics. Fees are exclusive of taxes, and you are responsible for paying all applicable fees and taxes.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>7. Multi-Currency Disclaimer</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Multi-currency tracking and conversion features are provided for operational dashboarding convenience and do not constitute official legal, financial, or tax advisory information.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>8. Limitation of Liability</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            CoreFlow shall not be liable for any indirect, incidental, special, or consequential damages resulting from data loss, server interruptions, or unauthorized database access.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.primary }]}>9. Governing Law</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            These Terms shall be governed by and construed in accordance with the laws of Delaware, United States, without regard to conflict of laws.
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
});
