import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert, Share } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hasPermission } from '@/lib/permissions';
import { safeFormatDistanceToNow } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';

export default function SecurityCenterScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'locks' | 'history' | 'events'>('locks');
  const [locks, setLocks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSecurityData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'locks') {
        const { data, error } = await supabase
          .from('rate_limit_locks')
          .select('*')
          .order('locked_until', { ascending: false });
        if (data && !error) setLocks(data);
      } else if (activeTab === 'history') {
        const { data, error } = await supabase
          .from('login_attempts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (data && !error) setHistory(data);
      } else if (activeTab === 'events') {
        const { data, error } = await supabase
          .from('security_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (data && !error) setEvents(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      fetchSecurityData();
    }
  }, [user, fetchSecurityData, activeTab]);

  const handleReleaseLock = async (lockId: string) => {
    try {
      const { error } = await supabase
        .from('rate_limit_locks')
        .delete()
        .eq('id', lockId);
      if (!error) {
        Alert.alert('Lock Released', 'The lock has been successfully removed.');
        fetchSecurityData();
      } else {
        Alert.alert('Error', 'Failed to release the lockout.');
      }
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const handleExportLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('login_attempts')
        .select('created_at, email, success, ip_address, platform, country, city, risk_score')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error || !data) {
        Alert.alert('Export Failed', 'Unable to retrieve login logs.');
        return;
      }

      const csvHeader = 'Timestamp,Email,Success,IP Address,Platform,Country,City,Risk Score\n';
      const csvRows = data.map(row => 
        `"${row.created_at}","${row.email}",${row.success},"${row.ip_address}","${row.platform || ''}","${row.country || ''}","${row.city || ''}",${row.risk_score}`
      ).join('\n');

      const csvContent = csvHeader + csvRows;

      await Share.share({
        message: csvContent,
        title: 'CoreFlow Security Log Export',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const isAdmin = ['managing_director', 'ceo', 'cto'].includes(user?.role || '');

  if (!isAdmin) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <Ionicons name="lock-closed" size={48} color={colors.error} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.foreground }]}>Access Denied</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>You do not have permission to view the Security Center.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Security Center</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Enterprise Threat & Rate Limiting Controls</Text>
        </View>
        <Pressable onPress={handleExportLogs} style={[styles.exportButton, { borderColor: colors.border }]}>
          <Ionicons name="download-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => setActiveTab('locks')}
          style={[styles.tab, activeTab === 'locks' && { borderBottomColor: colors.primary }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'locks' ? colors.primary : colors.muted }]}>Active Locks</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('history')}
          style={[styles.tab, activeTab === 'history' && { borderBottomColor: colors.primary }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'history' ? colors.primary : colors.muted }]}>Login History</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('events')}
          style={[styles.tab, activeTab === 'events' && { borderBottomColor: colors.primary }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'events' ? colors.primary : colors.muted }]}>Anomalies</Text>
        </Pressable>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'locks' ? locks : activeTab === 'history' ? history : events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          renderItem={({ item }) => {
            if (activeTab === 'locks') {
              return (
                <GlassCard style={{ marginBottom: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 15 }}>{item.target}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        Locked by: {item.type.toUpperCase()}
                      </Text>
                      <Text style={{ color: colors.error, fontSize: 12, marginTop: 2 }}>
                        Expires: {new Date(item.locked_until).toLocaleTimeString()} ({safeFormatDistanceToNow(new Date(item.locked_until))} remaining)
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleReleaseLock(item.id)}
                      style={[styles.actionBtn, { backgroundColor: `${colors.success}15` }]}
                    >
                      <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>Unlock</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              );
            } else if (activeTab === 'history') {
              return (
                <GlassCard style={{ marginBottom: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: '600' }}>{item.email}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        IP: {item.ip_address} • {item.platform || 'Unknown'}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        {item.city ? `${item.city}, ${item.country}` : 'Location Unknown'} • {new Date(item.created_at).toLocaleString()}
                      </Text>
                      {item.failure_reason && (
                        <Text style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>
                          Reason: {item.failure_reason}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[styles.badge, { backgroundColor: item.success ? `${colors.success}20` : `${colors.error}20` }]}>
                        <Text style={{ color: item.success ? colors.success : colors.error, fontSize: 11, fontWeight: '700' }}>
                          {item.success ? 'Success' : 'Failed'}
                        </Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '600' }}>
                        Risk: {item.risk_score}/100
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              );
            } else {
              return (
                <GlassCard style={{ marginBottom: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[styles.iconWrapper, { backgroundColor: item.severity === 'critical' ? `${colors.error}15` : `${colors.warning}15` }]}>
                      <Ionicons 
                        name={item.severity === 'critical' ? "alert-circle" : "warning"} 
                        size={24} 
                        color={item.severity === 'critical' ? colors.error : colors.warning} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                        {item.event_type.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        Severity: {item.severity.toUpperCase()}
                      </Text>
                      <Text style={{ color: colors.foreground, fontSize: 12, marginTop: 6 }}>
                        Details: {JSON.stringify(item.details)}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              );
            }
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="shield-checkmark" size={48} color={colors.success} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>No records found</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Everything looks secure and protected.</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
