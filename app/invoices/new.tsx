import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Client {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  gst_number?: string;
}

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  discount: number;
  hsn_code: string;
  sac_code: string;
  unit: string;
  tax_rate: number; // e.g. 18 for 18%
  tax_amount: number;
  amount: number;
}

export default function NewInvoiceScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const { editId, duplicateId, ocr } = useLocalSearchParams<{ editId?: string; duplicateId?: string; ocr?: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  
  // Invoice form state
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [currency, setCurrency] = useState('INR');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('monthly');
  const [billReferenceId, setBillReferenceId] = useState<string | null>(null);

  // Line Items state
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, rate: 0, discount: 0, hsn_code: '', sac_code: '', unit: 'units', tax_rate: 18, tax_amount: 0, amount: 0 }
  ]);

  // Client modal state
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientGst, setNewClientGst] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Resolve user organization / freelancer context
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('org_id')
        .eq('user_id', user!.id);

      const orgId = myOrgs && myOrgs.length > 0 ? myOrgs[0].org_id : null;

      // 2. Fetch Clients
      let clientQuery = supabase.from('clients').select('*').eq('is_deleted', false);
      if (orgId) {
        clientQuery = clientQuery.eq('organization_id', orgId);
      } else {
        clientQuery = clientQuery.eq('owner_id', user!.id).is('organization_id', null);
      }
      const { data: clientData, error: clientError } = await clientQuery;
      if (clientError) throw clientError;
      setClients(clientData || []);

      // 3. Handle editId, duplicateId or OCR pre-fill
      if (editId || duplicateId) {
        const targetId = editId || duplicateId;
        const { data: inv, error: invError } = await supabase
          .from('invoices')
          .select('*, invoice_items(*)')
          .eq('id', targetId)
          .single();

        if (invError) throw invError;

        setSelectedClientId(inv.client_id);
        setCurrency(inv.currency);
        setDiscountAmount(Number(inv.discount_amount));
        setIsRecurring(inv.is_recurring);
        setRecurringFrequency(inv.recurring_frequency || 'monthly');
        setBillReferenceId(inv.bill_reference_id);

        if (!duplicateId) {
          // If we are editing, keep dates
          setIssueDate(inv.issue_date);
          setDueDate(inv.due_date);
        }

        if (inv.invoice_items && inv.invoice_items.length > 0) {
          setItems(inv.invoice_items.map((it: any) => ({
            id: duplicateId ? undefined : it.id,
            description: it.description,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            discount: Number(it.discount || 0),
            hsn_code: it.hsn_code || '',
            sac_code: it.sac_code || '',
            unit: it.unit || 'units',
            tax_rate: Number(it.tax_rate || 0),
            tax_amount: Number(it.tax_amount || 0),
            amount: Number(it.amount),
          })));
        }
      } else if (ocr === 'true') {
        const storedStr = await AsyncStorage.getItem('cf_ocr_draft');
        if (storedStr) {
          const draft = JSON.parse(storedStr);
          setBillReferenceId(draft.billReferenceId || null);
          setCurrency(draft.currency || 'INR');
          setDiscountAmount(Number(draft.discount_amount || 0));

          // Try to match or create vendor client
          const existingVendor = (clientData || []).find((c: any) => c.name.toLowerCase().includes(draft.vendor_name.toLowerCase()));
          if (existingVendor) {
            setSelectedClientId(existingVendor.id);
          } else {
            // Setup vendor details inside the client modal state so it's ready to create
            setNewClientName(draft.vendor_name);
            setNewClientGst(draft.gst_number || '');
            setNewClientCompany(draft.vendor_name);
            setIsClientModalVisible(true);
          }

          if (draft.items && draft.items.length > 0) {
            setItems(draft.items.map((it: any) => {
              const qty = Number(it.quantity || 1);
              const rt = Number(it.rate || 0);
              const disc = Number(it.discount || 0);
              const tr = Number(it.tax_rate || 18);
              const baseAmt = (qty * rt) - disc;
              const taxAmt = baseAmt * (tr / 100);
              return {
                description: it.description,
                quantity: qty,
                rate: rt,
                discount: disc,
                hsn_code: it.hsn_code || '9984',
                sac_code: it.sac_code || '',
                unit: 'units',
                tax_rate: tr,
                tax_amount: taxAmt,
                amount: baseAmt,
              };
            }));
          }
          await AsyncStorage.removeItem('cf_ocr_draft');
        }
      }
    } catch (e: any) {
      console.error('[NewInvoice] Error loading initial data:', e);
      Alert.alert('Error', e.message || 'Failed to load client information');
    } finally {
      setIsLoading(false);
    }
  }, [user, editId, duplicateId, ocr]);

  useEffect(() => {
    let frameId: number;
    if (user) {
      frameId = requestAnimationFrame(() => {
        loadInitialData();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [user, editId, duplicateId, ocr, loadInitialData]);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Validation Error', 'Client name is required');
      return;
    }

    try {
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('org_id')
        .eq('user_id', user!.id);

      const orgId = myOrgs && myOrgs.length > 0 ? myOrgs[0].org_id : null;

      const { data: client, error } = await supabase
        .from('clients')
        .insert({
          organization_id: orgId,
          owner_id: user!.id,
          name: newClientName,
          company_name: newClientCompany || null,
          email: newClientEmail || null,
          phone: newClientPhone || null,
          gst_number: newClientGst || null,
          address: newClientAddress || null,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      setClients(prev => [...prev, client]);
      setSelectedClientId(client.id);
      setIsClientModalVisible(false);

      // Reset fields
      setNewClientName('');
      setNewClientCompany('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientGst('');
      setNewClientAddress('');

      Alert.alert('Success', 'Client added successfully');
    } catch (e: any) {
      console.error('[NewInvoice] Error creating client:', e);
      Alert.alert('Error', e.message || 'Failed to create client');
    }
  };

  const updateItemField = (index: number, field: keyof LineItem, val: any) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index] };

      if (field === 'quantity') {
        item.quantity = Number(val) || 0;
      } else if (field === 'rate') {
        item.rate = Number(val) || 0;
      } else if (field === 'discount') {
        item.discount = Number(val) || 0;
      } else if (field === 'tax_rate') {
        item.tax_rate = Number(val) || 0;
      } else {
        (item as any)[field] = val;
      }

      // Calculate totals
      const sub = (item.quantity * item.rate) - item.discount;
      item.tax_amount = sub * (item.tax_rate / 100);
      item.amount = sub;

      newItems[index] = item;
      return newItems;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { description: '', quantity: 1, rate: 0, discount: 0, hsn_code: '', sac_code: '', unit: 'units', tax_rate: 18, tax_amount: 0, amount: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    items.forEach(it => {
      const lineSub = (it.quantity * it.rate) - it.discount;
      subtotal += lineSub;
      taxAmount += lineSub * (it.tax_rate / 100);
    });

    const total = subtotal + taxAmount - discountAmount;

    // Splitting tax to CGST/SGST (9% + 9%) or IGST (18%) for simple rendering
    const cgst = taxAmount / 2;
    const sgst = taxAmount / 2;

    return {
      subtotal,
      taxAmount,
      total: total < 0 ? 0 : total,
      cgst,
      sgst,
    };
  };

  const totals = calculateInvoiceTotals();

  const handleSaveInvoice = async () => {
    if (!selectedClientId) {
      Alert.alert('Validation Error', 'Please select a client');
      return;
    }

    if (items.some(it => !it.description.trim() || it.quantity <= 0 || it.rate <= 0)) {
      Alert.alert('Validation Error', 'Please fill description, quantity, and rate for all items.');
      return;
    }

    setIsSaving(true);
    try {
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('org_id')
        .eq('user_id', user!.id);

      const orgId = myOrgs && myOrgs.length > 0 ? myOrgs[0].org_id : null;

      // 1. Prepare Invoice values
      const invoiceData = {
        organization_id: orgId,
        owner_id: user!.id,
        client_id: selectedClientId,
        bill_reference_id: billReferenceId,
        currency,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: discountAmount,
        total_amount: totals.total,
        balance_due: totals.total, // initially entire amount is due
        cgst: totals.cgst,
        sgst: totals.sgst,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? recurringFrequency : null,
        creator_id: user!.id,
        status: 'draft',
      };

      let invoiceId = '';

      if (editId) {
        // Update Invoice
        const { error: invError } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editId);

        if (invError) throw invError;
        invoiceId = editId;

        // Delete old items
        const { error: delError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', editId);
        if (delError) throw delError;
      } else {
        // Insert Invoice (trigger generates CF-YYYY-XXXXX automatically if number is null)
        const { data: newInv, error: invError } = await supabase
          .from('invoices')
          .insert(invoiceData)
          .select()
          .single();

        if (invError) throw invError;
        invoiceId = newInv.id;
      }

      // 2. Insert items
      const itemsData = items.map(it => ({
        invoice_id: invoiceId,
        description: it.description,
        quantity: it.quantity,
        rate: it.rate,
        discount: it.discount,
        hsn_code: it.hsn_code || null,
        sac_code: it.sac_code || null,
        unit: it.unit || 'units',
        tax_rate: it.tax_rate,
        tax_amount: it.tax_amount,
        amount: it.amount,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      // Trigger recalculation dynamically via function (in case trigger lags or we want local update guarantee)
      await supabase.rpc('recalculate_invoice_totals', { p_invoice_id: invoiceId });

      Alert.alert(
        'Success',
        `Invoice successfully ${editId ? 'updated' : 'created'}!`,
        [{ text: 'OK', onPress: () => router.replace('/invoices' as any) }]
      );
    } catch (e: any) {
      console.error('[NewInvoice] Save error:', e);
      Alert.alert('Error', e.message || 'Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">
            {editId ? 'Edit Invoice' : duplicateId ? 'Duplicate Invoice' : 'New Invoice'}
          </Text>
        </View>
        
        <Pressable
          disabled={isSaving}
          onPress={handleSaveInvoice}
          className="px-5 py-2.5 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text className="text-white font-bold text-sm">Save Draft</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Client Selection */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Client Information</Text>
          <View className="flex-row items-center">
            <View className="flex-1 rounded-2xl border border-border overflow-hidden mr-3" style={{ backgroundColor: colors.surface }}>
              <View className="px-4 py-3 flex-row items-center justify-between">
                <TextInput
                  placeholder="Select Client..."
                  placeholderTextColor={colors.muted}
                  value={clients.find(c => c.id === selectedClientId)?.name || ''}
                  editable={false}
                  className="text-base text-foreground flex-1"
                />
                <Ionicons name="chevron-down" size={18} color={colors.muted} />
              </View>
              {/* Simple inline client dropdown list */}
              {clients.length > 0 && (
                <View className="border-t border-border px-1 py-1 max-h-32">
                  <ScrollView nestedScrollEnabled>
                    {clients.map(c => (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedClientId(c.id)}
                        className="p-2.5 rounded-lg mb-1"
                        style={{ backgroundColor: selectedClientId === c.id ? `${colors.primary}15` : 'transparent' }}
                      >
                        <Text className="text-sm font-semibold text-foreground">{c.name}</Text>
                        {c.company_name && <Text className="text-[11px] text-muted">{c.company_name}</Text>}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => setIsClientModalVisible(true)}
              className="w-12 h-12 rounded-2xl items-center justify-center border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Invoice details */}
        <View className="flex-row mb-6">
          <View className="flex-1 mr-3">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Issue Date</Text>
            <TextInput
              value={issueDate}
              onChangeText={setIssueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              className="px-4 py-3 rounded-2xl border border-border text-base text-foreground"
              style={{ backgroundColor: colors.surface }}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Due Date</Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              className="px-4 py-3 rounded-2xl border border-border text-base text-foreground"
              style={{ backgroundColor: colors.surface }}
            />
          </View>
        </View>

        {/* Line Items Section */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Line Items</Text>
          {items.map((item, idx) => (
            <View key={idx} className="p-4 mb-4 rounded-3xl border border-border" style={{ backgroundColor: colors.surface }}>
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-sm font-bold text-primary">Item #{idx + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => handleRemoveItem(idx)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                )}
              </View>

              <TextInput
                placeholder="Item Description..."
                placeholderTextColor={colors.muted}
                value={item.description}
                onChangeText={(val) => updateItemField(idx, 'description', val)}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                style={{ backgroundColor: `${colors.background}` }}
              />

              <View className="flex-row mb-3">
                <View className="flex-1 mr-2">
                  <Text className="text-[10px] font-bold text-muted uppercase mb-1 ml-1">Quantity</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    value={item.quantity.toString()}
                    onChangeText={(val) => updateItemField(idx, 'quantity', val)}
                    className="px-3 py-2 rounded-xl border border-border text-sm text-foreground"
                    style={{ backgroundColor: `${colors.background}` }}
                  />
                </View>
                <View className="flex-1 mr-2">
                  <Text className="text-[10px] font-bold text-muted uppercase mb-1 ml-1">Rate (₹)</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    value={item.rate.toString()}
                    onChangeText={(val) => updateItemField(idx, 'rate', val)}
                    className="px-3 py-2 rounded-xl border border-border text-sm text-foreground"
                    style={{ backgroundColor: `${colors.background}` }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-muted uppercase mb-1 ml-1">GST (%)</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="18"
                    placeholderTextColor={colors.muted}
                    value={item.tax_rate.toString()}
                    onChangeText={(val) => updateItemField(idx, 'tax_rate', val)}
                    className="px-3 py-2 rounded-xl border border-border text-sm text-foreground"
                    style={{ backgroundColor: `${colors.background}` }}
                  />
                </View>
              </View>

              <View className="flex-row">
                <View className="flex-1 mr-2">
                  <Text className="text-[10px] font-bold text-muted uppercase mb-1 ml-1">HSN Code</Text>
                  <TextInput
                    placeholder="9984"
                    placeholderTextColor={colors.muted}
                    value={item.hsn_code}
                    onChangeText={(val) => updateItemField(idx, 'hsn_code', val)}
                    className="px-3 py-2 rounded-xl border border-border text-sm text-foreground"
                    style={{ backgroundColor: `${colors.background}` }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-muted uppercase mb-1 ml-1">Discount (₹)</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    value={item.discount.toString()}
                    onChangeText={(val) => updateItemField(idx, 'discount', val)}
                    className="px-3 py-2 rounded-xl border border-border text-sm text-foreground"
                    style={{ backgroundColor: `${colors.background}` }}
                  />
                </View>
              </View>
            </View>
          ))}

          <Pressable
            onPress={handleAddItem}
            className="p-4 rounded-2xl items-center justify-center border border-dashed border-primary/50 flex-row"
            style={{ backgroundColor: `${colors.primary}08` }}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} className="mr-2" />
            <Text className="text-primary font-bold text-sm">Add Another Item</Text>
          </Pressable>
        </View>

        {/* Totals Breakdown */}
        <View className="p-5 rounded-3xl border border-border mb-6" style={{ backgroundColor: colors.surface }}>
          <Text className="text-sm font-bold text-foreground mb-4">Summary Breakdown</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-muted">Subtotal</Text>
            <Text className="text-sm text-foreground font-semibold">₹ {totals.subtotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-muted">CGST (9%)</Text>
            <Text className="text-sm text-foreground font-semibold">₹ {totals.cgst.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-muted">SGST (9%)</Text>
            <Text className="text-sm text-foreground font-semibold">₹ {totals.sgst.toFixed(2)}</Text>
          </View>

          <View className="flex-row justify-between mb-4 items-center">
            <Text className="text-sm text-muted">Additional Discount (₹)</Text>
            <TextInput
              keyboardType="numeric"
              value={discountAmount.toString()}
              onChangeText={(val) => setDiscountAmount(Number(val) || 0)}
              className="px-3 py-1 rounded-lg border border-border text-sm text-foreground w-24 text-right"
              style={{ backgroundColor: colors.background }}
            />
          </View>
          <View className="border-t border-border pt-4 flex-row justify-between">
            <Text className="text-base font-bold text-foreground">Grand Total</Text>
            <Text className="text-lg font-bold text-primary">₹ {totals.total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Client Modal */}
      <Modal visible={isClientModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-bold text-foreground">Add New Client</Text>
              <Pressable onPress={() => setIsClientModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-96">
              <TextInput
                placeholder="Client Name *"
                placeholderTextColor={colors.muted}
                value={newClientName}
                onChangeText={setNewClientName}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                style={{ backgroundColor: colors.surface }}
              />
              <TextInput
                placeholder="Company Name"
                placeholderTextColor={colors.muted}
                value={newClientCompany}
                onChangeText={setNewClientCompany}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                style={{ backgroundColor: colors.surface }}
              />
              <TextInput
                placeholder="Email Address"
                placeholderTextColor={colors.muted}
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                keyboardType="email-address"
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                style={{ backgroundColor: colors.surface }}
              />
              <TextInput
                placeholder="Phone Number"
                placeholderTextColor={colors.muted}
                value={newClientPhone}
                onChangeText={setNewClientPhone}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                style={{ backgroundColor: colors.surface }}
              />
              <TextInput
                placeholder="GSTIN Number"
                placeholderTextColor={colors.muted}
                value={newClientGst}
                onChangeText={setNewClientGst}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                style={{ backgroundColor: colors.surface }}
              />
              <TextInput
                placeholder="Address Details"
                placeholderTextColor={colors.muted}
                value={newClientAddress}
                onChangeText={setNewClientAddress}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-6"
                style={{ backgroundColor: colors.surface }}
              />
            </ScrollView>

            <Pressable
              onPress={handleCreateClient}
              className="p-4 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-white font-bold text-base">Add Client</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
