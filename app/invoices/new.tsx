import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrencyDetails, SUPPORTED_CURRENCIES } from '@/lib/currency';

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
  const [visualRecreation, setVisualRecreation] = useState<any>(null);

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

  const clientScrollRef = useRef<ScrollView>(null);
  const handleClientInputFocus = (yOffset: number) => {
    setTimeout(() => {
      clientScrollRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 100);
  };

  // Organization configuration modal state
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [isOrgModalVisible, setIsOrgModalVisible] = useState(false);
  const [orgGst, setOrgGst] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgName, setOrgName] = useState('');
  const [hasPromptedOrg, setHasPromptedOrg] = useState(false);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Resolve user organization / freelancer context
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('org_id, organizations(*)')
        .eq('user_id', user!.id);

      const orgId = myOrgs && myOrgs.length > 0 ? myOrgs[0].org_id : null;
      if (orgId && myOrgs && myOrgs[0] && myOrgs[0].organizations) {
        const rawOrg = myOrgs[0].organizations;
        const org = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;
        if (org) {
          setOrgDetails(org);
          if (!editId && !duplicateId && org.default_currency) {
            setCurrency(org.default_currency);
          }
          if (!hasPromptedOrg && (!org.name || !org.address)) {
            setOrgName(org.name || '');
            setOrgGst(org.gst_number || '');
            setOrgAddress(org.address || '');
            setIsOrgModalVisible(true);
            setHasPromptedOrg(true);
          }
        }
      }

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
        setVisualRecreation(inv.visual_recreation || null);

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
          setVisualRecreation(draft.visual_recreation || null);

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

  const handleSaveOrgDetails = async () => {
    if (!orgName.trim() || !orgAddress.trim()) {
      Alert.alert('Validation Error', 'Company Name and Address are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName,
          gst_number: orgGst || null,
          address: orgAddress,
        })
        .eq('id', orgDetails.id);

      if (error) throw error;
      setOrgDetails((prev: any) => ({ ...prev, name: orgName, gst_number: orgGst, address: orgAddress }));
      setIsOrgModalVisible(false);
      Alert.alert('Success', 'Organization profile updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update organization profile');
    }
  };

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
      const year = new Date().getFullYear();
      const timestampSuffix = Date.now().toString().slice(-5);
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const generatedInvoiceNumber = `CF-${year}-${timestampSuffix}${randomSuffix}`;

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
        status: orgId ? 'sent' : 'draft',
        visual_recreation: visualRecreation,
        template_style: visualRecreation ? 'custom' : 'classic',
        // Only set invoice_number on create, keep existing on edit
        ...(!editId && { invoice_number: generatedInvoiceNumber }),
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
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
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
              <Text className="text-white font-bold text-sm">Save Invoice</Text>
            )}
          </Pressable>
        </View>
 
        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
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

        {/* Currency Selection */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Invoice Currency</Text>
          <View className="border border-border rounded-xl overflow-hidden py-2" style={{ backgroundColor: colors.surface }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
              {SUPPORTED_CURRENCIES.map((curr) => {
                const isSelected = currency === curr.code;
                return (
                  <Pressable
                    key={curr.code}
                    onPress={() => setCurrency(curr.code)}
                    className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                  >
                    <Text style={{ color: isSelected ? '#FFF' : '#7A7A92', fontSize: 12, fontWeight: '700' }}>
                      {curr.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
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
                  <Text className="text-[10px] font-bold text-muted uppercase mb-1 ml-1">Rate ({getCurrencyDetails(currency).symbol})</Text>
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
                  <Text className="text-[10px] font-bold text-muted uppercase mb-1 ml-1">Discount ({getCurrencyDetails(currency).symbol})</Text>
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
            <Text className="text-sm text-foreground font-semibold">{getCurrencyDetails(currency).symbol} {totals.subtotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-muted">CGST (9%)</Text>
            <Text className="text-sm text-foreground font-semibold">{getCurrencyDetails(currency).symbol} {totals.cgst.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-muted">SGST (9%)</Text>
            <Text className="text-sm text-foreground font-semibold">{getCurrencyDetails(currency).symbol} {totals.sgst.toFixed(2)}</Text>
          </View>

          <View className="flex-row justify-between mb-4 items-center">
            <Text className="text-sm text-muted">Additional Discount ({getCurrencyDetails(currency).symbol})</Text>
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
            <Text className="text-lg font-bold text-primary">{getCurrencyDetails(currency).symbol} {totals.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* AI OCR Visual Reconstruction Customizer */}
        {visualRecreation && (
          <View className="mb-6 p-5 rounded-3xl border border-border" style={{ backgroundColor: colors.surface }}>
            <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">AI Recreated Branding</Text>
            
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-3">
                {visualRecreation.logo_url ? (
                  <Image source={{ uri: visualRecreation.logo_url }} style={{ width: 42, height: 42, borderRadius: 10 }} />
                ) : (
                  <View className="w-10 h-10 rounded-xl bg-border items-center justify-center">
                    <Ionicons name="image-outline" size={20} color={colors.muted} />
                  </View>
                )}
                <View>
                  <Text className="text-sm font-bold text-foreground">Corporate Logo & Style</Text>
                  <Text className="text-xs text-muted">Font: {visualRecreation.font_family?.split(',')[0] || 'Default'}</Text>
                </View>
              </View>
              
              <View className="flex-row items-center gap-2">
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: visualRecreation.primary_color, borderWidth: 1, borderColor: colors.border }} />
                <Text className="text-xs font-mono font-bold text-foreground">{visualRecreation.primary_color}</Text>
              </View>
            </View>

            <View className="gap-3">
              <View>
                <Text className="text-[11px] font-bold text-muted mb-1 ml-1">Logo Image URL</Text>
                <TextInput
                  value={visualRecreation.logo_url}
                  onChangeText={(text) => setVisualRecreation((prev: any) => ({ ...prev, logo_url: text }))}
                  placeholder="Logo URL (https://...)"
                  placeholderTextColor={colors.muted}
                  className="px-3 py-2 rounded-xl border border-border text-sm text-foreground"
                  style={{ backgroundColor: colors.background }}
                />
              </View>

              <View>
                <Text className="text-[11px] font-bold text-muted mb-1 ml-1">Branding Hex Color</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={visualRecreation.primary_color}
                    onChangeText={(text) => setVisualRecreation((prev: any) => ({ ...prev, primary_color: text }))}
                    placeholder="#4F46E5"
                    placeholderTextColor={colors.muted}
                    className="flex-1 px-3 py-2 rounded-xl border border-border text-sm text-foreground font-mono"
                    style={{ backgroundColor: colors.background }}
                  />
                  <View className="flex-row gap-1">
                    {['#4F46E5', '#FF6B4A', '#10B981', '#3B82F6', '#111118'].map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setVisualRecreation((prev: any) => ({ ...prev, primary_color: c }))}
                        className="w-6 h-6 rounded-full border border-white/20"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Client Modal */}
      <Modal visible={isClientModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-lg font-bold text-foreground">Add New Client</Text>
                <Pressable onPress={() => setIsClientModalVisible(false)}>
                  <Ionicons name="close-circle" size={24} color={colors.muted} />
                </Pressable>
              </View>

              <ScrollView ref={clientScrollRef} showsVerticalScrollIndicator={false} className="max-h-96" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                <TextInput
                  placeholder="Client Name *"
                  placeholderTextColor={colors.muted}
                  value={newClientName}
                  onChangeText={setNewClientName}
                  onFocus={() => handleClientInputFocus(0)}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                  style={{ backgroundColor: colors.surface }}
                />
                <TextInput
                  placeholder="Company Name"
                  placeholderTextColor={colors.muted}
                  value={newClientCompany}
                  onChangeText={setNewClientCompany}
                  onFocus={() => handleClientInputFocus(50)}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                  style={{ backgroundColor: colors.surface }}
                />
                <TextInput
                  placeholder="Email Address"
                  placeholderTextColor={colors.muted}
                  value={newClientEmail}
                  onChangeText={setNewClientEmail}
                  onFocus={() => handleClientInputFocus(110)}
                  keyboardType="email-address"
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                  style={{ backgroundColor: colors.surface }}
                />
                <TextInput
                  placeholder="Phone Number"
                  placeholderTextColor={colors.muted}
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  onFocus={() => handleClientInputFocus(170)}
                  keyboardType="phone-pad"
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                  style={{ backgroundColor: colors.surface }}
                />
                <TextInput
                  placeholder="GSTIN Number"
                  placeholderTextColor={colors.muted}
                  value={newClientGst}
                  onChangeText={setNewClientGst}
                  onFocus={() => handleClientInputFocus(230)}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-3"
                  style={{ backgroundColor: colors.surface }}
                />
                <TextInput
                  placeholder="Address Details"
                  placeholderTextColor={colors.muted}
                  value={newClientAddress}
                  onChangeText={setNewClientAddress}
                  onFocus={() => handleClientInputFocus(290)}
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Organization Setup Modal */}
      <Modal visible={isOrgModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-foreground">Configure Billed From Details</Text>
                <Pressable 
                  onPress={() => setIsOrgModalVisible(false)}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <Text className="text-xs text-muted mb-4">
                Your organization profile is incomplete. Please set up your company details once. These will be automatically populated on all future invoices.
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} className="max-h-96" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Company Name *</Text>
                <TextInput
                  placeholder="CoreFlow Labs Ltd"
                  placeholderTextColor={colors.muted}
                  value={orgName}
                  onChangeText={setOrgName}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-4"
                  style={{ backgroundColor: colors.surface }}
                />

                <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Company Address *</Text>
                <TextInput
                  placeholder="Mumbai, Maharashtra, India"
                  placeholderTextColor={colors.muted}
                  value={orgAddress}
                  onChangeText={setOrgAddress}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-4"
                  style={{ backgroundColor: colors.surface }}
                />

                <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">GSTIN Tax Details</Text>
                <TextInput
                  placeholder="27CFFLOW1234A1Z9"
                  placeholderTextColor={colors.muted}
                  value={orgGst}
                  onChangeText={setOrgGst}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-6"
                  style={{ backgroundColor: colors.surface }}
                />
              </ScrollView>

              <Pressable
                onPress={handleSaveOrgDetails}
                className="p-4 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-white font-bold text-base">Save Company Profile</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  </ScreenContainer>
  );
}
