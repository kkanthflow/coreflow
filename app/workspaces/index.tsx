import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function WorkspacesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, activeWorkspace, availableWorkspaces, switchWorkspace, refreshUser } = useAuth();
  
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === activeWorkspace?.id) return;
    setIsSwitching(workspaceId);
    try {
      await switchWorkspace(workspaceId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to switch workspace');
    } finally {
      setIsSwitching(null);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      Alert.alert('Validation Error', 'Organization name is required');
      return;
    }

    if (!user) return;

    setIsCreating(true);
    try {
      // 1. Insert organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([{ name: newOrgName.trim() }])
        .select('id')
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error('Failed to create organization');

      // 2. Add user as owner
      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert([{
          user_id: user.id,
          organization_id: orgData.id,
          role: 'owner',
        }]);

      if (memberError) throw memberError;

      // Refresh workspaces
      await refreshUser();
      setShowCreateModal(false);
      setNewOrgName('');
      Alert.alert('Success', 'Organization created successfully!');
      
      // Auto switch
      await switchWorkspace(orgData.id);

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create organization');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Workspaces</Text>
        <Pressable onPress={() => setShowCreateModal(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {availableWorkspaces.map((ws) => {
          const isActive = ws.id === activeWorkspace?.id;
          
          return (
            <Pressable key={ws.id} onPress={() => handleSwitch(ws.id)} disabled={isSwitching !== null}>
              <GlassCard style={isActive ? { ...styles.workspaceCard, borderColor: colors.primary, borderWidth: 1 } : styles.workspaceCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}20` }]}>
                    <Ionicons 
                      name={ws.type === 'independent' ? 'person' : 'business'} 
                      size={20} 
                      color={colors.primary} 
                    />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={[styles.wsName, { color: colors.foreground }]} numberOfLines={1}>
                      {ws.name}
                    </Text>
                    <View style={styles.rolesContainer}>
                      {ws.roles.map((role, idx) => (
                        <View key={idx} style={[styles.roleBadge, { backgroundColor: colors.border }]}>
                          <Text style={[styles.roleText, { color: colors.secondary_text }]}>
                            {role.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  
                  {isSwitching === ws.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : isActive ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  )}
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
        
        {availableWorkspaces.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            You don't belong to any workspaces yet.
          </Text>
        )}
      </ScrollView>

      {/* Create Workspace Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent={true} onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create New Workspace</Text>
            
            <Text style={[styles.inputLabel, { color: colors.secondary_text }]}>Organization Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. Acme Corp"
              placeholderTextColor={colors.muted}
              value={newOrgName}
              onChangeText={setNewOrgName}
              autoFocus
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setShowCreateModal(false)} disabled={isCreating}>
                <Text style={{ color: colors.muted, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.submitButton, { backgroundColor: colors.primary }]} 
                onPress={handleCreateOrganization}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create</Text>
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
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  addButton: {
    padding: 8,
    marginRight: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  workspaceCard: {
    padding: 16,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  wsName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    minWidth: 100,
    alignItems: 'center',
  }
});
