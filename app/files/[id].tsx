import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { safeFormatDistanceToNow } from '@/lib/utils';
import { FileData } from '@/components/ui/file-card';
import { PremiumButton } from '@/components/ui/premium-button';

export default function FileDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const router = useRouter();

  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFileDetail = async () => {
      try {
        const { data, error } = await supabase
          .from('files')
          .select(`
            id,
            file_name,
            file_size,
            mime_type,
            storage_path,
            bucket,
            created_at,
            uploader_id,
            project_id,
            uploader:uploader_id (
              full_name
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setFile(data as unknown as FileData);
      } catch (e: any) {
        console.error(e);
        Alert.alert('Error', 'Failed to retrieve file details.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchFileDetail();
  }, [id]);

  const handleOpenFile = async () => {
    if (!file) return;
    const storageUrl = `https://rltygdzldplkmwuqfadm.supabase.co/storage/v1/object/authenticated/${file.bucket}/${file.storage_path}`;
    try {
      await Linking.openURL(storageUrl);
    } catch (e) {
      Alert.alert('Error', 'Unable to open file link on this device.');
    }
  };

  const getFileIcon = (mimeType?: string): keyof typeof Ionicons.glyphMap => {
    if (!mimeType) return 'document-outline';
    if (mimeType.startsWith('image/')) return 'image-outline';
    if (mimeType.startsWith('video/')) return 'videocam-outline';
    if (mimeType.startsWith('audio/')) return 'volume-medium-outline';
    if (mimeType.includes('pdf')) return 'document-text-outline';
    if (mimeType.includes('zip') || mimeType.includes('tar')) return 'archive-outline';
    return 'document-outline';
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!file) return null;

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>File Details</Text>
      </View>

      <View style={styles.content}>
        {/* File Preview Card Icon */}
        <View style={[styles.previewPlaceholder, { backgroundColor: `${colors.primary}08`, borderColor: colors.border }]}>
          <Ionicons name={getFileIcon(file.mime_type)} size={80} color={colors.primary} />
          <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={2}>
            {file.file_name}
          </Text>
          <Text style={[styles.fileSize, { color: colors.muted }]}>
            {formatBytes(file.file_size)}
          </Text>
        </View>

        {/* Info Grid */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Mime Type</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{file.mime_type || 'Unknown'}</Text>
          </View>
          
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Uploaded</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {safeFormatDistanceToNow(file.created_at, { addSuffix: true })}
            </Text>
          </View>

          {file.uploader && (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Uploaded By</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{file.uploader.full_name}</Text>
            </View>
          )}

          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Context</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {file.project_id ? 'Project Attached' : 'General Organization'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <PremiumButton
            variant="primary"
            size="lg"
            onPress={handleOpenFile}
            style={{ width: '100%', marginBottom: 12 }}
          >
            <Ionicons name="open-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            Open Attachment
          </PremiumButton>

          <PremiumButton
            variant="outline"
            size="lg"
            onPress={() => {
              const storageUrl = `https://rltygdzldplkmwuqfadm.supabase.co/storage/v1/object/authenticated/${file.bucket}/${file.storage_path}`;
              Linking.openURL(storageUrl);
            }}
            style={{ width: '100%' }}
          >
            <Ionicons name="download-outline" size={20} color={colors.foreground} style={{ marginRight: 8 }} />
            Download File
          </PremiumButton>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  previewPlaceholder: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  actions: {
    marginTop: 'auto',
    marginBottom: 40,
  },
});
