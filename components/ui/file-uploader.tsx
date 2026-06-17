import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';

interface FileUploaderProps {
  projectId?: string;
  onUploadSuccess?: () => void;
  bucket?: string;
}

export function FileUploader({ projectId, onUploadSuccess, bucket = 'project-files' }: FileUploaderProps) {
  const { user } = useAuth();
  const colors = useColors();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handlePickDocument = async () => {
    if (!user || !user.organizationId) {
      Alert.alert('Error', 'You must belong to an organization to upload files.');
      return;
    }
    if (uploading) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      await uploadFile(asset.uri, asset.name, asset.size || 0, asset.mimeType || 'application/octet-stream');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Pick Error', 'Could not open document picker.');
    }
  };

  const uploadFile = async (uri: string, name: string, size: number, mimeType: string) => {
    setUploading(true);
    setProgress(0);

    try {
      // 1. Fetch file content as blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create unique path: orgId / [projectId or general] / timestamp-filename
      const sanitizeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folder = projectId ? `projects/${projectId}` : 'general';
      const path = `${user?.organizationId}/${folder}/${Date.now()}-${sanitizeName}`;

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 3. Record file metadata in public.files table
      const { error: dbError } = await supabase
        .from('files')
        .insert({
          org_id: user?.organizationId,
          project_id: projectId || null,
          uploader_id: user?.id,
          bucket,
          storage_path: path,
          file_name: name,
          file_size: size,
          mime_type: mimeType,
        });

      if (dbError) throw dbError;

      // Log activity
      await supabase.from('activity_logs').insert({
        org_id: user?.organizationId,
        actor_id: user?.id,
        action: 'file_uploaded',
        entity_type: 'file',
        new_value: { file_name: name, project_id: projectId || null },
      });

      Alert.alert('Upload Successful', `"${name}" has been uploaded.`);
      onUploadSuccess?.();
    } catch (err: any) {
      console.error('Upload error:', err);
      Alert.alert('Upload Failed', err.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePickDocument}
      disabled={uploading}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed || uploading ? 0.8 : 1,
        },
      ]}
    >
      {uploading ? (
        <View style={styles.content}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 8 }} />
          <Text style={[styles.text, { color: colors.foreground }]}>Uploading file...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Ionicons name="cloud-upload-outline" size={36} color={colors.primary} style={{ marginBottom: 8 }} />
          <Text style={[styles.title, { color: colors.foreground }]}>Upload Files</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Tap to select PDF, images, or documents
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
