import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FileCard, FileData } from '@/components/ui/file-card';
import { FileUploader } from '@/components/ui/file-uploader';
import { PremiumSelect } from '@/components/ui/premium-select';
import { hasPermission } from '@/lib/permissions';

export default function FileBrowserScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [files, setFiles] = useState<FileData[]>([]);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all'); // 'all', 'general', or project UUID
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch projects list for filter dropdown
  const fetchFilterProjects = useCallback(async () => {
    if (!user?.organizationId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title')
        .eq('org_id', user.organizationId);

      if (error) throw error;

      const projectOpts = (data || []).map(p => ({
        label: p.title,
        value: p.id,
      }));

      setProjects([
        { label: 'All Workspace Files', value: 'all' },
        { label: 'General Org Files', value: 'general' },
        ...projectOpts,
      ]);
    } catch (e) {
      console.error('Error fetching filter projects:', e);
    }
  }, [user?.organizationId]);

  // Fetch files list matching current filters
  const fetchFiles = useCallback(async () => {
    if (!user?.organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
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
          project:project_id (
            title,
            department:department_id (
              name,
              color
            )
          ),
          uploader:uploader_id (
            full_name
          )
        `)
        .eq('org_id', user.organizationId)
        .order('created_at', { ascending: false });

      if (selectedProjectFilter === 'general') {
        query = query.is('project_id', null);
      } else if (selectedProjectFilter !== 'all') {
        query = query.eq('project_id', selectedProjectFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setFiles(data as unknown as FileData[]);
    } catch (e: any) {
      console.error('Error fetching files:', e);
      Alert.alert('Error', 'Failed to retrieve files.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.organizationId, selectedProjectFilter]);

  useEffect(() => {
    fetchFilterProjects();
  }, [fetchFilterProjects]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, selectedProjectFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFiles();
  };

  const handleFileDelete = async (id: string) => {
    Alert.alert(
      'Delete File',
      'Are you sure you want to permanently delete this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Find the file to get its path and bucket
              const fileToDelete = files.find(f => f.id === id);
              if (!fileToDelete) return;

              // 1. Delete from Supabase Storage
              const { error: storageError } = await supabase.storage
                .from(fileToDelete.bucket)
                .remove([fileToDelete.storage_path]);

              if (storageError) throw storageError;

              // 2. Delete metadata row
              const { error: dbError } = await supabase
                .from('files')
                .delete()
                .eq('id', id);

              if (dbError) throw dbError;

              // Log activity
              await supabase.from('activity_logs').insert({
                org_id: user?.organizationId,
                actor_id: user?.id,
                action: 'file_deleted',
                entity_type: 'file',
                new_value: { file_name: fileToDelete.file_name },
              });

              setFiles(prev => prev.filter(f => f.id !== id));
              Alert.alert('Deleted', 'File deleted successfully.');
            } catch (e: any) {
              console.error(e);
              Alert.alert('Error', e.message || 'Failed to delete file.');
            }
          },
        },
      ]
    );
  };

  const checkCanDelete = (file: FileData) => {
    if (!user) return false;
    // Owner or admin can delete any file
    if (hasPermission(user.role, 'manage_organization')) return true;
    // The uploader themselves can delete their own files
    // @ts-ignore
    if (file.uploader_id === user.id) return true;
    return false;
  };

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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>File Manager</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Browse, upload and manage assets
          </Text>
        </View>
      </View>

      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Filter */}
            <View style={styles.filterContainer}>
              <Text style={[styles.filterLabel, { color: colors.foreground }]}>Filter by Project</Text>
              <PremiumSelect
                label="Filter by Project"
                options={projects}
                value={selectedProjectFilter}
                onSelect={setSelectedProjectFilter}
                placeholder="Select workspace filter..."
              />
            </View>

            {/* Uploader (Hidden for Freelancers unless they choose a specific project they are members of) */}
            {user?.role !== 'freelancer' || selectedProjectFilter !== 'all' ? (
              <FileUploader
                projectId={selectedProjectFilter !== 'all' && selectedProjectFilter !== 'general' ? selectedProjectFilter : undefined}
                onUploadSuccess={fetchFiles}
              />
            ) : null}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Files ({files.length})</Text>
          </View>
        }
        renderItem={({ item }) => (
          <FileCard
            file={item}
            canDelete={checkCanDelete(item)}
            onDelete={handleFileDelete}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color={colors.muted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No files found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                {selectedProjectFilter === 'all'
                  ? 'There are no files uploaded in this organization yet.'
                  : 'No files found matching the selected project filter.'}
              </Text>
            </View>
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerComponent: {
    paddingBottom: 16,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

