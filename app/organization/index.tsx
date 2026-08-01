import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function OrganizationScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, activeWorkspace } = useAuth();
  
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Invite Member state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (activeWorkspace?.id && activeWorkspace.type !== 'independent') {
      fetchMembers();
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  const fetchMembers = async () => {
    if (!activeWorkspace?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          role,
          users (
            id,
            name,
            email,
            avatar_url,
            job_title
          )
        `)
        .eq('organization_id', activeWorkspace.id);

      if (error) throw error;
      
      const formattedMembers = data?.map((item: any) => ({
        role: item.role,
        ...item.users
      })) || [];
      
      setMembers(formattedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Validation Error', 'Email is required');
      return;
    }
    if (!activeWorkspace?.id) return;

    setIsInviting(true);
    try {
      // 1. Find user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single();

      if (userError || !userData) {
        throw new Error('User not found. They must sign up for the app first.');
      }

      // 2. Add user to organization
      const { error: inviteError } = await supabase
        .from('user_organizations')
        .insert([{
          user_id: userData.id,
          organization_id: activeWorkspace.id,
          role: 'employee',
        }]);

      if (inviteError) {
        if (inviteError.code === '23505') throw new Error('User is already in this organization');
        throw inviteError;
      }

      Alert.alert('Success', 'User added to organization!');
      setShowInviteModal(false);
      setInviteEmail('');
      fetchMembers();

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  if (activeWorkspace?.type === 'independent') {
    return (
      <ScreenContainer>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Team & Organization</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="person" size={64} color={colors.muted} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Independent Profile</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            You are currently using an independent workspace. Switch to an organization workspace to view team members.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>{activeWorkspace?.name || 'Organization'}</Text>
        <Pressable onPress={() => setShowInviteModal(true)} style={styles.addButton}>
          <Ionicons name="person-add" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Team Members ({members.length})</Text>
          
          {members.map((member) => (
            <GlassCard key={member.id} style={styles.memberCard}>
              <View style={styles.memberRow}>
                {member.avatar_url ? (
                  <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                    <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: 'bold' }}>
                      {member.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>{member.name || member.email}</Text>
                  {member.job_title && (
                    <Text style={[styles.memberTitle, { color: colors.secondary_text }]}>{member.job_title}</Text>
                  )}
                </View>

                <View style={[styles.roleBadge, { backgroundColor: `${colors.primary}20` }]}>
                  <Text style={[styles.roleText, { color: colors.primary }]}>
                    {member.role?.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}

      {/* Invite Member Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent={true} onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Invite Team Member</Text>
            
            <Text style={[styles.inputLabel, { color: colors.secondary_text }]}>User's Email Address</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              placeholder="email@example.com"
              placeholderTextColor={colors.muted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <Text style={[styles.helpText, { color: colors.muted }]}>
              The user must already have a Coreflow account.
            </Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setShowInviteModal(false)} disabled={isInviting}>
                <Text style={{ color: colors.muted, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.submitButton, { backgroundColor: colors.primary }]} 
                onPress={handleInviteMember}
                disabled={isInviting}
              >
                {isInviting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Invite</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8, marginLeft: -8 },
  addButton: { padding: 8, marginRight: -8 },
  title: { fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  memberCard: { padding: 16, borderRadius: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  memberTitle: { fontSize: 13 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 10, fontWeight: '700' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  inputLabel: { fontSize: 14, marginBottom: 8, fontWeight: '500' },
  textInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 8 },
  helpText: { fontSize: 13, marginBottom: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  submitButton: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center', minWidth: 100, alignItems: 'center' }
});
