import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';

export type MobileWhyType = 'delivery' | 'cost' | 'progress' | 'scope';

interface MobileWhyModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  initialType?: MobileWhyType;
}

export function MobileWhyModal({
  visible,
  onClose,
  projectId,
  initialType = 'delivery',
}: MobileWhyModalProps) {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<MobileWhyType>(initialType);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialType);
    }
  }, [visible, initialType]);

  useEffect(() => {
    if (!visible || !projectId) return;

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        // Deterministic fetch directly via Supabase
        if (activeTab === 'delivery') {
          const { data: commitments } = await supabase
            .from('project_commitments')
            .select('*')
            .eq('project_id', projectId)
            .order('version_number', { ascending: true });

          const { data: crs } = await supabase
            .from('project_change_requests')
            .select('*')
            .eq('project_id', projectId)
            .eq('status', 'accepted');

          const baseline = commitments?.[0];
          const latest = commitments?.[commitments.length - 1] || baseline;

          if (isMounted) {
            setData({
              baselineDate: baseline?.delivery_date,
              currentDeliveryDate: latest?.delivery_date,
              adjustments: (crs || []).map((c: any) => ({
                id: c.id,
                code: c.cr_code,
                title: c.title,
                impact: `+${c.schedule_impact_days} Days`,
              })),
            });
            setLoading(false);
          }
        } else if (activeTab === 'cost') {
          const { data: commitments } = await supabase
            .from('project_commitments')
            .select('*')
            .eq('project_id', projectId)
            .order('version_number', { ascending: true });

          const { data: crs } = await supabase
            .from('project_change_requests')
            .select('*')
            .eq('project_id', projectId)
            .eq('status', 'accepted');

          const baseline = commitments?.[0];
          const latest = commitments?.[commitments.length - 1] || baseline;

          if (isMounted) {
            setData({
              baselineCost: baseline?.total_cost || 45000,
              currentCost: latest?.total_cost || 45000,
              steps: (crs || []).map((c: any) => ({
                id: c.id,
                code: c.cr_code,
                title: c.title,
                delta: `${c.cost_impact >= 0 ? '+' : '-'}₹${Math.abs(c.cost_impact)}`,
              })),
            });
            setLoading(false);
          }
        } else if (activeTab === 'progress') {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('id, title, status')
            .eq('project_id', projectId);

          const taskList = tasks || [];
          const done = taskList.filter((t) => t.status === 'done').length;
          const pct = taskList.length > 0 ? Math.round((done / taskList.length) * 100) : 0;

          if (isMounted) {
            setData({
              overallProgress: pct,
              doneCount: done,
              totalCount: taskList.length,
              tasks: taskList,
            });
            setLoading(false);
          }
        } else if (activeTab === 'scope') {
          const { data: commitments } = await supabase
            .from('project_commitments')
            .select('*')
            .eq('project_id', projectId)
            .order('version_number', { ascending: true });

          const { data: crs } = await supabase
            .from('project_change_requests')
            .select('*')
            .eq('project_id', projectId)
            .eq('status', 'accepted');

          const baseline = commitments?.[0];
          const latest = commitments?.[commitments.length - 1] || baseline;

          if (isMounted) {
            setData({
              baselineScope: baseline?.scope_count || 8,
              currentScope: latest?.scope_count || 8,
              scopeChanges: (crs || []).map((c: any) => ({
                id: c.id,
                code: c.cr_code,
                title: c.title,
                delta: `+${c.scope_impact_count} Deliverables`,
              })),
            });
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error loading mobile causality:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [visible, projectId, activeTab]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.badge, { backgroundColor: 'rgba(255,107,74,0.1)' }]}>
                <Text style={styles.badgeText}>WHY?</Text>
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>Causality Proof</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.secondary_text} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {(['delivery', 'cost', 'progress', 'scope'] as MobileWhyType[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabItem,
                  activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === tab ? colors.primary : colors.secondary_text },
                  ]}
                >
                  {tab.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Body */}
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.secondary_text }]}>Computing deterministic trace...</Text>
              </View>
            ) : (
              <>
                {activeTab === 'delivery' && (
                  <View style={styles.contentBlock}>
                    <View style={styles.card}>
                      <Text style={styles.subLabel}>TARGET DELIVERY DATE</Text>
                      <Text style={[styles.bigValue, { color: colors.foreground }]}>
                        {data?.currentDeliveryDate ? new Date(data.currentDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Open'}
                      </Text>
                    </View>

                    {/* Timeline */}
                    <View style={styles.timeline}>
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { borderColor: colors.secondary_text }]} />
                        <View style={styles.timelineContent}>
                          <Text style={[styles.timelineTitle, { color: colors.foreground }]}>Original Baseline Commitment</Text>
                          <Text style={styles.timelineSubtitle}>
                            {data?.baselineDate ? new Date(data.baselineDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Initial Date'}
                          </Text>
                        </View>
                      </View>

                      {data?.adjustments?.map((adj: any) => (
                        <View key={adj.id} style={styles.timelineItem}>
                          <View style={[styles.timelineDot, { borderColor: colors.primary }]} />
                          <View style={styles.timelineContent}>
                            <Text style={[styles.timelineTitle, { color: colors.foreground }]}>{adj.code}: {adj.title}</Text>
                            <Text style={[styles.timelineDelta, { color: colors.primary }]}>{adj.impact}</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { borderColor: '#10B981', backgroundColor: '#10B981' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={[styles.timelineTitle, { color: '#10B981' }]}>Current Committed Delivery</Text>
                          <Text style={styles.timelineSubtitle}>
                            {data?.currentDeliveryDate ? new Date(data.currentDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Confirmed'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {activeTab === 'cost' && (
                  <View style={styles.contentBlock}>
                    <View style={styles.card}>
                      <Text style={styles.subLabel}>CURRENT PROJECT VALUE</Text>
                      <Text style={[styles.bigValue, { color: colors.foreground }]}>
                        ₹{Number(data?.currentCost || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>

                    <View style={styles.stepsList}>
                      <View style={styles.stepRow}>
                        <Text style={[styles.stepTitle, { color: colors.secondary_text }]}>Baseline Commitment (V1)</Text>
                        <Text style={[styles.stepVal, { color: colors.foreground }]}>₹{Number(data?.baselineCost || 0).toLocaleString('en-IN')}</Text>
                      </View>

                      {data?.steps?.map((st: any) => (
                        <View key={st.id} style={styles.stepRow}>
                          <Text style={[styles.stepTitle, { color: colors.foreground }]}>{st.code}: {st.title}</Text>
                          <Text style={[styles.stepVal, { color: colors.primary }]}>{st.delta}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {activeTab === 'progress' && (
                  <View style={styles.contentBlock}>
                    <View style={styles.card}>
                      <Text style={styles.subLabel}>DETERMINISTIC WEIGHTED PROGRESS</Text>
                      <Text style={[styles.bigValue, { color: colors.primary }]}>
                        {data?.overallProgress || 0}%
                      </Text>
                      <Text style={[styles.subText, { color: colors.secondary_text }]}>
                        {data?.doneCount || 0} of {data?.totalCount || 0} Deliverables Done
                      </Text>
                    </View>

                    <View style={styles.taskList}>
                      {data?.tasks?.map((t: any) => (
                        <View key={t.id} style={styles.taskItem}>
                          <Ionicons
                            name={t.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                            size={16}
                            color={t.status === 'done' ? '#10B981' : colors.secondary_text}
                          />
                          <Text
                            style={[
                              styles.taskTitle,
                              {
                                color: t.status === 'done' ? colors.secondary_text : colors.foreground,
                                textDecorationLine: t.status === 'done' ? 'line-through' : 'none',
                              },
                            ]}
                          >
                            {t.title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {activeTab === 'scope' && (
                  <View style={styles.contentBlock}>
                    <View style={styles.card}>
                      <Text style={styles.subLabel}>TOTAL DELIVERABLES SCOPE</Text>
                      <Text style={[styles.bigValue, { color: colors.foreground }]}>
                        {data?.currentScope || 8} Items
                      </Text>
                    </View>

                    <View style={styles.stepsList}>
                      <View style={styles.stepRow}>
                        <Text style={[styles.stepTitle, { color: colors.secondary_text }]}>Baseline Deliverables</Text>
                        <Text style={[styles.stepVal, { color: colors.foreground }]}>{data?.baselineScope || 8} Items</Text>
                      </View>

                      {data?.scopeChanges?.map((sc: any) => (
                        <View key={sc.id} style={styles.stepRow}>
                          <Text style={[styles.stepTitle, { color: colors.foreground }]}>{sc.code}: {sc.title}</Text>
                          <Text style={[styles.stepVal, { color: colors.primary }]}>{sc.delta}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FF6B4A',
    fontWeight: 'bold',
    fontSize: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  body: {
    padding: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
  },
  contentBlock: {
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  subLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 4,
  },
  bigValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 11,
    marginTop: 4,
  },
  timeline: {
    gap: 12,
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelineSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  timelineDelta: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  stepsList: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
  },
  stepTitle: {
    fontSize: 12,
  },
  stepVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  taskList: {
    gap: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  taskTitle: {
    fontSize: 12,
  },
});
