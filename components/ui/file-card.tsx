import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';
import { safeFormatDistanceToNow } from '@/lib/utils';
import * as Sharing from 'expo-sharing';

export interface FileData {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  bucket: string;
  created_at: string;
  uploader_id?: string;
  project_id?: string | null;
  uploader?: {
    full_name: string;
  };
}

interface FileCardProps {
  file: FileData;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

export function FileCard({ file, onDelete, canDelete = false }: FileCardProps) {
  const colors = useColors();

  // Helper to format file size
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Get matching icon name for mime type
  const getFileIcon = (mimeType: string): keyof typeof Ionicons.glyphMap => {
    if (!mimeType) return 'document-outline';
    if (mimeType.startsWith('image/')) return 'image-outline';
    if (mimeType.startsWith('video/')) return 'videocam-outline';
    if (mimeType.startsWith('audio/')) return 'volume-medium-outline';
    if (mimeType.includes('pdf')) return 'document-text-outline';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) return 'archive-outline';
    if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || mimeType.includes('css') || mimeType.includes('json')) return 'code-slash-outline';
    return 'document-outline';
  };

  const handleOpen = async () => {
    // We construct the URL to download or view the file from Supabase Storage
    const storageUrl = `https://rltygdzldplkmwuqfadm.supabase.co/storage/v1/object/authenticated/${file.bucket}/${file.storage_path}`;
    
    try {
      const supported = await Linking.canOpenURL(storageUrl);
      if (supported) {
        await Linking.openURL(storageUrl);
      } else {
        Alert.alert('Cannot Open', 'Your device does not support opening this URL.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to open file.');
    }
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}12` }]}>
        <Ionicons name={getFileIcon(file.mime_type)} size={24} color={colors.primary} />
      </View>

      <View style={styles.details}>
        <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
          {file.file_name}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {formatBytes(file.file_size)} • {safeFormatDistanceToNow(file.created_at, { addSuffix: true })}
        </Text>
        {file.uploader && (
          <Text style={[styles.uploader, { color: colors.muted }]}>
            Uploaded by: <Text style={{ fontWeight: '600', color: colors.foreground }}>{file.uploader.full_name}</Text>
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {canDelete && onDelete && (
          <Pressable
            onPress={() => onDelete(file.id)}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        )}
        <Pressable
          onPress={handleOpen}
          style={styles.actionBtn}
          hitSlop={8}
        >
          <Ionicons name="open-outline" size={18} color={colors.foreground} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  details: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    marginBottom: 2,
  },
  uploader: {
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
  },
});
