import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hasPermission } from '@/lib/permissions';

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  issue_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  clients: {
    name: string;
    company_name: string;
  };
}

export default function InvoiceDashboard() {
  const { user, isAuthenticated } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientsCount, setClientsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'number'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // KPI Metrics
  const [metrics, setMetrics] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    outstanding: 0,
    overdue: 0,
  });

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Resolve user organization / freelancer context
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('org_id')
        .eq('user_id', user!.id);

      const orgId = myOrgs && myOrgs.length > 0 ? myOrgs[0].org_id : null;

      // 2. Fetch Invoices
      let invQuery = supabase
        .from('invoices')
        .select('*, clients(name, company_name)')
        .eq('is_deleted', false);

      if (orgId) {
        invQuery = invQuery.eq('organization_id', orgId);
      } else {
        invQuery = invQuery.eq('owner_id', user!.id).is('organization_id', null);
      }

      const { data: invData, error: invError } = await invQuery;
      if (invError) throw invError;

      const loadedInvoices: Invoice[] = (invData as any[]) || [];
      setInvoices(loadedInvoices);

      // 3. Fetch Clients count
      let clientQuery = supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_deleted', false);
      if (orgId) {
        clientQuery = clientQuery.eq('organization_id', orgId);
      } else {
        clientQuery = clientQuery.eq('owner_id', user!.id).is('organization_id', null);
      }
      const { count: cCount } = await clientQuery;
      setClientsCount(cCount || 0);

      // 4. Calculate KPI metrics
      let invoiced = 0;
      let paid = 0;
      let outstanding = 0;
      let overdue = 0;
      const todayStr = new Date().toISOString().split('T')[0];

      loadedInvoices.forEach((inv) => {
        if (inv.status !== 'cancelled') {
          invoiced += Number(inv.total_amount);
          paid += Number(inv.paid_amount);
          outstanding += Number(inv.balance_due);
          
          if (inv.status === 'overdue' || (Number(inv.balance_due) > 0 && inv.due_date < todayStr)) {
            overdue += Number(inv.balance_due);
          }
        }
      });

      setMetrics({
        totalInvoiced: invoiced,
        totalPaid: paid,
        outstanding: outstanding,
        overdue: overdue,
      });
    } catch (e) {
      console.error('[InvoiceDashboard] Error loading data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let frameId: number;
    if (user) {
      frameId = requestAnimationFrame(() => {
        loadDashboardData();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [user, loadDashboardData]);

  const getFilteredInvoices = () => {
    let result = [...invoices];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.clients?.name.toLowerCase().includes(q) ||
          inv.clients?.company_name?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
      } else if (sortBy === 'amount') {
        comparison = a.total_amount - b.total_amount;
      } else if (sortBy === 'number') {
        comparison = a.invoice_number.localeCompare(b.invoice_number);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#10B98115', text: '#10B981', label: 'Paid' };
      case 'partially_paid':
        return { bg: '#3B82F615', text: '#3B82F6', label: 'Partial' };
      case 'sent':
        return { bg: '#8B5CF615', text: '#8B5CF6', label: 'Sent' };
      case 'overdue':
        return { bg: '#EF444415', text: '#EF4444', label: 'Overdue' };
      case 'cancelled':
        return { bg: '#6B728015', text: '#6B7280', label: 'Cancelled' };
      default:
        return { bg: '#F59E0B15', text: '#F59E0B', label: 'Draft' };
    }
  };

  const handleSort = (field: 'date' | 'amount' | 'number') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filtered = getFilteredInvoices();

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable 
            onPress={() => router.push('/(tabs)/menu')}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">Invoicing</Text>
        </View>
        
        <Pressable
          onPress={() => router.push('/invoices/new' as any)}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primary }}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* KPI Analytics Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 24, paddingRight: 8, marginBottom: 24 }}
          >
            {/* Total Invoiced */}
            <View 
              className="p-5 rounded-2xl mr-4 w-44 border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 justify-center items-center mb-3">
                <Ionicons name="wallet-outline" size={20} color={colors.primary} />
              </View>
              <Text className="text-xs text-muted mb-1 font-medium">Total Invoiced</Text>
              <Text className="text-lg font-bold text-foreground">{formatCurrency(metrics.totalInvoiced)}</Text>
            </View>

            {/* Total Paid */}
            <View 
              className="p-5 rounded-2xl mr-4 w-44 border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="w-10 h-10 rounded-full bg-emerald-500/10 justify-center items-center mb-3">
                <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
              </View>
              <Text className="text-xs text-muted mb-1 font-medium">Total Paid</Text>
              <Text className="text-lg font-bold text-foreground">{formatCurrency(metrics.totalPaid)}</Text>
            </View>

            {/* Outstanding */}
            <View 
              className="p-5 rounded-2xl mr-4 w-44 border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="w-10 h-10 rounded-full bg-amber-500/10 justify-center items-center mb-3">
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
              </View>
              <Text className="text-xs text-muted mb-1 font-medium">Outstanding</Text>
              <Text className="text-lg font-bold text-foreground">{formatCurrency(metrics.outstanding)}</Text>
            </View>

            {/* Overdue */}
            <View 
              className="p-5 rounded-2xl mr-4 w-44 border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="w-10 h-10 rounded-full bg-rose-500/10 justify-center items-center mb-3">
                <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
              </View>
              <Text className="text-xs text-muted mb-1 font-medium">Overdue</Text>
              <Text className="text-lg font-bold text-foreground">{formatCurrency(metrics.overdue)}</Text>
            </View>

            {/* Total Clients */}
            <View 
              className="p-5 rounded-2xl mr-4 w-44 border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="w-10 h-10 rounded-full bg-indigo-500/10 justify-center items-center mb-3">
                <Ionicons name="people-outline" size={20} color="#6366F1" />
              </View>
              <Text className="text-xs text-muted mb-1 font-medium">Total Clients</Text>
              <Text className="text-lg font-bold text-foreground">{clientsCount}</Text>
            </View>
          </ScrollView>

          {/* Quick Actions Panel */}
          <View className="px-6 mb-6">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Quick Actions</Text>
            <View className="flex-row justify-between">
              <Pressable
                onPress={() => router.push('/invoices/new' as any)}
                className="flex-1 flex-row items-center justify-center p-4 rounded-2xl mr-3 border border-border"
                style={{ backgroundColor: colors.surface }}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.primary} className="mr-2" />
                <Text className="text-foreground font-semibold text-sm">New Invoice</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/invoices/upload' as any)}
                className="flex-1 flex-row items-center justify-center p-4 rounded-2xl border border-border"
                style={{ backgroundColor: colors.surface }}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} className="mr-2" />
                <Text className="text-foreground font-semibold text-sm">Upload Bill</Text>
              </Pressable>
            </View>
          </View>

          {/* Search and Filters */}
          <View className="px-6 mb-6">
            <View 
              className="flex-row items-center px-4 py-3 rounded-2xl mb-3 border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="search-outline" size={18} color={colors.muted} className="mr-3" />
              <TextInput
                placeholder="Search invoice number, client..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-base text-foreground"
              />
              {searchQuery !== '' && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>

            {/* Filter buttons */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
              {['all', 'draft', 'sent', 'paid', 'partially_paid', 'overdue'].map((status) => {
                const isSelected = statusFilter === status;
                const statusInfo = getStatusColor(status);
                return (
                  <Pressable
                    key={status}
                    onPress={() => setStatusFilter(status)}
                    className="px-4 py-2 rounded-full mr-2 border"
                    style={{
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <Text 
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: isSelected ? '#FFF' : colors.foreground }}
                    >
                      {status === 'all' ? 'All' : statusInfo.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Invoices List */}
          <View className="px-6">
            <View className="flex-row justify-between items-center mb-4 ml-1">
              <Text className="text-xs font-bold text-muted uppercase tracking-wider">Invoices</Text>
              <View className="flex-row">
                <Pressable onPress={() => handleSort('date')} className="flex-row items-center mr-3">
                  <Text className={`text-xs ${sortBy === 'date' ? 'text-primary font-bold' : 'text-muted'}`}>Date</Text>
                  {sortBy === 'date' && <Ionicons name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={10} color={colors.primary} className="ml-1" />}
                </Pressable>
                <Pressable onPress={() => handleSort('amount')} className="flex-row items-center">
                  <Text className={`text-xs ${sortBy === 'amount' ? 'text-primary font-bold' : 'text-muted'}`}>Amount</Text>
                  {sortBy === 'amount' && <Ionicons name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={10} color={colors.primary} className="ml-1" />}
                </Pressable>
              </View>
            </View>

            {filtered.length === 0 ? (
              <View className="p-12 items-center justify-center rounded-2xl border border-dashed border-border mt-2">
                <Ionicons name="receipt-outline" size={48} color={colors.muted} className="mb-3" />
                <Text className="text-base font-bold text-foreground mb-1">No Invoices Found</Text>
                <Text className="text-sm text-muted text-center">Try adjusting your filters or create a new invoice.</Text>
              </View>
            ) : (
              filtered.map((item) => {
                const stat = getStatusColor(item.status);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/invoices/${item.id}` as any)}
                    className="p-4 mb-3 rounded-2xl border border-border flex-row items-center justify-between"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <View className="flex-1 mr-4">
                      <View className="flex-row items-center mb-1">
                        <Text className="text-base font-bold text-foreground mr-2">{item.invoice_number}</Text>
                        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: stat.bg }}>
                          <Text className="text-[10px] font-bold uppercase" style={{ color: stat.text }}>{stat.label}</Text>
                        </View>
                      </View>
                      <Text className="text-sm text-foreground mb-0.5" numberOfLines={1}>{item.clients?.name || 'Unknown Client'}</Text>
                      <Text className="text-xs text-muted">Due: {item.due_date}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-base font-bold text-foreground mb-1">{formatCurrency(item.total_amount)}</Text>
                      {item.balance_due > 0 && (
                        <Text className="text-[11px] text-amber-600 font-medium">Bal: {formatCurrency(item.balance_due)}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
