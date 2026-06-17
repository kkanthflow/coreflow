import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';

interface AvatarUploadProps {
  size?: number;
  editable?: boolean;
  onUploaded?: (url: string) => void;
}

export function AvatarUpload({ size = 72, editable = true, onUploaded }: AvatarUploadProps) {
  const { user, updateAvatar } = useAuth();
  const colors = useColors();
  const [uploading, setUploading] = useState(false);

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const handlePress = async () => {
    if (!editable || uploading) return;

    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to update your avatar.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    await uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg');
  };

  const uploadAvatar = async (uri: string, mimeType: string) => {
    if (!user) return;
    setUploading(true);

    try {
      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      const ext = mimeType.split('/')[1] || 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // Update local auth state
      updateAvatar(publicUrl);
      onUploaded?.(publicUrl);
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const avatarSize = size;
  const badgeSize = Math.round(size * 0.33);
  const fontSize = Math.round(size * 0.33);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!editable || uploading}
      style={({ pressed }) => [
        styles.container,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {user?.avatarUrl ? (
        <Image
          source={{ uri: user.avatarUrl }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: colors.primary,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize, color: '#FFFFFF' }]}>
            {initials}
          </Text>
        </View>
      )}

      {uploading && (
        <View
          style={[
            styles.overlay,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
        >
          <ActivityIndicator color="#FFFFFF" size="small" />
        </View>
      )}

      {editable && !uploading && (
        <View
          style={[
            styles.editBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: 0,
              right: 0,
              backgroundColor: colors.primary,
              borderColor: colors.background,
            },
          ]}
        >
          <Ionicons name="camera" size={badgeSize * 0.55} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
