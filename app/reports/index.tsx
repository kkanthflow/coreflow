import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hasPermission } from '@/lib/permissions';

export default function ReportsDashboard() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const reportItems = [
    {
      title: 'Projects Performance',
      description: 'Progress tracker, timelines, priorities, and status breakdown.',
      icon: 'bar-chart-outline',
      color: colors.primary,
      route: '/reports/projects',
      permission: 'view_reports',
    },
    {
      title: 'Tasks Completion',
      description: 'Exportable CSV task sheets showing assignees and status.',
      icon: 'checkbox-outline',
      color: colors.secondary,
      route: '/reports/tasks',
      permission: 'view_reports',
    },
    {
      title: 'Invoices & Billing',
      description: 'Financial collections, paid volume, and outstanding balance summary.',
      icon: 'receipt-outline',
      color: colors.success,
      route: '/reports/invoices',
      permission: 'view_invoices',
    },
  ];

  const filteredReports = reportItems.filter(item => 
    hasPermission(user?.role, item.permission as any)
  );

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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reports Hub</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Export data and track workspace analytics
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {filteredReports.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="lock-closed" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.foreground, marginTop: 16 }]}>
              Access Denied
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              You do not have permission to view any reports in this workspace.
            </Text>
          </View>
        ) : (
          filteredReports.map((report, idx) => (
            <Pressable
              key={idx}
              onPress={() => router.push(report.route as any)}
              style={({ pressed }) => [
                styles.reportCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                }
              ]}
            >
              <View style={[styles.iconWrapper, { backgroundColor: `${report.color}15` }]}>
                <Ionicons name={report.icon as any} size={24} color={report.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.reportTitle, { color: colors.foreground }]}>
                  {report.title}
                </Text>
                <Text style={[styles.reportDesc, { color: colors.muted }]}>
                  {report.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))
        )}
      </View>
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
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  reportDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
