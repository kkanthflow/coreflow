import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  Building2, Users, MessageSquare, CheckSquare, Briefcase,
  Video, Bell, Plus, Search, Edit2, Trash2, X, Send,
  Paperclip, Pin, CornerUpLeft, ChevronLeft, RefreshCw,
  Clock, AlertCircle, Calendar, ArrowRight, UserPlus,
  Shield, CheckCircle2, ChevronRight, Download, Sliders,
  Zap, Target, Code, CreditCard, Tag, Sparkles, FolderPlus,
  HelpCircle, Settings as SettingsIcon, Filter, Layers
} from 'lucide-react';
import { toast } from '../components/ui/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import {
  CORE_MODULES,
  type OperationalModule,
} from '../lib/departmentEngine';

interface DepartmentDetail {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  responsibilities: string[] | null;
  enabled_modules: any[] | null;
  module_configurations: Record<string, any> | null;
  color: string | null;
  status: string;
  head_user_id: string | null;
  created_at: string;
  head_user?: { id: string; full_name: string; email: string; avatar_url?: string };
}

interface DeptMember {
  id: string;
  department_id: string;
  user_id: string;
  department_role: string;
  is_primary: boolean;
  joined_at: string;
  user?: { id: string; full_name: string; email: string; role: string; job_title?: string; avatar_url?: string };
}

interface ChatMsg {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  reply_to_id?: string | null;
  created_at: string;
  sender?: { id: string; full_name: string; avatar_url?: string };
  reply_to?: { id: string; content: string; sender?: { full_name: string } };
}

interface DeptTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
  assignee?: { id: string; full_name: string };
}

interface DeptProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  cover_color: string | null;
}

interface DeptMeeting {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  meeting_link?: string | null;
  host?: { id: string; full_name: string };
}

interface DeptAnnouncement {
  id: string;
  department_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  author?: { id: string; full_name: string };
}

interface DepartmentRecord {
  id: string;
  org_id: string;
  department_id: string;
  module_key: string;
  title: string;
  description: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  due_date: string | null;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  assigned_user?: { id: string; full_name: string; email: string } | null;
  creator?: { id: string; full_name: string } | null;
}

