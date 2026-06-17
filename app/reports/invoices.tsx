import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PremiumButton } from '@/components/ui/premium-button';
import { hasPermission } from '@/lib/permissions';

export default function InvoicesReportScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [stats, setStats] = useState({
    totalPaid: 0,
    totalOutstanding: 0,
    totalVolume: 0,
    currency: 'INR',
  });

  const fetchReportData = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          status,
          total_amount,
          paid_amount,
          balance_due,
          currency,
          due_date,
          issue_date,
          client:client_id (
            name,
            company_name
          )
        `)
        .eq('organization_id', user.organizationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = data || [];
      setInvoices(items);

      // Calculate paid vs outstanding
      let paid = 0;
      let outstanding = 0;
      let total = 0;
      let defaultCurrency = 'INR';

      items.forEach((inv: any) => {
        if (inv.status !== 'cancelled') {
          paid += Number(inv.paid_amount || 0);
          outstanding += Number(inv.balance_due || 0);
          total += Number(inv.total_amount || 0);
          if (inv.currency) {
            defaultCurrency = inv.currency;
          }
        }
      });

      setStats({
        totalPaid: paid,
        totalOutstanding: outstanding,
        totalVolume: total,
        currency: defaultCurrency,
      });

    } catch (e) {
      console.error('Error fetching invoice report data:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleExportPDF = async () => {
    if (invoices.length === 0) {
      Alert.alert('Empty', 'No invoices to export.');
      return;
    }

    setExporting(true);
    try {
      const rowsHtml = invoices.map(inv => `
        <tr>
          <td><strong>${inv.invoice_number || 'Draft'}</strong></td>
          <td>${inv.client?.company_name || inv.client?.name || 'N/A'}</td>
          <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
          <td>${inv.currency} ${Number(inv.total_amount).toLocaleString()}</td>
          <td>${inv.currency} ${Number(inv.paid_amount).toLocaleString()}</td>
          <td><strong>${inv.currency} ${Number(inv.balance_due).toLocaleString()}</strong></td>
          <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 32px; color: #1E293B; }
              header { border-bottom: 2px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 24px; }
              h1 { font-size: 24px; font-weight: 800; margin: 0; color: #0F172A; }
              .subtitle { font-size: 14px; color: #64748B; margin-top: 4px; }
              .summary-cards { display: flex; gap: 16px; margin-bottom: 24px; }
              .card { flex: 1; padding: 16px; border: 1px solid #E2E8F0; border-radius: 8px; background-color: #F8FAFC; }
              .card-title { font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 700; margin-bottom: 4px; }
              .card-value { font-size: 20px; font-weight: 800; color: #0F172A; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th { text-align: left; padding: 12px; border-bottom: 2px solid #CBD5E1; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; }
              td { padding: 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; }
              .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
              .status-paid { background-color: #D1FAE5; color: #065F46; }
              .status-partially_paid { background-color: #FEF3C7; color: #92400E; }
              .status-sent { background-color: #E0F2FE; color: #075985; }
              .status-overdue { background-color: #FEE2E2; color: #991B1B; }
              .status-draft { background-color: #F3F4F6; color: #374151; }
              .status-cancelled { background-color: #E5E7EB; color: #6B7280; text-decoration: line-through; }
              footer { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 16px; font-size: 11px; color: #94A3B8; text-align: center; }
            </style>
          </head>
          <body>
            <header>
              <h1>CoreFlow — Invoice & Billing Report</h1>
              <div class="subtitle">Organization: ${user?.organizationName || 'My Workspace'} • Generated: ${new Date().toLocaleString()}</div>
            </header>
            
            <div class="summary-cards">
              <div class="card">
                <div class="card-title">Total Invoiced Volume</div>
                <div class="card-value">${stats.currency} ${stats.totalVolume.toLocaleString()}</div>
              </div>
              <div class="card">
                <div class="card-title">Total Collected (Paid)</div>
                <div class="card-value" style="color: #059669;">${stats.currency} ${stats.totalPaid.toLocaleString()}</div>
              </div>
              <div class="card">
                <div class="card-title">Total Outstanding</div>
                <div class="card-value" style="color: #DC2626;">${stats.currency} ${stats.totalOutstanding.toLocaleString()}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Client/Company</th>
                  <th>Status</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Balance Due</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <footer>Generated automatically by CoreFlow Operating System. All rights reserved.</footer>
          </body>
        </html>
      `;

      const file = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(file.uri);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Export Failed', e.message || 'An error occurred during PDF generation.');
    } finally {
      setExporting(false);
    }
  };

  if (!hasPermission(user?.role, 'view_invoices')) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Ionicons name="lock-closed" size={48} color={colors.muted} />
        <Text style={[styles.errorText, { color: colors.foreground, marginTop: 16 }]}>
          Access Denied
        </Text>
        <Text style={[styles.errorSubtext, { color: colors.muted }]}>
          You do not have permission to view billing and invoice reports.
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Billing & Invoices Report</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Summary Row */}
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>Collected</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {stats.currency} {stats.totalPaid.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>Outstanding</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                {stats.currency} {stats.totalOutstanding.toLocaleString()}
              </Text>
            </View>
          </View>

          <FlatList
            data={invoices}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              let statusColor = colors.muted;
              if (item.status === 'paid') statusColor = colors.success;
              if (item.status === 'partially_paid') statusColor = colors.warning;
              if (item.status === 'sent') statusColor = colors.primary;
              if (item.status === 'overdue') statusColor = colors.error;

              return (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.cardInfo}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                        {item.invoice_number || 'Draft'}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: `${statusColor}15` }]}>
                        <Text style={[styles.badgeText, { color: statusColor }]}>
                          {item.status.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.clientName, { color: colors.muted }]}>
                      {item.client?.company_name || item.client?.name || 'N/A'}
                    </Text>
                    <View style={styles.amountRow}>
                      <Text style={[styles.amountLabel, { color: colors.muted }]}>
                        Total: <Text style={[styles.amountValue, { color: colors.foreground }]}>{item.currency} {Number(item.total_amount).toLocaleString()}</Text>
                      </Text>
                      {Number(item.balance_due) > 0 && (
                        <Text style={[styles.amountLabel, { color: colors.muted }]}>
                          Due: <Text style={[styles.amountValue, { color: colors.error }]}>{item.currency} {Number(item.balance_due).toLocaleString()}</Text>
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.dueDate, { color: colors.muted }]}>
                      Due: {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
                <Text style={[styles.emptyText, { color: colors.foreground }]}>No invoices found</Text>
              </View>
            }
          />

          {invoices.length > 0 && (
            <View style={styles.footer}>
              <PremiumButton
                variant="primary"
                size="lg"
                onPress={handleExportPDF}
                loading={exporting}
                disabled={exporting}
                style={{ width: '100%' }}
              >
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                Print PDF Invoice Summary
              </PremiumButton>
            </View>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  clientName: {
    fontSize: 13,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 12,
  },
  amountValue: {
    fontWeight: '700',
  },
  dueDate: {
    fontSize: 11,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
});
