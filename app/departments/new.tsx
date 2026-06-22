import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PremiumInput } from '@/components/ui/premium-input';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumSelect } from '@/components/ui/premium-select';
import { hasPermission } from '@/lib/permissions';

export default function NewDepartmentScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#1F6FEB');
  const [headUserId, setHeadUserId] = useState('');
  const [users, setUsers] = useState<{ label: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch all users in organization to select lead
  useEffect(() => {
    const fetchOrgUsers = async () => {
      if (!user?.organizationId) { return; }
      try {
        const { data, error } = await supabase
          .from('user_organizations')
          .select(`
            user:user_id (
              id,
              full_name,
              email
            )
          `)
          .eq('org_id', user.organizationId);

        if (error) throw error;

        const options = (data || [])
          .filter(u => u.user)
          .map((u: any) => ({
            label: u.user.full_name || u.user.email,
            value: u.user.id,
          }));

        setUsers(options);
      } catch (e) {
        console.error('Error fetching users:', e);
      }
    };

    fetchOrgUsers();
  }, [user?.organizationId]);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a department name.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .insert({
          org_id: user?.organizationId,
          name: name.trim(),
          description: description.trim() || null,
          color,
          head_user_id: headUserId || null,
        });

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        org_id: user?.organizationId,
        actor_id: user?.id,
        action: 'department_created',
        entity_type: 'department',
        new_value: { name: name.trim() },
      });

      Alert.alert('Success', 'Department created successfully.');
      router.back();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const colorsList = [
    '#1F6FEB', // Blue
    '#238636', // Green
    '#D29922', // Orange/Yellow
    '#DA3633', // Red
    '#8957E5', // Purple
    '#DB61A2', // Pink
    '#30B0C7', // Teal
    '#484848', // Gray
  ];

  if (!hasPermission(user?.role, 'manage_departments')) {
    return (
      <ScreenContainer style={styles.center}>
        <Ionicons name="lock-closed" size={48} color={colors.error} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.foreground }]}>Access Denied</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Only Owners or Administrators can create departments.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Department</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <PremiumInput
          label="Department Name"
          placeholder="e.g. Engineering, Marketing..."
          value={name}
          onChangeText={setName}
          editable={!saving}
        />

        <PremiumInput
          label="Description"
          placeholder="e.g. Building core flow systems..."
          value={description}
          onChangeText={setDescription}
          editable={!saving}
          multiline
          numberOfLines={3}
        />

        {/* Color picker */}
        <View style={styles.pickerSection}>
          <Text style={[styles.pickerLabel, { color: colors.foreground }]}>Theme Color</Text>
          <View style={styles.colorPalette}>
            {colorsList.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorBox,
                  { backgroundColor: c },
                  color === c && { borderColor: colors.foreground, borderWidth: 3 }
                ]}
              />
            ))}
          </View>
        </View>

        <PremiumSelect
          label="Department Lead (Optional)"
          options={users}
          value={headUserId}
          onSelect={setHeadUserId}
          placeholder="Select a department head..."
        />

        <PremiumButton
          variant="primary"
          size="lg"
          onPress={handleCreate}
          loading={saving}
          disabled={saving}
          style={{ marginTop: 24 }}
        >
          Create Department
        </PremiumButton>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
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
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  pickerSection: {
    marginBottom: 20,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  colorBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
});