export default function DepartmentWorkspace() {
  const { id: deptId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, isOwner, canManageDepartments } = useWorkspace();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState<DepartmentDetail | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(true);

  // Sub-modules state
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [tasks, setTasks] = useState<DeptTask[]>([]);
  const [projects, setProjects] = useState<DeptProject[]>([]);
  const [meetings, setMeetings] = useState<DeptMeeting[]>([]);
  const [announcements, setAnnouncements] = useState<DeptAnnouncement[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<DepartmentRecord[]>([]);

  // Chat State
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMsg | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [allOrgUsers, setAllOrgUsers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selectedAddUserId, setSelectedAddUserId] = useState('');
  const [selectedAddRole, setSelectedAddRole] = useState('member');
  const [addingMember, setAddingMember] = useState(false);

  // New Announcement Modal
  const [isNewAnnounceOpen, setIsNewAnnounceOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [savingAnn, setSavingAnn] = useState(false);

  // New Task Modal
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // New Operational Record Modal (for standard and custom modules)
  const [isNewRecordOpen, setIsNewRecordOpen] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordDesc, setRecordDesc] = useState('');
  const [recordStatus, setRecordStatus] = useState('pending');
  const [recordPriority, setRecordPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [recordAssignee, setRecordAssignee] = useState('');
  const [recordDueDate, setRecordDueDate] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // Settings State
  const [editPurpose, setEditPurpose] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editResponsibilities, setEditResponsibilities] = useState<string[]>([]);
  const [editRespInput, setEditRespInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModName, setNewModName] = useState('');
  const [newModDesc, setNewModDesc] = useState('');

  // Delete Member Confirm
  const [removeMemberUserId, setRemoveMemberUserId] = useState<string | null>(null);

  // Check access and fetch department workspace
  const fetchWorkspaceData = useCallback(async () => {
    if (!deptId || !user) return;
    setLoading(true);

    try {
      // 1. Fetch Department Info
      const { data: deptData, error: deptErr } = await supabase
        .from('departments')
        .select(`
          *,
          head_user:head_user_id(id, full_name, email, avatar_url)
        `)
        .eq('id', deptId)
        .single();

      if (deptErr || !deptData) {
        toast.error('Department not found or archived.');
        navigate('/departments');
        return;
      }

      setDept(deptData);
      setEditPurpose(deptData.purpose || '');
      setEditDescription(deptData.description || '');
      setEditResponsibilities(Array.isArray(deptData.responsibilities) ? deptData.responsibilities : []);

      // 2. Verify backend access permission via can_access_department
      const { data: accessGranted } = await supabase.rpc('can_access_department', {
        p_user_id: user.id,
        p_dept_id: deptId,
      });

      if (!accessGranted && !isOwner) {
        setHasAccess(false);
        setLoading(false);
        return;
      }
      setHasAccess(true);

      // 3. Fetch Members
      const { data: memberData } = await supabase
        .from('department_members')
        .select(`
          *,
          user:user_id(id, full_name, email, role, job_title, avatar_url)
        `)
        .eq('department_id', deptId);

      setMembers(memberData || []);

      // 4. Fetch Department Chat Channel
      let { data: channelData } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('department_id', deptId)
        .maybeSingle();

      if (!channelData) {
        const { data: createdCh } = await supabase
          .from('chat_channels')
          .insert({
            org_id: deptData.org_id,
            department_id: deptId,
            name: `${deptData.name} Chat`,
            description: `Official department channel for ${deptData.name}`,
            type: 'department',
            is_private: false,
          })
          .select('id')
          .single();
        channelData = createdCh;
      }

      if (channelData?.id) {
        setChannelId(channelData.id);

        const { data: msgs } = await supabase
          .from('chat_messages')
          .select(`
            *,
            sender:sender_id(id, full_name, avatar_url)
          `)
          .eq('channel_id', channelData.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(100);

        setMessages(msgs || []);
      }

      // 5. Fetch Tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:assignee_id(id, full_name)
        `)
        .eq('department_id', deptId)
        .order('created_at', { ascending: false });

      setTasks(taskData || []);

      // 6. Fetch Projects
      const { data: projData } = await supabase
        .from('projects')
        .select('*')
        .eq('department_id', deptId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      setProjects(projData || []);

      // 7. Fetch Meetings
      const { data: meetData } = await supabase
        .from('meetings')
        .select(`
          *,
          host:host_id(id, full_name)
        `)
        .eq('department_id', deptId)
        .order('start_time', { ascending: true });

      setMeetings(meetData || []);

      // 8. Fetch Announcements
      const { data: annData } = await supabase
        .from('department_announcements')
        .select(`
          *,
          author:author_id(id, full_name)
        `)
        .eq('department_id', deptId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      setAnnouncements(annData || []);

      // 9. Fetch Department Operational Records
      const { data: recData } = await supabase
        .from('department_records')
        .select(`
          *,
          assigned_user:assigned_to(id, full_name, email),
          creator:created_by(id, full_name)
        `)
        .eq('department_id', deptId)
        .order('created_at', { ascending: false });

      setDepartmentRecords((recData as any) || []);

      // 10. Fetch all org users for member add modal
      if (orgId) {
        const { data: uoData } = await supabase
          .from('user_organizations')
          .select('users:user_id(id, full_name, email)')
          .eq('org_id', orgId);

        const uList = (uoData || []).map((u: any) => u.users).filter(Boolean);
        setAllOrgUsers(uList);
        if (uList[0]) setSelectedAddUserId(uList[0].id);
      }

    } catch (e) {
      console.error('Failed to load department workspace:', e);
      toast.error('Failed to load department workspace.');
    } finally {
      setLoading(false);
    }
  }, [deptId, user, isOwner, orgId, navigate]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Real-time Chat Subscription
  useEffect(() => {
    if (!channelId) return;

    const subscription = supabase
      .channel(`dept_chat_${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const { data: sender } = await supabase
            .from('users')
            .select('id, full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const incomingMsg: ChatMsg = {
            ...(payload.new as any),
            sender: sender || { id: payload.new.sender_id, full_name: 'Member' },
          };

          setMessages(prev => {
            if (prev.some(m => m.id === incomingMsg.id)) return prev;
            return [...prev, incomingMsg];
          });

          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channelId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Parse enabled modules from department record
  const enabledModulesList: OperationalModule[] = useMemo(() => {
    if (!dept?.enabled_modules || !Array.isArray(dept.enabled_modules)) {
      return CORE_MODULES;
    }
    return dept.enabled_modules.map((m: any) => {
      if (typeof m === 'string') {
        const found = CORE_MODULES.find(c => c.key === m);
        return found || {
          key: m,
          name: m.replace(/_/g, ' ').toUpperCase(),
          description: 'Department operational module',
          icon: 'FolderCheck',
          category: 'Custom',
          permission: 'all_members',
          workflowStages: ['New', 'In Progress', 'Completed']
        };
      }
      return m;
    });
  }, [dept]);

  // Active module object if on an operational module tab
  const currentOperationalModule = useMemo(() => {
    return enabledModulesList.find(m => m.key === activeTab);
  }, [enabledModulesList, activeTab]);

  // Filter department records for current operational module
  const currentModuleRecords = useMemo(() => {
    if (!currentOperationalModule) return [];
    return departmentRecords.filter(r => r.module_key === currentOperationalModule.key);
  }, [departmentRecords, currentOperationalModule]);

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !channelId || !user) return;

    setSendingMsg(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          content,
          reply_to_id: replyingTo?.id || null,
        })
        .select(`*, sender:sender_id(id, full_name, avatar_url)`)
        .single();

      if (error) throw error;
      setReplyingTo(null);

      if (data) {
        setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]));
      }
    } catch (err: any) {
      toast.error('Failed to send message: ' + (err.message || ''));
    } finally {
      setSendingMsg(false);
    }
  };

  // Add Member to Department via atomic RPC
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !selectedAddUserId) return;

    setAddingMember(true);
    try {
      const { error } = await supabase.rpc('assign_department_member', {
        p_dept_id: deptId,
        p_user_id: selectedAddUserId,
        p_department_role: selectedAddRole,
        p_is_primary: true,
      });

      if (error) throw error;
      toast.success('Member assigned to department successfully.');
      setIsAddMemberOpen(false);
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add department member');
    } finally {
      setAddingMember(false);
    }
  };

  // Remove Member
  const handleConfirmRemoveMember = async () => {
    if (!deptId || !removeMemberUserId) return;
    try {
      const { error } = await supabase
        .from('department_members')
        .delete()
        .eq('department_id', deptId)
        .eq('user_id', removeMemberUserId);

      if (error) throw error;
      toast.success('Member removed from department.');
      setMembers(prev => prev.filter(m => m.user_id !== removeMemberUserId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setRemoveMemberUserId(null);
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !user || !annTitle.trim() || !annContent.trim()) return;

    setSavingAnn(true);
    try {
      const { data, error } = await supabase
        .from('department_announcements')
        .insert({
          department_id: deptId,
          author_id: user.id,
          title: annTitle.trim(),
          content: annContent.trim(),
          is_pinned: annPinned,
        })
        .select(`*, author:author_id(id, full_name)`)
        .single();

      if (error) throw error;
      toast.success('Announcement published');
      setAnnouncements(prev => [data, ...prev]);
      setIsNewAnnounceOpen(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnPinned(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to post announcement');
    } finally {
      setSavingAnn(false);
    }
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !orgId || !taskTitle.trim() || !user) return;

    setSavingTask(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          org_id: orgId,
          department_id: deptId,
          title: taskTitle.trim(),
          priority: taskPriority,
          status: 'todo',
          due_date: taskDueDate || null,
          assignee_id: taskAssigneeId || null,
          created_by: user.id,
        })
        .select(`*, assignee:assignee_id(id, full_name)`)
        .single();

      if (error) throw error;
      toast.success('Task created successfully');
      setTasks(prev => [data, ...prev]);
      setIsNewTaskOpen(false);
      setTaskTitle('');
      setTaskDueDate('');
      setTaskAssigneeId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  // Create Operational Record for current module
  const handleCreateOperationalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !orgId || !user || !recordTitle.trim() || !currentOperationalModule) return;

    setSavingRecord(true);
    try {
      const initialStatus = recordStatus || currentOperationalModule.workflowStages[0] || 'pending';
      const { data, error } = await supabase
        .from('department_records')
        .insert({
          org_id: orgId,
          department_id: deptId,
          module_key: currentOperationalModule.key,
          title: recordTitle.trim(),
          description: recordDesc.trim() || null,
          status: initialStatus,
          priority: recordPriority,
          assigned_to: recordAssignee || null,
          due_date: recordDueDate || null,
          created_by: user.id,
        })
        .select(`
          *,
          assigned_user:assigned_to(id, full_name, email),
          creator:created_by(id, full_name)
        `)
        .single();

      if (error) throw error;
      toast.success(`Entry added to ${currentOperationalModule.name}`);
      setDepartmentRecords(prev => [data as any, ...prev]);
      setIsNewRecordOpen(false);
      setRecordTitle('');
      setRecordDesc('');
      setRecordDueDate('');
      setRecordAssignee('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save entry');
    } finally {
      setSavingRecord(false);
    }
  };

  // Update Status of an Operational Record
  const handleUpdateRecordStatus = async (recordId: string, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', recordId);

      if (error) throw error;
      setDepartmentRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: nextStatus } : r));
      toast.success(`Moved to ${nextStatus}`);
    } catch (err: any) {
      toast.error('Failed to update stage');
    }
  };

  // Delete Operational Record
  const handleDeleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      setDepartmentRecords(prev => prev.filter(r => r.id !== recordId));
      toast.success('Record removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  // Save Department Workspace Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !orgId) return;

    setSavingSettings(true);
    try {
      const { error } = await supabase.rpc('update_department_configuration', {
        p_org_id: orgId,
        p_department_id: deptId,
        p_purpose: editPurpose.trim() || null,
        p_description: editDescription.trim() || null,
        p_responsibilities: editResponsibilities,
        p_enabled_modules: enabledModulesList,
      });

      if (error) throw error;
      toast.success('Department workspace configuration saved.');
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Add Custom Module from Settings Tab
  const handleAddCustomModuleInSettings = async () => {
    if (!newModName.trim() || !deptId || !orgId) return;
    const cleanKey = newModName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const newMod: OperationalModule = {
      key: cleanKey,
      name: newModName.trim(),
      description: newModDesc.trim() || `Custom tracking for ${newModName.trim()}`,
      icon: 'FolderCheck',
      category: 'Custom',
      isCustom: true,
      permission: 'all_members',
      workflowStages: ['Intake', 'In Progress', 'Under Review', 'Completed'],
    };

    const updated = [...enabledModulesList, newMod];
    try {
      const { error } = await supabase.rpc('update_department_configuration', {
        p_org_id: orgId,
        p_department_id: deptId,
        p_enabled_modules: updated,
      });

      if (error) throw error;
      toast.success(`Custom module "${newMod.name}" activated!`);
      setNewModName('');
      setNewModDesc('');
      setShowAddModuleModal(false);
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add custom module');
    }
  };

  const canManageThisDept = isOwner || canManageDepartments || dept?.head_user_id === user?.id;

  // Metric Strip items
  const metricItems: MetricItem[] = useMemo(() => [
    { label: 'MEMBERS', value: members.length },
    { label: 'MODULES', value: enabledModulesList.length, isOrange: true },
    { label: 'RECORDS', value: departmentRecords.length },
    { label: 'STATUS', value: dept?.status?.toUpperCase() || 'ACTIVE' },
  ], [members, enabledModulesList, departmentRecords, dept]);

  if (loading) {
    return (
      <div className="space-y-6 pb-12 font-sans select-none text-muted">
        <SkeletonRow count={4} />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4 font-sans select-none">
        <Shield size={36} className="text-red-400 mx-auto" />
        <h2 className="text-sm font-bold text-main">Access Restricted</h2>
        <p className="text-xs text-muted leading-relaxed">
          You are not currently enrolled in this department workspace. Contact your Organization Owner or Department Head for membership.
        </p>
        <Link
          to="/departments"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-2 hover:bg-hover text-main text-xs font-semibold border border-divider transition-all"
        >
          <ChevronLeft size={13} />
          <span>Back to Departments</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 pb-16 font-sans select-none text-muted">
      {/* ── Page Header ── */}
      <PageHeader
        title={dept?.name || 'Department Workspace'}
        description={dept?.description || 'Dedicated organizational workspace.'}
        badge={dept?.status?.toUpperCase() || 'ACTIVE'}
        breadcrumbs={[
          { label: 'Departments', href: '/departments' },
          { label: dept?.name || 'Workspace' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchWorkspaceData}
              className="p-2 rounded-lg bg-surface-2 hover:bg-hover text-muted hover:text-main border border-divider transition-colors cursor-pointer"
              title="Refresh Workspace"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            {canManageThisDept && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-hover text-main border border-divider text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <UserPlus size={13} />
                <span>Add Member</span>
              </button>
            )}

            {canManageThisDept && (
              <button
                onClick={() => setIsNewAnnounceOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <Pin size={13} />
                <span>Post Announcement</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metricItems} />

      {/* ── Dynamic Department Navigation Tabs ── */}
      <div className="flex items-center bg-surface-2 p-1 rounded-xl border border-divider gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-surface text-main shadow-xs border border-divider'
              : 'text-muted hover:text-main'
          }`}
        >
          <Building2 size={13} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-surface text-main shadow-xs border border-divider'
              : 'text-muted hover:text-main'
          }`}
        >
          <Users size={13} />
          <span>Members ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-surface text-main shadow-xs border border-divider'
              : 'text-muted hover:text-main'
          }`}
        >
          <MessageSquare size={13} />
          <span>Department Chat</span>
        </button>

        {/* Enabled Operational Modules Tabs */}
        {enabledModulesList.map(mod => {
          if (['chat', 'members'].includes(mod.key)) return null;
          return (
            <button
              key={mod.key}
              onClick={() => setActiveTab(mod.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === mod.key
                  ? 'bg-surface text-main shadow-xs border border-divider'
                  : 'text-muted hover:text-main'
              }`}
            >
              <Zap size={13} className={mod.isCustom ? 'text-accent' : 'text-blue-400'} />
              <span>{mod.name}</span>
            </button>
          );
        })}

        <button
          onClick={() => setActiveTab('announcements')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'announcements'
              ? 'bg-surface text-main shadow-xs border border-divider'
              : 'text-muted hover:text-main'
          }`}
        >
          <Bell size={13} />
          <span>Announcements ({announcements.length})</span>
        </button>

        {canManageThisDept && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-surface text-main shadow-xs border border-divider'
                : 'text-muted hover:text-main'
            }`}
          >
            <SettingsIcon size={13} />
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: DEPARTMENT OVERVIEW (UNIQUE PURPOSE & CUSTOM MODULES DASHBOARD)  */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Purpose & Mandate Banner */}
          <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h3 className="text-xs font-bold text-main uppercase font-mono tracking-wider">
                Organizational Purpose & Operational Scope
              </h3>
            </div>
            <p className="text-sm font-semibold text-main leading-relaxed">
              {dept?.purpose || dept?.description || 'Operational domain established for organizational workflows.'}
            </p>

            {/* Responsibilities Tags */}
            {dept?.responsibilities && Array.isArray(dept.responsibilities) && dept.responsibilities.length > 0 && (
              <div className="pt-2 border-t border-divider flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-muted uppercase mr-1">Responsibilities:</span>
                {dept.responsibilities.map((resp, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs font-medium"
                  >
                    <Tag size={10} />
                    <span>{resp}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Enabled Operational Modules Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-main uppercase font-mono tracking-wider">
                Active Operational Modules ({enabledModulesList.length})
              </h3>
              {canManageThisDept && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className="text-[11px] text-accent hover:underline flex items-center gap-1"
                >
                  <Sliders size={11} />
                  <span>Configure Modules</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {enabledModulesList.map(mod => {
                const count = departmentRecords.filter(r => r.module_key === mod.key).length;
                return (
                  <div
                    key={mod.key}
                    onClick={() => setActiveTab(mod.key)}
                    className="bg-card-bg border border-divider hover:border-accent/40 rounded-xl p-4.5 space-y-3 transition-all cursor-pointer shadow-xs flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-surface-2 border border-divider flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
                            <Zap size={15} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-main block group-hover:text-accent transition-colors">
                              {mod.name}
                            </span>
                            <span className="text-[9px] font-mono uppercase text-muted">
                              {mod.category}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-surface border border-divider text-main">
                          {count} {count === 1 ? 'record' : 'records'}
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2">{mod.description}</p>
                    </div>

                    <div className="pt-2.5 border-t border-divider flex items-center justify-between text-[11px] text-accent font-semibold">
                      <span>Open Module Workspace</span>
                      <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leadership & Recent Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-main border-b border-divider pb-2.5">
                Department Leadership
              </h4>
              {dept?.head_user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent border border-accent/25 flex items-center justify-center font-bold text-sm">
                    {dept.head_user.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-main block">{dept.head_user.full_name}</span>
                    <span className="text-[10px] font-mono text-accent font-semibold uppercase">DEPARTMENT HEAD</span>
                    <p className="text-[11px] text-muted font-mono">{dept.head_user.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No department lead currently assigned.</p>
              )}
            </div>

            <div className="lg:col-span-2 bg-card-bg border border-divider rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-divider pb-2.5">
                <h4 className="text-xs font-bold text-main">Latest Operational Records</h4>
                <span className="text-[10px] font-mono text-muted">{departmentRecords.length} total entries</span>
              </div>
              {departmentRecords.length === 0 ? (
                <p className="text-xs text-muted py-2">No records recorded across operational modules yet.</p>
              ) : (
                <div className="divide-y divide-divider">
                  {departmentRecords.slice(0, 4).map(rec => (
                    <div key={rec.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="space-y-0.5 min-w-0 pr-3">
                        <span className="font-semibold text-main truncate block">{rec.title}</span>
                        <span className="text-[10px] font-mono text-muted uppercase">
                          Module: {rec.module_key.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-2 border border-divider text-accent font-semibold">
                          {rec.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: DEDICATED OPERATIONAL MODULE VIEW (FOR ANY STANDARD OR CUSTOM)   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {currentOperationalModule && (
        <div className="space-y-5">
          {/* Module Header Bar */}
          <div className="p-4 bg-card-bg border border-divider rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-accent" />
                <h3 className="text-sm font-bold text-main">{currentOperationalModule.name}</h3>
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-surface-2 border border-divider text-accent font-semibold">
                  {currentOperationalModule.category}
                </span>
              </div>
              <p className="text-xs text-muted">{currentOperationalModule.description}</p>
            </div>

            <button
              onClick={() => {
                setRecordStatus(currentOperationalModule.workflowStages[0] || 'pending');
                setIsNewRecordOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Plus size={13} />
              <span>Add {currentOperationalModule.name} Entry</span>
            </button>
          </div>

          {/* Workflow Stages Kanban / Cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono">
              <span className="text-muted mr-1 uppercase">Workflow Lifecycle:</span>
              {currentOperationalModule.workflowStages.map((stage, sIdx) => (
                <span key={sIdx} className="inline-flex items-center gap-1">
                  {sIdx > 0 && <span className="text-muted/40">→</span>}
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-divider text-main font-semibold">
                    {stage}
                  </span>
                </span>
              ))}
            </div>

            {currentModuleRecords.length === 0 ? (
              <EmptyState
                icon={FolderPlus}
                title={`No entries in ${currentOperationalModule.name}`}
                description="Begin tracking operational deliverables, records, and milestones for this module."
                action={{
                  label: `Add First Entry`,
                  onClick: () => {
                    setRecordStatus(currentOperationalModule.workflowStages[0] || 'pending');
                    setIsNewRecordOpen(true);
                  }
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentModuleRecords.map(rec => (
                  <div
                    key={rec.id}
                    className="bg-card-bg border border-divider rounded-xl p-4 space-y-3 shadow-xs flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-main leading-snug">{rec.title}</span>
                        {canManageThisDept && (
                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="Delete Entry"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {rec.description && (
                        <p className="text-xs text-muted/90 line-clamp-3 leading-relaxed">{rec.description}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-divider space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                        <span className="uppercase">Priority: {rec.priority}</span>
                        {rec.due_date && <span>Due: {new Date(rec.due_date).toLocaleDateString()}</span>}
                      </div>

                      {/* Status Stage Switcher */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[10px] font-mono text-muted">Stage:</span>
                        <select
                          value={rec.status}
                          onChange={e => handleUpdateRecordStatus(rec.id, e.target.value)}
                          className="px-2 py-1 bg-surface-2 border border-divider focus:border-accent rounded text-[11px] font-semibold text-accent focus:outline-none cursor-pointer"
                        >
                          {currentOperationalModule.workflowStages.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: MEMBERS MANAGEMENT                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <div>
              <h3 className="text-xs font-bold text-main flex items-center gap-2">
                <Users size={14} className="text-accent" />
                <span>Department Members ({members.length})</span>
              </h3>
              <p className="text-[11px] text-muted">Personnel with authorized access to this workspace.</p>
            </div>

            {canManageThisDept && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <UserPlus size={13} />
                <span>Add Member</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-divider">
            {members.map(m => (
              <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-2 border border-divider flex items-center justify-center font-bold text-main text-xs">
                    {m.user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <span className="font-semibold text-main block">{m.user?.full_name}</span>
                    <span className="text-[10px] font-mono text-muted">{m.user?.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface border border-divider text-accent font-semibold">
                    {m.department_role}
                  </span>
                  {canManageThisDept && m.user_id !== user?.id && (
                    <button
                      onClick={() => setRemoveMemberUserId(m.user_id)}
                      className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                      title="Remove Member"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: REAL-TIME DEPARTMENT CHAT                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div className="bg-card-bg border border-divider rounded-xl flex flex-col h-[600px] overflow-hidden">
          <div className="p-3.5 border-b border-divider bg-surface flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-accent" />
              <span className="text-xs font-bold text-main">#{dept?.name?.toLowerCase().replace(/\s+/g, '-')}-general</span>
            </div>
            <span className="text-[10px] font-mono text-muted">{messages.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-xs text-muted text-center py-12">No messages in department chat yet. Say hello!</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-lg bg-surface-2 border border-divider text-main flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    {msg.sender?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-main text-[11px]">{msg.sender?.full_name || 'Member'}</span>
                      <span className="text-[9px] font-mono text-muted">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted/90 bg-surface-2/40 border border-divider/60 rounded-lg p-2.5 inline-block max-w-xl">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t border-divider bg-surface flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder={`Message #${dept?.name?.toLowerCase().replace(/\s+/g, '-')}-general...`}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none"
            />
            <button
              type="submit"
              disabled={sendingMsg || !newMessage.trim()}
              className="p-2 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white cursor-pointer shadow-xs"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5: ANNOUNCEMENTS                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-main uppercase font-mono tracking-wider">
              Department Bulletins & Announcements
            </h3>
            {canManageThisDept && (
              <button
                onClick={() => setIsNewAnnounceOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Plus size={13} />
                <span>New Announcement</span>
              </button>
            )}
          </div>

          {announcements.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No announcements posted"
              description="Keep your department informed with pinned bulletins and official updates."
            />
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="bg-card-bg border border-divider rounded-xl p-4.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-main flex items-center gap-1.5">
                      {ann.is_pinned && <Pin size={12} className="text-accent" />}
                      <span>{ann.title}</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted">
                      {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted/90 leading-relaxed whitespace-pre-line">{ann.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6: WORKSPACE SETTINGS (MODULE CONFIGURATION & PURPOSE EDITOR)       */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && canManageThisDept && (
        <div className="bg-card-bg border border-divider rounded-xl p-6 space-y-6">
          <div className="border-b border-divider pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-main uppercase font-mono tracking-wider">
                Department Workspace Configuration
              </h3>
              <p className="text-[11px] text-muted">Customize operational scope, responsibilities and active modules.</p>
            </div>
            <button
              onClick={() => setShowAddModuleModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-hover border border-divider text-xs font-semibold text-main cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Custom Module</span>
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                Department Purpose
              </label>
              <input
                type="text"
                value={editPurpose}
                onChange={e => setEditPurpose(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main focus:outline-none resize-none"
              />
            </div>

            {/* Responsibilities Tag Editor */}
            <div>
              <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                Operational Responsibilities
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Add responsibility..."
                  value={editRespInput}
                  onChange={e => setEditRespInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (editRespInput.trim() && !editResponsibilities.includes(editRespInput.trim())) {
                        setEditResponsibilities([...editResponsibilities, editRespInput.trim()]);
                        setEditRespInput('');
                      }
                    }
                  }}
                  className="flex-1 px-3 py-1.5 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editRespInput.trim() && !editResponsibilities.includes(editRespInput.trim())) {
                      setEditResponsibilities([...editResponsibilities, editRespInput.trim()]);
                      setEditRespInput('');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-divider text-xs text-main"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 p-2 bg-surface-2/40 border border-divider rounded-lg">
                {editResponsibilities.map((resp, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/10 border border-accent/25 text-accent text-xs font-medium"
                  >
                    <span>{resp}</span>
                    <button
                      type="button"
                      onClick={() => setEditResponsibilities(editResponsibilities.filter((_, i) => i !== idx))}
                      className="hover:text-red-400 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-divider flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                {savingSettings ? 'Saving...' : 'Save Workspace Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Add Custom Module in Settings ── */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <h3 className="text-xs font-bold text-main">Add Custom Operational Module</h3>
              <button onClick={() => setShowAddModuleModal(false)} className="text-muted hover:text-main">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Module Name (e.g. Code Review, Grant Tracking, Market Intelligence)"
                value={newModName}
                onChange={e => setNewModName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
              />
              <input
                type="text"
                placeholder="Module Description..."
                value={newModDesc}
                onChange={e => setNewModDesc(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-divider">
              <button
                type="button"
                onClick={() => setShowAddModuleModal(false)}
                className="px-3 py-1.5 text-xs text-muted hover:text-main"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomModuleInSettings}
                disabled={!newModName.trim()}
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50"
              >
                Activate Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Operational Record Entry ── */}
      {isNewRecordOpen && currentOperationalModule && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <h3 className="text-xs font-bold text-main flex items-center gap-2">
                <Zap size={14} className="text-accent" />
                <span>New {currentOperationalModule.name} Entry</span>
              </h3>
              <button onClick={() => setIsNewRecordOpen(false)} className="text-muted hover:text-main">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateOperationalRecord} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-muted uppercase mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Record title..."
                  value={recordTitle}
                  onChange={e => setRecordTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-muted uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details and operational context..."
                  value={recordDesc}
                  onChange={e => setRecordDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-muted uppercase mb-1">Stage</label>
                  <select
                    value={recordStatus}
                    onChange={e => setRecordStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
                  >
                    {currentOperationalModule.workflowStages.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-muted uppercase mb-1">Priority</label>
                  <select
                    value={recordPriority}
                    onChange={e => setRecordPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-muted uppercase mb-1">Assignee</label>
                  <select
                    value={recordAssignee}
                    onChange={e => setRecordAssignee(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user?.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-muted uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={recordDueDate}
                    onChange={e => setRecordDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsNewRecordOpen(false)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-main"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecord || !recordTitle.trim()}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50"
                >
                  {savingRecord ? 'Saving...' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Member ── */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <h3 className="text-xs font-bold text-main">Add Member to Department</h3>
              <button onClick={() => setIsAddMemberOpen(false)} className="text-muted hover:text-main">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-muted uppercase mb-1">Select Employee</label>
                <select
                  value={selectedAddUserId}
                  onChange={e => setSelectedAddUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
                >
                  {allOrgUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-muted uppercase mb-1">Department Role</label>
                <select
                  value={selectedAddRole}
                  onChange={e => setSelectedAddRole(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="lead">Lead</option>
                  <option value="specialist">Specialist</option>
                  <option value="contributor">Contributor</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-main"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                >
                  {addingMember ? 'Assigning...' : 'Assign Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Post Announcement ── */}
      {isNewAnnounceOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <h3 className="text-xs font-bold text-main">Post Department Announcement</h3>
              <button onClick={() => setIsNewAnnounceOpen(false)} className="text-muted hover:text-main">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-muted uppercase mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="Announcement title..."
                  value={annTitle}
                  onChange={e => setAnnTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-muted uppercase mb-1">Content</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Official notice or briefing..."
                  value={annContent}
                  onChange={e => setAnnContent(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider rounded-lg text-xs text-main focus:outline-none resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-main pt-1">
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={e => setAnnPinned(e.target.checked)}
                  className="accent-accent"
                />
                <span>Pin to top of department workspace</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsNewAnnounceOpen(false)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-main"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAnn}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                >
                  {savingAnn ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Remove Member Modal ── */}
      <ConfirmModal
        isOpen={!!removeMemberUserId}
        onClose={() => setRemoveMemberUserId(null)}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Member"
        message="Are you sure you want to remove this member from the department workspace?"
        confirmText="Remove Member"
        variant="danger"
      />
    </div>
  );
}
