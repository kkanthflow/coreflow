import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RoleBadge } from '@/components/ui/role-badge';
import { getRoleColor } from '@/lib/_core/theme';
import { useThemeContext } from '@/lib/theme-provider';

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department?: string;
  avatar_url?: string;
}

export default function HierarchyScreen() {
  const colors = useColors();
  const { colorScheme } = useThemeContext();
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Expanded departments state
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    'Executive': true,
    'Technology': true,
    'Product Management': true,
    'Human Resources': true,
    'Unassigned': true,
  });

  const fetchOrganizationMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!user?.organizationId) {
        // Fallback: load all users
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, role, department, avatar_url');
        if (data && !error) setMembers(data as Member[]);
        return;
      }

      // Load only members in the same org
      const { data, error } = await supabase
        .from('user_organizations')
        .select('users:users!user_organizations_user_id_fkey!inner(id, full_name, email, role, department, avatar_url)')
        .eq('org_id', user.organizationId);

      if (data && !error) {
        const list = data.map((d: any) => d.users).filter(Boolean);
        setMembers(list as Member[]);
      }
    } catch (e) {
      console.error('Error fetching org hierarchy:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      fetchOrganizationMembers();
    });
    return () => cancelAnimationFrame(frameId);
  }, [fetchOrganizationMembers]);

  const toggleDept = (deptName: string) => {
    setExpandedDepts(prev => ({
      ...prev,
      [deptName]: !prev[deptName],
    }));
  };

  const getDepartmentGroups = () => {
    const groups: Record<string, Member[]> = {
      'Leadership': [],
      'Management': [],
      'Team Leads': [],
      'Staff': [],
      'External': [],
    };

    members.forEach(member => {
      const role = member.role;

      if (role === 'owner' || role === 'administrator' || role === 'director'
        || role === 'managing_director' || role === 'ceo' || role === 'cto') {
        groups['Leadership'].push(member);
      } else if (role === 'senior_manager' || role === 'manager' || role === 'project_manager' || role === 'hr') {
        groups['Management'].push(member);
      } else if (role === 'team_lead') {
        groups['Team Leads'].push(member);
      } else if (role === 'senior_employee' || role === 'employee' || role === 'intern'
        || role === 'developer' || role === 'general_member') {
        groups['Staff'].push(member);
      } else {
        groups['External'].push(member);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) delete groups[key];
    });

    // Sort within groups by name
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    });

    return groups;
  };

  const departments = getDepartmentGroups();

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-4 flex-row items-center">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">Organization Hierarchy</Text>
        </View>

        {isLoading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-sm text-muted mt-4">Loading organization chart...</Text>
          </View>
        ) : members.length === 0 ? (
          <View className="py-20 items-center justify-center px-6">
            <Ionicons name="git-network-outline" size={48} color={colors.muted} className="mb-4" />
            <Text className="text-lg font-bold text-foreground mb-1">No Members Found</Text>
            <Text className="text-sm text-muted text-center">There are no accounts registered in the workspace.</Text>
          </View>
        ) : (
          <View className="px-6 pb-12 mt-2">
            <Text className="text-sm text-muted mb-6">
              View the structural tree and reporting flow of all departments. Click on any member to view their complete profile.
            </Text>

            {Object.keys(departments).map((deptName) => {
              const isExpanded = expandedDepts[deptName] !== false;
              const deptMembers = departments[deptName];

              return (
                <View key={deptName} className="mb-5">
                  {/* Department Accordion Header */}
                  <Pressable
                    onPress={() => toggleDept(deptName)}
                    className="flex-row items-center justify-between p-4 rounded-xl border border-border"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <View className="flex-row items-center">
                      <Ionicons 
                        name={deptName === 'Executive' ? 'briefcase' : deptName === 'Technology' ? 'code-working' : 'people'} 
                        size={20} 
                        color={colors.primary} 
                        className="mr-3"
                      />
                      <Text className="text-base font-bold text-foreground">{deptName}</Text>
                      <View className="ml-2 px-2 py-0.5 rounded-full bg-primary/10">
                        <Text className="text-xs font-semibold text-primary">{deptMembers.length}</Text>
                      </View>
                    </View>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={18} 
                      color={colors.muted} 
                    />
                  </Pressable>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <View className="mt-3 pl-4 border-l-2 ml-6 border-primary/20 gap-3">
                      {deptMembers.map((member) => {
                        const roleColor = getRoleColor(member.role as any, colorScheme);
                        return (
                          <Pressable
                            key={member.id}
                            onPress={() => router.push(`/team/${member.id}` as any)}
                            className="flex-row items-center p-3 rounded-xl border border-border"
                            style={{ 
                              backgroundColor: colors.surface,
                              borderLeftWidth: 4,
                              borderLeftColor: roleColor
                            }}
                          >
                            <View 
                              className="w-10 h-10 rounded-full items-center justify-center mr-3"
                              style={{ backgroundColor: `${roleColor}15` }}
                            >
                              <Text className="font-bold text-base" style={{ color: roleColor }}>
                                {(member.full_name.charAt(0) || '?').toUpperCase()}
                              </Text>
                            </View>
                            <View className="flex-1 mr-2">
                              <Text className="text-sm font-bold text-foreground mb-1">
                                {member.full_name}
                              </Text>
                              <RoleBadge role={member.role as any} size="sm" />
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
