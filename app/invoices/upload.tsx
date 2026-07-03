import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ExtractionStage {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

export default function BillUploadScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stages, setStages] = useState<ExtractionStage[]>([
    { id: 1, label: 'Uploading File', status: 'pending' },
    { id: 2, label: 'Reading File Structure', status: 'pending' },
    { id: 3, label: 'Detecting Vendor & Client Details', status: 'pending' },
    { id: 4, label: 'Extracting Line Items & HSN/SAC Codes', status: 'pending' },
    { id: 5, label: 'Calculating Totals & GST Taxes', status: 'pending' },
    { id: 6, label: 'Building Invoice Draft', status: 'pending' },
  ]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          size: file.size || 0,
          mimeType: file.mimeType || 'application/pdf',
          isImage: file.mimeType?.startsWith('image/') || file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg'),
        });
      }
    } catch (err) {
      console.error('[Upload] Error picking document:', err);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need gallery permissions to select and edit images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Enable crop and edit functionality
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `invoice_bill_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          mimeType: asset.mimeType || 'image/jpeg',
          isImage: true,
        });
      }
    } catch (err) {
      console.error('[Upload] Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const runSimulatedOCR = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    
    // Reset stages
    setStages(prev => prev.map(s => ({ ...s, status: 'pending' })));

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      // Stage 1: Uploading
      setStages(prev => prev.map(s => s.id === 1 ? { ...s, status: 'active' } : s));
      await delay(1200);
      setStages(prev => prev.map(s => s.id === 1 ? { ...s, status: 'completed' } : s));

      // Stage 2: Reading File
      setStages(prev => prev.map(s => s.id === 2 ? { ...s, status: 'active' } : s));
      await delay(1000);
      setStages(prev => prev.map(s => s.id === 2 ? { ...s, status: 'completed' } : s));

      // Stage 3: Detecting Vendor
      setStages(prev => prev.map(s => s.id === 3 ? { ...s, status: 'active' } : s));
      await delay(1000);
      setStages(prev => prev.map(s => s.id === 3 ? { ...s, status: 'completed' } : s));

      // Stage 4: Extracting Items
      setStages(prev => prev.map(s => s.id === 4 ? { ...s, status: 'active' } : s));
      await delay(1200);
      setStages(prev => prev.map(s => s.id === 4 ? { ...s, status: 'completed' } : s));

      // Stage 5: Calculating Totals
      setStages(prev => prev.map(s => s.id === 5 ? { ...s, status: 'active' } : s));
      await delay(800);
      setStages(prev => prev.map(s => s.id === 5 ? { ...s, status: 'completed' } : s));

      // Stage 6: Building Draft
      setStages(prev => prev.map(s => s.id === 6 ? { ...s, status: 'active' } : s));
      await delay(800);
      setStages(prev => prev.map(s => s.id === 6 ? { ...s, status: 'completed' } : s));

      // Resolve user organization context for default assignment
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('org_id, organizations(default_currency)')
        .eq('user_id', user!.id);

      const orgId = myOrgs && myOrgs.length > 0 ? myOrgs[0].org_id : null;
      let defaultCurrency = 'USD';
      if (myOrgs && myOrgs[0]?.organizations) {
        const rawOrg = myOrgs[0].organizations;
        const org = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;
        if (org && org.default_currency) {
          defaultCurrency = org.default_currency;
        }
      }

      // Mock Extracted Data matching the OCR specifications
      const mockExtractedData = {
        vendor_name: 'Acme Corporates Ltd',
        gst_number: '',
        invoice_number: 'ACME-' + Math.floor(1000 + Math.random() * 9000),
        currency: defaultCurrency,
        items: [
          { description: 'Premium Cloud Server Hosting (Standard Tier)', quantity: 1, rate: 8500, hsn_code: '9984', tax_rate: 18 },
          { description: 'Dedicated Database Migration Consultations', quantity: 4, rate: 2500, hsn_code: '9983', tax_rate: 18 },
        ],
        discount_amount: 500,
        notes: 'Extracted automatically from Acme Corporates invoice bill reference file.',
        visual_recreation: {
          logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
          primary_color: '#4F46E5', // Acme Corporate Indigo
          background_color: '#FFFFFF',
          font_family: 'Georgia, Times, serif',
          border_style: '1px solid #E5E7EB',
          header_style: 'corporate',
          layout_type: 'grid',
        }
      };

      // 1. Create a record in public.bill_references table
      const { data: billData, error: billError } = await supabase
        .from('bill_references')
        .insert({
          organization_id: orgId,
          owner_id: user!.id,
          storage_bucket: 'bills',
          storage_path: `uploads/${user!.id}/${Date.now()}_${selectedFile.name}`,
          file_name: selectedFile.name,
          file_size: selectedFile.size || 0,
          mime_type: selectedFile.mimeType || 'application/pdf',
          processing_status: 'completed',
          extracted_data: mockExtractedData,
        })
        .select()
        .single();

      if (billError) throw billError;

      // 2. Save extracted data to AsyncStorage so the new screen can pick it up
      await AsyncStorage.setItem('cf_ocr_draft', JSON.stringify({
        billReferenceId: billData.id,
        ...mockExtractedData,
      }));

      Alert.alert(
        'Extraction Complete',
        'Acme Corporates invoice successfully parsed! Click OK to review and save the invoice draft.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push('/invoices/new?ocr=true' as any);
            }
          }
        ]
      );
    } catch (e: any) {
      console.error('[OCR] Error running mock OCR:', e);
      Alert.alert('Extraction Failed', e.message || 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row items-center">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Upload Bill Reference</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12 }}>
        {!isProcessing ? (
          <View>
            <Text className="text-sm text-muted mb-6">
              Upload an invoice document or receipt image. Our secure enterprise OCR parsing engine will extract line items, HSN codes, and GST rates automatically to create your draft.
            </Text>

            {/* Selected File Preview */}
            {selectedFile ? (
              <View className="mb-6 p-4 rounded-3xl border border-border items-center justify-center" style={{ backgroundColor: colors.surface }}>
                {selectedFile.isImage ? (
                  <View className="w-full mb-3 rounded-2xl overflow-hidden border border-border">
                    <Image 
                      source={{ uri: selectedFile.uri }} 
                      style={{ width: '100%', height: 250 }} 
                      resizeMode="contain" 
                    />
                  </View>
                ) : (
                  <Ionicons name="document-text" size={64} color={colors.primary} className="mb-3" />
                )}
                <Text className="text-base font-bold text-foreground mb-1 text-center">{selectedFile.name}</Text>
                <Text className="text-xs text-muted">
                  {selectedFile.size ? `${Math.round(selectedFile.size / 1024)} KB` : 'Edited Image'}
                </Text>
              </View>
            ) : (
              /* Picker Box Options */
              <View className="gap-4 mb-6">
                <Pressable
                  onPress={handlePickImage}
                  className="border-2 border-dashed rounded-3xl p-10 items-center justify-center"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Ionicons name="image-outline" size={48} color={colors.primary} className="mb-3" />
                  <Text className="text-base font-bold text-foreground mb-1">Pick Invoice Image</Text>
                  <Text className="text-xs text-muted">With crop, zoom & edit capability</Text>
                </Pressable>

                <Pressable
                  onPress={handlePickDocument}
                  className="border-2 border-dashed rounded-3xl p-8 items-center justify-center"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Ionicons name="document-attach-outline" size={32} color={colors.muted} className="mb-2" />
                  <Text className="text-sm font-bold text-foreground">Select PDF Document</Text>
                </Pressable>
              </View>
            )}

            {selectedFile && (
              <View className="flex-row">
                <Pressable
                  onPress={runSimulatedOCR}
                  className="flex-1 p-4 rounded-2xl items-center justify-center mr-3"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-white font-bold text-base">Run AI Parsing</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedFile(null)}
                  className="px-5 rounded-2xl items-center justify-center border border-border"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View className="py-8">
            <View className="items-center mb-8">
              <ActivityIndicator size="large" color={colors.primary} className="mb-4" />
              <Text className="text-lg font-bold text-foreground mb-1">AI OCR Extraction Running</Text>
              <Text className="text-sm text-muted">Please wait while we extract invoice data...</Text>
            </View>

            {/* Extraction Stages */}
            <View className="rounded-3xl border border-border p-6" style={{ backgroundColor: colors.surface }}>
              {stages.map((stage) => {
                let iconName: any = 'ellipse-outline';
                let iconColor = colors.muted;

                if (stage.status === 'completed') {
                  iconName = 'checkmark-circle';
                  iconColor = '#10B981';
                } else if (stage.status === 'active') {
                  iconName = 'sync-outline';
                  iconColor = colors.primary;
                }

                return (
                  <View key={stage.id} className="flex-row items-center py-3">
                    <View className="mr-3">
                      {stage.status === 'active' ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name={iconName} size={20} color={iconColor} />
                      )}
                    </View>
                    <Text 
                      className="text-sm font-medium flex-1"
                      style={{ 
                        color: stage.status === 'completed' ? colors.foreground : 
                               stage.status === 'active' ? colors.primary : colors.muted,
                        fontWeight: stage.status === 'active' ? 'bold' : 'normal'
                      }}
                    >
                      {stage.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
