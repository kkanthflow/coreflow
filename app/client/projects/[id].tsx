import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { causalityApi } from '@/lib/causalityApi';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MobileWhyModal, type MobileWhyType } from '@/components/causality/MobileWhyModal';

export default function ClientProjectRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [clientAccess, setClientAccess] = useState<any>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Causality data
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [scopeData, setScopeData] = useState<any>(null);
  const [respData, setRespData] = useState<any>(null);
  const [pendingCRs, setPendingCRs] = useState<any[]>([]);

  // Modals
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [whyType, setWhyType] = useState<MobileWhyType>('delivery');
  const [activeTab, setActiveTab] = useState<'overview' | 'journey' | 'changes' | 'proof'>('overview');

  const fetchClientRoomData = useCallback(async () => {
    if (!id) return;
    try {
      // 1. Fetch Project via Client-Safe Selection
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('id, title, description, status, due_date, created_at, cover_color, tasks(id, title, status)')
        .eq('id', id)
        .single();

      if (projErr || !projData) {
        setProject(null);
        return;
      }

      setProject(projData);

      // 2. Check if active user is a direct client contact
      if (user) {
        const { data: ca } = await supabase
          .from('project_client_access')
          .select('*')
          .eq('project_id', id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        setClientAccess(ca);
        setIsPreviewMode(!ca);
      }

      // 3. Fetch Causality Data directly from shared backend
      const [dRes, cRes, pRes, sRes, rRes] = await Promise.all([
        causalityApi.getWhyDelivery(id).catch(() => null),
        causalityApi.getWhyCost(id).catch(() => null),
        causalityApi.getWhyProgress(id).catch(() => null),
        causalityApi.getWhyScope(id).catch(() => null),
        causalityApi.getResponsibility(id).catch(() => null),
      ]);

      setDeliveryData(dRes);
      setCostData(cRes);
      setProgressData(pRes);
      setScopeData(sRes);
      setRespData(rRes);

      // 4. Fetch Client Change Requests
      const { data: crs } = await supabase
        .from('project_change_requests')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      setPendingCRs(crs || []);
    } catch (e) {
      console.error('Error loading mobile client project room:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchClientRoomData();
  }, [fetchClientRoomData]);

  const handleDecision = async (crId: string, decision: 'accepted' | 'rejected') => {
    if (isPreviewMode) {
      Alert.alert('Preview Mode', 'Client actions are disabled in Preview mode.');
      return;
    }
    if (!clientAccess?.can_approve) {
      Alert.alert('Permission Denied', 'Your client contact account does not have approval authority.');
      return;
    }

    try {
      await causalityApi.decideChangeRequest(crId, decision, `Client decided: ${decision}`);
      Alert.alert('Success', `Change Request ${decision.toUpperCase()}`);
      fetchClientRoomData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit decision.');
    }
  };

  if (loading && !project) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!project) {
    return (
      <ScreenContainer className="justify-center items-center p-6 space-y-4">
        <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 12 }}>
          Client Access Restricted
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
          You do not have client access to this project room.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <MobileWhyModal
        visible={showWhyModal}
        onClose={() => setShowWhyModal(false)}
        projectId={id!}
        initialType={whyType}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, fontFamily: 'monospace' }}>
              CLIENT PROJECT ROOM
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted, fontFamily: 'monospace' }}>
              CF-PRJ-{project.id.slice(0, 6)}
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {project.title}
          </Text>
        </View>
        <Pressable
          onPress={() => { setWhyType('delivery'); setShowWhyModal(true); }}
          style={[styles.whyBtn, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>WHY?</Text>
        </Pressable>
      </View>

      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <View style={[styles.previewBanner, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b40' }]}>
          <Ionicons name="eye-outline" size={16} color="#f59e0b" />
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#f59e0b' }}>
            CLIENT VIEW PREVIEW — Action controls disabled.
          </Text>
        </View>
      )}

      {/* Navigation Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {[
          { id: 'overview', label: 'OVERVIEW' },
          { id: 'journey', label: 'JOURNEY' },
          { id: 'changes', label: `CHANGES (${pendingCRs.length})` },
          { id: 'proof', label: 'PROOF' },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as any)}
            style={[
              styles.tabItem,
              activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.id ? colors.primary : colors.muted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClientRoomData(); }} />}
      >
        {activeTab === 'overview' && (
          <View style={{ gap: 16 }}>
            {/* Responsibility Banner */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700', letterSpacing: 0.5 }}>
                    RESPONSIBILITY CLOCK
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.foreground, marginTop: 2 }}>
                    With {respData?.held_by === 'CLIENT' ? 'CLIENT (Your Review)' : 'PROJECT OWNER (Active Sprint)'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 4 Flagship WHY Metric Cards */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Progress */}
              <Pressable
                onPress={() => { setWhyType('progress'); setShowWhyModal(true); }}
                style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700' }}>PROGRESS</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary, marginVertical: 4 }}>
                  {progressData?.overallProgress || 0}%
                </Text>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>WHY? →</Text>
              </Pressable>

              {/* Delivery */}
              <Pressable
                onPress={() => { setWhyType('delivery'); setShowWhyModal(true); }}
                style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700' }}>DELIVERY</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.foreground, marginVertical: 4 }}>
                  {deliveryData?.currentDeliveryDate ? new Date(deliveryData.currentDeliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Open'}
                </Text>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>WHY? →</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Cost */}
              <Pressable
                onPress={() => { setWhyType('cost'); setShowWhyModal(true); }}
                style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700' }}>VALUE</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#10b981', marginVertical: 4 }}>
                  ₹{Number(costData?.currentCost || 0).toLocaleString('en-IN')}
                </Text>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>WHY? →</Text>
              </Pressable>

              {/* Scope */}
              <Pressable
                onPress={() => { setWhyType('scope'); setShowWhyModal(true); }}
                style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700' }}>SCOPE</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground, marginVertical: 4 }}>
                  {scopeData?.currentScopeCount || 0} Items
                </Text>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>WHY? →</Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === 'changes' && (
          <View style={{ gap: 12 }}>
            {pendingCRs.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', padding: 24 }]}>
                <Ionicons name="checkmark-done-circle-outline" size={36} color="#10b981" />
                <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 14, marginTop: 8 }}>
                  No Pending Change Requests
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  All project change requests are resolved and committed.
                </Text>
              </View>
            ) : (
              pendingCRs.map((cr) => (
                <View key={cr.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, fontFamily: 'monospace' }}>
                      {cr.cr_code}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: cr.status === 'accepted' ? '#10b981' : colors.muted }}>
                      {cr.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground, marginTop: 4 }}>
                    {cr.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    {cr.description}
                  </Text>

                  {/* Impact Summary */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '700' }}>+₹{Number(cr.cost_impact).toLocaleString('en-IN')}</Text>
                    <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '700' }}>+{cr.schedule_impact_days} Days</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>+{cr.scope_impact_count} Deliverables</Text>
                  </View>

                  {cr.status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <Pressable
                        onPress={() => handleDecision(cr.id, 'accepted')}
                        disabled={isPreviewMode}
                        style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Accept Change</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDecision(cr.id, 'rejected')}
                        disabled={isPreviewMode}
                        style={[styles.actionBtn, { backgroundColor: `${colors.error}20`, borderColor: colors.error, borderWidth: 1 }]}
                      >
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}>Reject</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'journey' && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 16 }]}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.foreground, marginBottom: 12 }}>
              Project Milestone Horizon
            </Text>
            {project.tasks && project.tasks.length > 0 ? (
              project.tasks.slice(0, 10).map((t: any, idx: number) => (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: idx < project.tasks.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <Ionicons
                    name={t.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={t.status === 'done' ? '#10b981' : colors.muted}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: t.status === 'done' ? colors.muted : colors.foreground, flex: 1 }}>
                    {t.title}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.muted, textTransform: 'capitalize' }}>
                    {t.status}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 12, color: colors.muted }}>No public milestones established yet.</Text>
            )}
          </View>
        )}

        {activeTab === 'proof' && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 16 }]}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>
              Tamper-Proof Project Evidence
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
              Every progress point and change order is backed by immutable database receipts.
            </Text>
            <Pressable
              onPress={() => { setWhyType('delivery'); setShowWhyModal(true); }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Inspect Deterministic Proofs</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  whyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
