import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hasPermission } from '@/lib/permissions';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumInput } from '@/components/ui/premium-input';
import { PremiumSelect } from '@/components/ui/premium-select';
import { DatePicker } from '@/components/ui/date-picker';

export default function NewProjectScreen() {
  const { user, activeWorkspace, hasWorkspacePermission } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('planning');
  const [startDate, setStartDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30); // Default to 30 days from now
    return d;
  });
  const params = useLocalSearchParams();
  const [departmentId, setDepartmentId] = useState((params?.deptId as string) || '');
  const [ownerId, setOwnerId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isIndie = activeWorkspace?.type === 'independent';
  const canCreate = isIndie || hasWorkspacePermission('project.create') || hasPermission(user, 'create_projects');

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Permission Denied', 'You do not have permission to create projects.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    const activeOrgId = isIndie ? null : (activeWorkspace?.id === 'independent' ? null : activeWorkspace?.id) || user?.organizationId || null;

    if (activeOrgId) {
      // Fetch departments
      supabase
        .from('departments')
        .select('id, name')
        .eq('org_id', activeOrgId)
        .eq('is_deleted', false)
        .then(({ data }) => {
          if (data) setDepartments(data);
        });

      // Fetch organization users
      supabase
        .from('user_organizations')
        .select(`
          user_id,
          users:user_id (
            id,
            full_name
          )
        `)
        .eq('org_id', activeOrgId)
        .then(({ data }) => {
          if (data) {
            const list = data
              .map((d: any) => d.users)
              .filter(Boolean);
            setOrgUsers(list);
            // Default project owner to the creator
            if (user?.id) {
              setOwnerId(user.id);
            }
          }
        });
    }
  }, [user, activeWorkspace, canCreate]);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Project title is required.');
      return;
    }

    const activeOrgId = isIndie ? null : (activeWorkspace?.id === 'independent' ? null : activeWorkspace?.id) || user?.organizationId || null;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          org_id: activeOrgId,
          department_id: departmentId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          owner_id: ownerId || undefined,
          due_date: dueDate.toISOString().split('T')[0],
          start_date: startDate.toISOString().split('T')[0],
          created_by: user?.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Add the project members
      if (data?.id) {
        const memberInserts = [];
        
        // Always add the owner/creator as owner
        if (ownerId) {
          memberInserts.push({
            project_id: data.id,
            user_id: ownerId,
            role: 'owner',
            added_by: user?.id,
          });
        } else if (user?.id) {
          memberInserts.push({
            project_id: data.id,
            user_id: user.id,
            role: 'owner',
            added_by: user.id,
          });
        }

        // Add other selected members
        selectedMemberIds.forEach(memberId => {
          if (memberId !== ownerId && memberId !== user?.id) {
            memberInserts.push({
              project_id: data.id,
              user_id: memberId,
              role: 'member',
              added_by: user?.id,
            });
          }
        });

        if (memberInserts.length > 0) {
          await supabase.from('project_members').insert(memberInserts);
        }
      }

      router.back();
    } catch (e: any) {
      Alert.alert('Error Creating Project', e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const departmentOptions = [
    { label: 'None', value: '' },
    ...departments.map(d => ({ label: d.name, value: d.id }))
  ];

  const userOptions = [
    { label: 'Unassigned', value: '' },
    ...orgUsers.map(u => ({ label: u.full_name, value: u.id }))
  ];

  return (
    <ScreenContainer>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Create Project</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Project Form fields */}
        <View style={styles.section}>
          <PremiumInput
            label="Project Title *"
            placeholder="Enter project title"
            value={title}
            onChangeText={setTitle}
            editable={!loading}
          />
        </View>

        <View style={styles.section}>
          <PremiumInput
            label="Description"
            placeholder="Enter project description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            editable={!loading}
            inputClassName="h-24 py-2"
          />
        </View>

        {/* Priority Grid */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Priority</Text>
          <View style={styles.badgeGrid}>
            {['low', 'medium', 'high', 'critical'].map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                style={[
                  styles.badgeBtn,
                  {
                    borderColor: priority === p ? colors.primary : colors.border,
                    backgroundColor: priority === p ? `${colors.primary}12` : colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeBtnText,
                    {
                      color: priority === p ? colors.primary : colors.muted,
                      fontWeight: priority === p ? '700' : '500',
                    },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Status Grid */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Status</Text>
          <View style={styles.badgeGrid}>
            {['planning', 'active', 'on_hold', 'review'].map((s) => (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={[
                  styles.badgeBtn,
                  {
                    borderColor: status === s ? colors.primary : colors.border,
                    backgroundColor: status === s ? `${colors.primary}12` : colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeBtnText,
                    {
                      color: status === s ? colors.primary : colors.muted,
                      fontWeight: status === s ? '700' : '500',
                    },
                  ]}
                >
                  {s.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Start / Due Dates */}
        <View style={styles.row}>
          <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Start Date</Text>
            <DatePicker value={startDate} onChange={setStartDate} />
          </View>

          <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Due Date</Text>
            <DatePicker value={dueDate} onChange={setDueDate} />
          </View>
        </View>

        {/* Department Selection */}
        <PremiumSelect
          label="Department"
          value={departmentId}
          options={departmentOptions}
          onSelect={setDepartmentId}
          placeholder="Select department"
          disabled={loading}
        />

        {/* Owner Selection */}
        <PremiumSelect
          label="Project Owner"
          value={ownerId}
          options={userOptions}
          onSelect={setOwnerId}
          placeholder="Select project owner"
          disabled={loading}
        />

        {/* Project Members Selection */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground, marginBottom: 8 }]}>Assign Team Members</Text>
          <View style={[styles.membersListContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
              {orgUsers.map((u, index) => {
                // Skip rendering owner in list of extra members
                if (u.id === ownerId) return null;
                
                const isSelected = selectedMemberIds.includes(u.id);
                const isLast = index === orgUsers.length - 1;
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedMemberIds(prev => prev.filter(id => id !== u.id));
                      } else {
                        setSelectedMemberIds(prev => [...prev, u.id]);
                      }
                    }}
                    style={[
                      styles.memberCheckItem,
                      { 
                        borderBottomColor: colors.border,
                        borderBottomWidth: isLast ? 0 : 1 
                      }
                    ]}
                  >
                    <View style={styles.memberCheckRow}>
                      <Ionicons 
                        name={isSelected ? "checkbox" : "square-outline"} 
                        size={20} 
                        color={isSelected ? colors.primary : colors.muted} 
                        style={{ marginRight: 10 }}
                      />
                      <Text style={[styles.memberCheckText, { color: colors.foreground }]}>
                        {u.full_name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Create Button */}
        <View style={{ marginTop: 24, marginBottom: 40 }}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <PremiumButton variant="primary" size="lg" onPress={handleCreate}>
              Create Project
            </PremiumButton>
          )}
        </View>
      </ScrollView>
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
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  section: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeBtn: {
    flex: 1,
    minWidth: 70,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeBtnText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  membersListContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    maxHeight: 210,
    overflow: 'hidden',
  },
  memberCheckItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  memberCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCheckText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

