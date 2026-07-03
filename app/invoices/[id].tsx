import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getCurrencyDetails, formatCurrency } from '@/lib/currency';

interface Client {
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  gst_number?: string;
  address?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  discount: number;
  hsn_code?: string;
  tax_rate: number;
  tax_amount: number;
  amount: number;
}

interface InvoicePayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_reference?: string;
  notes?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  status: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  cgst: number;
  sgst: number;
  igst: number;
  template_style: 'classic' | 'modern' | 'corporate' | 'minimal';
  organization_id?: string | null;
  clients: Client;
  invoice_items: InvoiceItem[];
  invoice_payments: InvoicePayment[];
  organizations?: {
    name: string;
    gst_number?: string | null;
    address?: string | null;
  } | null;
}

export default function InvoiceDetailScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Payment Modal State
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // Template Style Modal State
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);

  const loadInvoiceDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(*), invoice_items(*), invoice_payments(*), organizations(name, gst_number, address)')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;
      setInvoice(data);
    } catch (e: any) {
      console.error('[InvoiceDetail] Error loading details:', e);
      Alert.alert('Error', 'Failed to load invoice details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    let frameId: number;
    if (user && id) {
      frameId = requestAnimationFrame(() => {
        loadInvoiceDetails();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [user, id, loadInvoiceDetails]);

  const handleSoftDelete = async () => {
    Alert.alert(
      'Delete Invoice',
      'Are you sure you want to permanently delete this invoice? All associated items, payments, and receipt logs will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Log audit record first (while invoice still exists and fields are readable)
              await supabase.from('invoice_audit_logs').insert({
                organization_id: invoice?.organization_id,
                invoice_id: id,
                user_id: user!.id,
                action: 'Invoice Deleted',
                old_values: { invoice_number: invoice?.invoice_number },
              });

              // Perform hard delete
              const { error } = await supabase
                .from('invoices')
                .delete()
                .eq('id', id);

              if (error) throw error;

              Alert.alert('Deleted', 'Invoice successfully deleted.');
              router.replace('/invoices' as any);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete invoice');
            }
          }
        }
      ]
    );
  };


  const handleUpdateTemplateStyle = async (style: 'classic' | 'modern' | 'corporate' | 'minimal') => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ template_style: style })
        .eq('id', id);

      if (error) throw error;
      setInvoice(prev => prev ? { ...prev, template_style: style } : null);
      setIsTemplateModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update style');
    }
  };

  const handleSavePayment = async () => {
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }

    if (amt > invoice!.balance_due && !editingPaymentId) {
      Alert.alert('Validation Error', 'Payment amount cannot exceed the balance due');
      return;
    }

    try {
      if (editingPaymentId) {
        // Edit Payment
        const { error } = await supabase
          .from('invoice_payments')
          .update({
            amount: amt,
            payment_method: paymentMethod,
            transaction_reference: transactionRef || null,
            notes: paymentNotes || null,
          })
          .eq('id', editingPaymentId);

        if (error) throw error;

        await supabase.from('invoice_audit_logs').insert({
          organization_id: invoice?.organization_id,
          invoice_id: id,
          user_id: user!.id,
          action: 'Payment Edited',
        });
      } else {
        // Record New Payment
        const { error } = await supabase
          .from('invoice_payments')
          .insert({
            invoice_id: id,
            amount: amt,
            payment_method: paymentMethod,
            transaction_reference: transactionRef || null,
            notes: paymentNotes || null,
            received_by: user!.id,
            currency: invoice!.currency,
          });

        if (error) throw error;

        await supabase.from('invoice_audit_logs').insert({
          organization_id: invoice?.organization_id,
          invoice_id: id,
          user_id: user!.id,
          action: 'Payment Added',
        });
      }

      // Recalculate totals and status
      await supabase.rpc('recalculate_invoice_totals', { p_invoice_id: id });

      setIsPaymentModalVisible(false);
      setPaymentAmount('');
      setTransactionRef('');
      setPaymentNotes('');
      setEditingPaymentId(null);

      // Reload
      loadInvoiceDetails();
      Alert.alert('Success', 'Payment successfully recorded!');
    } catch (e: any) {
      console.error('[Payment] Error recording payment:', e);
      Alert.alert('Error', e.message || 'Failed to save payment');
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    Alert.alert(
      'Delete Payment Log',
      'Are you sure you want to delete this payment log? This will update the invoice outstanding balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('invoice_payments')
                .delete()
                .eq('id', paymentId);

              if (error) throw error;

              await supabase.from('invoice_audit_logs').insert({
                organization_id: invoice?.organization_id,
                invoice_id: id,
                user_id: user!.id,
                action: 'Payment Deleted',
              });

              // Recalculate totals
              await supabase.rpc('recalculate_invoice_totals', { p_invoice_id: id });
              loadInvoiceDetails();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete payment');
            }
          }
        }
      ]
    );
  };

  const getHTMLTemplate = () => {
    if (!invoice) return '';
    const style = invoice.template_style || 'classic';
    const symbol = getCurrencyDetails(invoice.currency).symbol;

    const itemsRows = invoice.invoice_items.map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${it.description}</td>
        <td>${it.hsn_code || '-'}</td>
        <td style="text-align: right;">${it.quantity}</td>
        <td style="text-align: right;">${symbol}${it.rate.toFixed(2)}</td>
        <td style="text-align: right;">${symbol}${it.discount.toFixed(2)}</td>
        <td style="text-align: right;">${it.tax_rate}%</td>
        <td style="text-align: right;">${symbol}${it.tax_amount.toFixed(2)}</td>
        <td style="text-align: right;">${symbol}${it.amount.toFixed(2)}</td>
      </tr>
    `).join('');

    const paymentsRows = invoice.invoice_payments && invoice.invoice_payments.length > 0
      ? invoice.invoice_payments.map((p) => `
        <tr>
          <td>${new Date(p.payment_date).toLocaleDateString()}</td>
          <td>${p.payment_method.replace('_', ' ').toUpperCase()}</td>
          <td>${p.transaction_reference || '-'}</td>
          <td style="text-align: right;">${symbol}${Number(p.amount).toFixed(2)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="4" style="text-align: center; color: #777;">No payments recorded</td></tr>';

    const vr = (invoice as any).visual_recreation || {};

    // Styles configurations
    let themeCSS = '';
    if ((style as any) === 'custom' || vr.primary_color) {
      themeCSS = `
        body { font-family: ${vr.font_family || 'Arial, sans-serif'}; color: #2D3748; }
        .invoice-header { border-bottom: 3px solid ${vr.primary_color || '#4F46E5'}; padding-bottom: 20px; margin-bottom: 30px; }
        th { background-color: ${vr.primary_color || '#4F46E5'}; color: #FFF; }
      `;
    } else if (style === 'modern') {
      themeCSS = `
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2D3748; }
        .invoice-header { background: linear-gradient(135deg, #6366F1, #8B5CF6); color: #FFF; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        th { background-color: #6366F1; color: #FFF; }
      `;
    } else if (style === 'corporate') {
      themeCSS = `
        body { font-family: 'Georgia', Times, serif; color: #1A202C; }
        .invoice-header { border-bottom: 4px solid #1E3A8A; padding-bottom: 20px; margin-bottom: 30px; }
        th { background-color: #1E3A8A; color: #FFF; }
      `;
    } else if (style === 'minimal') {
      themeCSS = `
        body { font-family: Arial, sans-serif; color: #333; }
        .invoice-header { border-bottom: 1px solid #E2E8F0; padding-bottom: 15px; margin-bottom: 25px; }
        th { border-bottom: 2px solid #333; color: #333; background: transparent; }
      `;
    } else {
      // Classic
      themeCSS = `
        body { font-family: 'Times New Roman', Times, serif; color: #000; }
        .invoice-header { border: 1px solid #CCC; padding: 20px; margin-bottom: 30px; }
        th { background-color: #F3F4F6; color: #000; }
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${themeCSS}
          .container { padding: 40px; }
          .grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .col { flex: 1; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #E2E8F0; padding: 12px; text-align: left; font-size: 13px; }
          .totals-table { width: 300px; float: right; }
          .totals-table td { border: none; padding: 6px 12px; }
          .signature-area { margin-top: 100px; border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="invoice-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              ${vr.logo_url ? `<img src="${vr.logo_url}" style="max-height: 50px; margin-bottom: 10px; display: block;" />` : ''}
              <h2 style="margin: 0;">${invoice.organizations?.name || '-'}</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">GSTIN: ${invoice.organizations?.gst_number || '-'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0 0 5px 0;">Invoice Number: <strong>${invoice.invoice_number}</strong></p>
              <p style="margin: 0;">Status: <strong>${invoice.status.toUpperCase()}</strong></p>
            </div>
          </div>

          <div class="grid" style="margin-top: 30px;">
            <div class="col">
              <h3>Issuer Info</h3>
              <p><strong>${invoice.organizations?.name || '-'}</strong></p>
              <p>GSTIN: ${invoice.organizations?.gst_number || '-'}</p>
              <p>${invoice.organizations?.address || '-'}</p>
            </div>
            <div class="col" style="text-align: right;">
              <h3>Client Details</h3>
              <p><strong>${invoice.clients.name}</strong></p>
              <p>${invoice.clients.company_name || '-'}</p>
              <p>GSTIN: ${invoice.clients.gst_number || '-'}</p>
              <p>${invoice.clients.address || '-'}</p>
            </div>
          </div>

          <p>Issue Date: ${invoice.issue_date} &nbsp;|&nbsp; Due Date: ${invoice.due_date}</p>

          <h3>Line Items</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>HSN</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Disc</th>
                <th>Tax %</th>
                <th>Tax Amt</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="overflow: hidden; margin-bottom: 40px;">
            <table class="totals-table">
              <tr>
                <td>Subtotal</td>
                <td style="text-align: right;">${symbol}${invoice.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>CGST (9%)</td>
                <td style="text-align: right;">${symbol}${invoice.cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>SGST (9%)</td>
                <td style="text-align: right;">${symbol}${invoice.sgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Discount</td>
                <td style="text-align: right;">-${symbol}${invoice.discount_amount.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 2px solid #000; font-weight: bold;">
                <td>Grand Total</td>
                <td style="text-align: right;">${symbol}${invoice.total_amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Paid Amount</td>
                <td style="text-align: right; color: green;">${symbol}${invoice.paid_amount.toFixed(2)}</td>
              </tr>
              <tr style="font-weight: bold; color: red;">
                <td>Balance Due</td>
                <td style="text-align: right;">${symbol}${invoice.balance_due.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <h3>Payment Log History</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Txn Ref</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsRows}
            </tbody>
          </table>

          <div class="signature-area">
            Authorized Signatory
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintPDF = async () => {
    try {
      const html = getHTMLTemplate();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e: any) {
      Alert.alert('PDF Print Failed', e.message || 'Failed to print PDF');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#10B98115', text: '#10B981', label: 'Paid' };
      case 'partially_paid':
        return { bg: '#3B82F615', text: '#3B82F6', label: 'Partially Paid' };
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

  if (isLoading || !invoice) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const stat = getStatusColor(invoice.status);

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-border" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.background }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <View>
            <Text className="text-base font-bold text-foreground">{invoice.invoice_number}</Text>
            <Text className="text-xs text-muted">Created: {invoice.issue_date}</Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.push(`/invoices/new?editId=${invoice.id}` as any)}
            className="w-9 h-9 rounded-xl justify-center items-center mr-2 bg-primary/10"
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </Pressable>

          <Pressable
            onPress={() => router.push(`/invoices/new?duplicateId=${invoice.id}` as any)}
            className="w-9 h-9 rounded-xl justify-center items-center mr-2 bg-indigo-500/10"
          >
            <Ionicons name="copy-outline" size={18} color="#6366F1" />
          </Pressable>

          <Pressable
            onPress={handleSoftDelete}
            className="w-9 h-9 rounded-xl justify-center items-center mr-2 bg-rose-500/10"
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>

          <Pressable
            onPress={handlePrintPDF}
            className="px-4 py-2 rounded-xl justify-center items-center bg-emerald-500"
          >
            <Text className="text-white font-bold text-xs">Print PDF</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Status card */}
        <View className="p-4 rounded-3xl border border-border mb-6 flex-row items-center justify-between" style={{ backgroundColor: colors.surface }}>
          <View>
            <Text className="text-xs text-muted font-medium mb-1">Invoice Status</Text>
            <View className="flex-row items-center">
              <View className="px-2.5 py-1 rounded-full mr-2" style={{ backgroundColor: stat.bg }}>
                <Text className="text-xs font-bold uppercase" style={{ color: stat.text }}>{stat.label}</Text>
              </View>
              {invoice.status === 'overdue' && (
                <Text className="text-xs text-rose-600 font-bold">Unpaid past due date</Text>
              )}
            </View>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted font-medium mb-1">Template Style</Text>
            <Pressable 
              onPress={() => setIsTemplateModalVisible(true)}
              className="flex-row items-center px-3 py-1 rounded-xl bg-primary/10"
            >
              <Text className="text-xs text-primary font-bold uppercase mr-1">{invoice.template_style || 'classic'}</Text>
              <Ionicons name="options-outline" size={12} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Info Grid */}
        <View className="flex-row mb-6">
          <View className="flex-1 p-4 rounded-3xl border border-border mr-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Billed From</Text>
            <Text className="text-sm font-bold text-foreground mb-0.5">{invoice.organizations?.name || '-'}</Text>
            <Text className="text-xs text-muted mb-0.5">GSTIN: {invoice.organizations?.gst_number || '-'}</Text>
            <Text className="text-xs text-muted">{invoice.organizations?.address || '-'}</Text>
          </View>
          <View className="flex-1 p-4 rounded-3xl border border-border" style={{ backgroundColor: colors.surface }}>
            <Text className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Billed To</Text>
            <Text className="text-sm font-bold text-foreground mb-0.5" numberOfLines={1}>{invoice.clients.name}</Text>
            {invoice.clients.company_name && <Text className="text-xs text-muted mb-0.5" numberOfLines={1}>{invoice.clients.company_name}</Text>}
            <Text className="text-xs text-muted" numberOfLines={1}>GSTIN: {invoice.clients.gst_number || '-'}</Text>
          </View>
        </View>

        {/* Dates */}
        <View className="flex-row mb-6 justify-between p-4 rounded-3xl border border-border" style={{ backgroundColor: colors.surface }}>
          <View>
            <Text className="text-[10px] font-bold text-muted uppercase mb-0.5">Issue Date</Text>
            <Text className="text-sm font-bold text-foreground">{invoice.issue_date}</Text>
          </View>
          <View className="items-end">
            <Text className="text-[10px] font-bold text-muted uppercase mb-0.5">Due Date</Text>
            <Text className="text-sm font-bold text-foreground">{invoice.due_date}</Text>
          </View>
        </View>

        {/* Line Items */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Line Items</Text>
          {invoice.invoice_items.map((it, idx) => (
            <View key={it.id || idx} className="p-4 mb-3 rounded-2xl border border-border" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm font-bold text-foreground mb-2">{it.description}</Text>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted">Qty: {it.quantity} x {formatCurrency(it.rate, invoice.currency)} (Tax {it.tax_rate}%)</Text>
                <Text className="text-sm font-bold text-foreground">{formatCurrency(it.amount, invoice.currency)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View className="p-5 rounded-3xl border border-border mb-6" style={{ backgroundColor: colors.surface }}>
          <Text className="text-sm font-bold text-foreground mb-4">Financial Summary</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-xs text-muted">Subtotal</Text>
            <Text className="text-xs text-foreground font-semibold">{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-xs text-muted">CGST (9%)</Text>
            <Text className="text-xs text-foreground font-semibold">{formatCurrency(invoice.cgst, invoice.currency)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-xs text-muted">SGST (9%)</Text>
            <Text className="text-xs text-foreground font-semibold">{formatCurrency(invoice.sgst, invoice.currency)}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-xs text-muted">Discount</Text>
            <Text className="text-xs text-rose-500 font-semibold">-{formatCurrency(invoice.discount_amount, invoice.currency)}</Text>
          </View>
          <View className="border-t border-border pt-3 flex-row justify-between items-center">
            <Text className="text-sm font-bold text-foreground">Total Balance Due</Text>
            <Text className="text-base font-bold text-primary">{formatCurrency(invoice.balance_due, invoice.currency)}</Text>
          </View>
        </View>

        {/* Payments list */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider ml-1">Payment History</Text>
            {invoice.balance_due > 0 && (
              <Pressable 
                onPress={() => {
                  setPaymentAmount(invoice.balance_due.toString());
                  setIsPaymentModalVisible(true);
                }}
                className="flex-row items-center px-3 py-1.5 rounded-xl bg-primary/10"
              >
                <Ionicons name="add-circle" size={14} color={colors.primary} className="mr-1" />
                <Text className="text-xs text-primary font-bold">Record Payment</Text>
              </Pressable>
            )}
          </View>

          {(!invoice.invoice_payments || invoice.invoice_payments.length === 0) ? (
            <View className="p-8 rounded-3xl border border-dashed border-border items-center justify-center">
              <Text className="text-sm text-muted">No payments recorded yet</Text>
            </View>
          ) : (
            invoice.invoice_payments.map((p, idx) => (
              <View key={p.id || idx} className="p-4 mb-3 rounded-2xl border border-border flex-row justify-between items-center" style={{ backgroundColor: colors.surface }}>
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-bold text-foreground">{formatCurrency(Number(p.amount), invoice.currency)}</Text>
                  <Text className="text-xs text-muted">{new Date(p.payment_date).toLocaleDateString()} via {p.payment_method.replace('_', ' ').toUpperCase()}</Text>
                  {p.transaction_reference && <Text className="text-[10px] text-muted">Ref: {p.transaction_reference}</Text>}
                </View>
                <Pressable onPress={() => handleDeletePayment(p.id)} className="w-8 h-8 rounded-full bg-rose-500/10 justify-center items-center">
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal visible={isPaymentModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-bold text-foreground">Record Payment</Text>
              <Pressable onPress={() => setIsPaymentModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <Text className="text-xs text-muted mb-1 ml-1">Payment Amount (Max {formatCurrency(invoice.balance_due, invoice.currency)})</Text>
            <TextInput
              keyboardType="numeric"
              placeholder={`0.00`}
              placeholderTextColor={colors.muted}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-4"
              style={{ backgroundColor: colors.surface }}
            />

            <Text className="text-xs text-muted mb-1 ml-1">Payment Method</Text>
            <View className="flex-row mb-4">
              {[
                { id: 'bank_transfer', label: 'Bank Transfer' },
                { id: 'credit_card', label: 'Credit Card' },
                { id: 'cash', label: 'Cash' },
              ].map(m => (
                <Pressable
                  key={m.id}
                  onPress={() => setPaymentMethod(m.id)}
                  className="flex-1 p-2.5 rounded-xl border border-border items-center mr-2"
                  style={{ backgroundColor: paymentMethod === m.id ? `${colors.primary}15` : colors.surface, borderColor: paymentMethod === m.id ? colors.primary : colors.border }}
                >
                  <Text className="text-xs font-semibold text-foreground">{m.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-xs text-muted mb-1 ml-1">Transaction Reference</Text>
            <TextInput
              placeholder="Ref Number (UPI ID, Check #, etc.)"
              placeholderTextColor={colors.muted}
              value={transactionRef}
              onChangeText={setTransactionRef}
              className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-4"
              style={{ backgroundColor: colors.surface }}
            />

            <Text className="text-xs text-muted mb-1 ml-1">Internal Notes</Text>
            <TextInput
              placeholder="Internal logs or memo..."
              placeholderTextColor={colors.muted}
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-6"
              style={{ backgroundColor: colors.surface }}
            />

            <Pressable
              onPress={handleSavePayment}
              className="p-4 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-white font-bold text-base">Save Payment Log</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Select Style Modal */}
      <Modal visible={isTemplateModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-bold text-foreground">Select PDF Template Style</Text>
              <Pressable onPress={() => setIsTemplateModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={colors.muted} />
              </Pressable>
            </View>

            {['classic', 'modern', 'corporate', 'minimal'].map((st) => (
              <Pressable
                key={st}
                onPress={() => handleUpdateTemplateStyle(st as any)}
                className="p-4 mb-3 rounded-2xl border border-border flex-row items-center justify-between"
                style={{ backgroundColor: invoice.template_style === st ? `${colors.primary}10` : colors.surface, borderColor: invoice.template_style === st ? colors.primary : colors.border }}
              >
                <Text className="text-base font-bold text-foreground capitalize">{st}</Text>
                {invoice.template_style === st && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
