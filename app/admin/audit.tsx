import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hasPermission } from '@/lib/permissions';
import { safeFormatDistanceToNow } from '@/lib/utils';

export default function AuditLogScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'project' | 'task' | 'file' | 'user'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuditLogs = useCallback(async () => {
    if (!user?.organizationId) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select(`
          id,
          action,
          entity_type,
          entity_id,
          old_value,
          new_value,
          created_at,
          actor:actor_id (
            full_name,
            email
          )
        `)
        .eq('org_id', user.organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (activeTab !== 'all') {
        query = query.eq('entity_type', activeTab);
      }

      const { data, error } = await query;
      if (data && !error) {
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, activeTab]);

  useEffect(() => {
    if (user) {
      fetchAuditLogs();
    }
  }, [user, fetchAuditLogs, activeTab]);

  const canViewAuditLog = hasPermission(user?.role, 'view_audit_logs');

  if (!canViewAuditLog) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <Ionicons name="lock-closed" size={48} color={colors.error} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.foreground }]}>Access Denied</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>You do not have permission to view the audit logs.</Text>
      </ScreenContainer>
    );
  }

  const formatLogMessage = (item: any) => {
    const actor = item.actor?.full_name || 'System';
    switch (item.action) {
      case 'role_changed':
        return `${actor} changed role of ${item.new_value?.user_name || 'user'} to "${item.new_value?.role}"`;
      case 'project_created':
        return `${actor} created project "${item.new_value?.title || 'Unknown'}"`;
      case 'project_deleted':
        return `${actor} deleted project "${item.new_value?.title || 'Unknown'}"`;
      case 'task_created':
        return `${actor} created task "${item.new_value?.title || 'Unknown'}"`;
      case 'task_status_changed':
        return `${actor} changed task status for "${item.new_value?.title || 'Task'}" to "${item.new_value?.status}"`;
      case 'file_uploaded':
        return `${actor} uploaded file "${item.new_value?.file_name}"`;
      case 'file_deleted':
        return `${actor} deleted file "${item.new_value?.file_name}"`;
      default:
        return `${actor} performed action "${item.action.replace('_', ' ')}" on ${item.entity_type}`;
    }
  };

  const getEntityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'project':
        return 'briefcase-outline';
      case 'task':
        return 'checkbox-outline';
      case 'file':
        return 'document-attach-outline';
      case 'user':
        return 'person-outline';
      default:
        return 'finger-print-outline';
    }
  };

  const tabs: { label: string; value: typeof activeTab }[] = [
    { label: 'All', value: 'all' },
    { label: 'Projects', value: 'project' },
    { label: 'Tasks', value: 'task' },
    { label: 'Files', value: 'file' },
    { label: 'Users', value: 'user' },
  ];

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Audit logs</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => setActiveTab(tab.value)}
            style={[
              styles.tabBtn,
              activeTab === tab.value && { backgroundColor: colors.primary },
              { borderColor: colors.border }
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.value ? '#FFFFFF' : colors.foreground }
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View 
              style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.logHeader}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}12` }]}>
                  <Ionicons name={getEntityIcon(item.entity_type)} size={18} color={colors.primary} />
                </View>
                <View style={styles.logMeta}>
                  <Text style={[styles.logMsg, { color: colors.foreground }]}>
                    {formatLogMessage(item)}
                  </Text>
                  <Text style={[styles.logTime, { color: colors.muted }]}>
                    {safeFormatDistanceToNow(item.created_at, { addSuffix: true })}
                  </Text>
                </View>
              </View>
              
              {item.actor?.email && (
                <View style={[styles.logFooter, { borderTopColor: colors.border }]}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.success} style={{ marginRight: 4 }} />
                  <Text style={[styles.actorText, { color: colors.muted }]}>
                    Actor: <Text style={{ fontWeight: '700', color: colors.foreground }}>{item.actor.email}</Text>
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No activity logs found</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logMeta: {
    flex: 1,
  },
  logMsg: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  logTime: {
    fontSize: 11,
    marginTop: 4,
  },
  logFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actorText: {
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
