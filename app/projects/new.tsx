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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hasPermission } from '@/lib/permissions';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumInput } from '@/components/ui/premium-input';
import { PremiumSelect } from '@/components/ui/premium-select';
import { DatePicker } from '@/components/ui/date-picker';

export default function NewProjectScreen() {
  const { user } = useAuth();
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
  const [departmentId, setDepartmentId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const canCreate = hasPermission(user?.role, 'create_projects');

  useEffect(() => {
    if (!canCreate) {
      Alert.alert('Permission Denied', 'You do not have permission to create projects.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    if (user?.organizationId) {
      // Fetch departments
      supabase
        .from('departments')
        .select('id, name')
        .eq('org_id', user.organizationId)
        .then(({ data }) => {
          if (data) setDepartments(data);
        });

      // Fetch organization users
      supabase
        .from('user_organizations')
        .select(`
          user_id,
          users (
            id,
            full_name
          )
        `)
        .eq('org_id', user.organizationId)
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
  }, [user, canCreate]);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Project title is required.');
      return;
    }
    if (!user?.organizationId) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          org_id: user.organizationId,
          department_id: departmentId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          owner_id: ownerId || undefined,
          due_date: dueDate.toISOString().split('T')[0],
          start_date: startDate.toISOString().split('T')[0],
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Add the creator as the first project member automatically as owner/manager
      if (data?.id && user?.id) {
        await supabase.from('project_members').insert({
          project_id: data.id,
          user_id: user.id,
          role: 'owner',
          added_by: user.id,
        });
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
});
