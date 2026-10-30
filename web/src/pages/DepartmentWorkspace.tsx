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
  HelpCircle, Settings as SettingsIcon, Filter, Layers,
  LayoutDashboard, Megaphone
} from 'lucide-react';
import { toast } from '../components/ui/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import {
  DepartmentHeader,
  DepartmentTabs,
  ModuleCard,
  ModuleGrid,
  DepartmentMetricStrip,
  getTabIcon,
  type TabDefinition,
  type DepartmentMetricItem,
} from '../components/departments';
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
  const [errorState, setErrorState] = useState<string | null>(null);
  const [dept, setDept] = useState<DepartmentDetail | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(true);

  // Sub-modules state
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
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
    setErrorState(null);

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

    } catch (e: any) {
      console.error('Failed to load department workspace:', e);
      setErrorState(e?.message || 'Failed to load department workspace.');
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
    let list = departmentRecords.filter(r => r.module_key === currentOperationalModule.key);
    if (recordSearch.trim()) {
      const q = recordSearch.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q) ||
        r.priority?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [departmentRecords, currentOperationalModule, recordSearch]);

  // Filter department personnel for Members tab
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(m =>
      m.user?.full_name?.toLowerCase().includes(q) ||
      m.user?.email?.toLowerCase().includes(q) ||
      m.department_role?.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

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

  // Metric Strip items (3 evenly stretched stats)
  const metricItems: DepartmentMetricItem[] = useMemo(() => [
    {
      label: 'MEMBERS',
      value: members.length < 10 ? `0${members.length}` : members.length,
      indicator: members.length > 0 ? `${members.length} Active` : undefined,
    },
    {
      label: 'ACTIVE MODULES',
      value: enabledModulesList.length < 10 ? `0${enabledModulesList.length}` : enabledModulesList.length,
      isOrange: true,
      indicator: 'Operational',
    },
    {
      label: 'DELIVERABLES & RECORDS',
      value: departmentRecords.length < 10 ? `0${departmentRecords.length}` : departmentRecords.length,
      indicator: departmentRecords.length > 0 ? `${departmentRecords.length} Total` : undefined,
    },
  ], [members, enabledModulesList, departmentRecords]);

  // Dynamic tab definitions for DepartmentTabs
  const departmentTabs: TabDefinition[] = useMemo(() => {
    const list: TabDefinition[] = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'members', label: 'Members', icon: Users, count: members.length },
      { id: 'chat', label: 'Department Chat', icon: MessageSquare },
    ];

    enabledModulesList.forEach(mod => {
      if (['chat', 'members', 'overview', 'announcements', 'settings'].includes(mod.key)) return;
      const count = departmentRecords.filter(r => r.module_key === mod.key).length;
      list.push({
        id: mod.key,
        label: mod.name,
        category: mod.category,
        count,
        isCustom: mod.isCustom,
      });
    });

    list.push({
      id: 'announcements',
      label: 'Announcements',
      icon: Megaphone,
      count: announcements.length,
    });

    if (canManageThisDept) {
      list.push({
        id: 'settings',
        label: 'Settings',
        icon: SettingsIcon,
      });
    }

    return list;
  }, [members, enabledModulesList, departmentRecords, announcements, canManageThisDept]);

  if (loading && !dept) {
    return (
      <div className="space-y-6 pb-12 font-sans select-none text-muted">
        {/* Header Skeleton */}
        <div className="border-b border-divider pb-4 space-y-2">
          <div className="h-3 w-28 bg-surface-2/70 rounded animate-pulse" />
          <div className="h-7 w-64 bg-surface-2/80 rounded animate-pulse" />
          <div className="h-3.5 w-96 max-w-full bg-surface-2/60 rounded animate-pulse" />
        </div>
        {/* Metric Strip Skeleton */}
        <div className="h-24 bg-surface-2/50 rounded-xl border border-line animate-pulse" />
        {/* Tabs Skeleton */}
        <div className="h-9 w-80 max-w-full bg-surface-2/60 rounded-lg animate-pulse" />
        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-44 bg-surface-2/50 rounded-xl border border-line animate-pulse" />
          <div className="h-44 bg-surface-2/50 rounded-xl border border-line animate-pulse" />
          <div className="h-44 bg-surface-2/50 rounded-xl border border-line animate-pulse" />
        </div>
      </div>
    );
  }

  if (errorState && !dept) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4 font-sans select-none">
        <AlertCircle size={36} className="text-red-400 mx-auto" />
        <h2 className="text-sm font-bold text-main">Failed to Load Workspace</h2>
        <p className="text-xs text-muted leading-relaxed">{errorState}</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            to="/departments"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-2 hover:bg-hover text-muted hover:text-main text-xs font-semibold border border-divider transition-colors"
          >
            <ChevronLeft size={13} />
            <span>Departments</span>
          </Link>
          <button
            onClick={fetchWorkspaceData}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-sm shadow-accent/20 cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        </div>
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
      {/* ── Page Header Standard ── */}
      <DepartmentHeader
        departmentName={dept?.name || 'Department Workspace'}
        description={dept?.description}
        badge={dept?.status?.toUpperCase() || 'ACTIVE'}
        onRefresh={fetchWorkspaceData}
        isRefreshing={loading}
        primaryAction={
          canManageThisDept
            ? {
                label: 'Add Member',
                onClick: () => setIsAddMemberOpen(true),
                icon: UserPlus,
              }
            : undefined
        }
        secondaryAction={
          canManageThisDept
            ? {
                label: 'Post Announcement',
                onClick: () => setIsNewAnnounceOpen(true),
                icon: Megaphone,
              }
            : undefined
        }
      />

      {/* ── Telemetry Metric Strip (3 Evenly Stretched Metrics) ── */}
      <DepartmentMetricStrip metrics={metricItems} />

      {/* ── Department Tabs Pill Navigation ── */}
      <DepartmentTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={departmentTabs}
        syncWithUrl={true}
      />

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: DEPARTMENT OVERVIEW (UNIQUE PURPOSE & CUSTOM MODULES DASHBOARD)  */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Purpose & Operational Scope Card (14px body text, no duplicate description) */}
          <div className="bg-card-bg border border-divider rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <h3 className="text-[10px] font-mono font-bold text-muted uppercase tracking-wider">
                Organizational Purpose & Operational Scope
              </h3>
            </div>
            <p className="text-sm text-main font-normal leading-relaxed">
              {dept?.purpose || 'Operational domain established for organizational workflows and team deliverables.'}
            </p>

            {/* Responsibilities Tags */}
            {dept?.responsibilities && Array.isArray(dept.responsibilities) && dept.responsibilities.length > 0 && (
              <div className="pt-2 border-t border-divider flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider mr-1">Responsibilities:</span>
                {dept.responsibilities.map((resp, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 border border-divider text-muted text-[11px] font-mono"
                  >
                    <Tag size={10} className="text-accent" />
                    <span>{resp}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Enabled Operational Modules Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-mono font-bold text-muted uppercase tracking-wider">
                Active Operational Modules ({enabledModulesList.length})
              </h3>
              {canManageThisDept && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sliders size={11} />
                  <span>Configure Modules</span>
                </button>
              )}
            </div>

            {enabledModulesList.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No active operational modules"
                description="Initialize or customize operational modules to begin tracking department workflows."
                action={canManageThisDept ? { label: "Configure Modules", onClick: () => setActiveTab('settings') } : undefined}
              />
            ) : (
              <ModuleGrid>
                {enabledModulesList.map((mod, mIdx) => {
                  const count = departmentRecords.filter(r => r.module_key === mod.key).length;
                  return (
                    <ModuleCard
                      key={mod.key}
                      index={mIdx}
                      moduleKey={mod.key}
                      name={mod.name}
                      category={mod.category}
                      description={mod.description}
                      recordCount={count}
                      onClick={() => setActiveTab(mod.key)}
                    />
                  );
                })}
              </ModuleGrid>
            )}
          </div>

          {/* Leadership & Recent Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-card-bg border border-divider rounded-xl p-5 shadow-sm space-y-3">
              <h4 className="text-[10px] font-mono font-bold text-muted uppercase tracking-wider border-b border-divider pb-2.5">
                Department Leadership
              </h4>
              {dept?.head_user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent border border-accent/25 flex items-center justify-center font-bold text-sm shrink-0">
                    {dept.head_user.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-main block truncate">{dept.head_user.full_name}</span>
                    <span className="text-[10px] font-mono text-accent font-semibold uppercase">DEPARTMENT HEAD</span>
                    <p className="text-[11px] text-muted font-mono truncate">{dept.head_user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-muted mb-2">No department lead currently assigned.</p>
                  {canManageThisDept && (
                    <button
                      onClick={() => setIsAddMemberOpen(true)}
                      className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                    >
                      Assign Department Lead
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-card-bg border border-divider rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-divider pb-2.5">
                <h4 className="text-[10px] font-mono font-bold text-muted uppercase tracking-wider">
                  Latest Operational Records
                </h4>
                <span className="text-[10px] font-mono text-muted tabular-nums">
                  {departmentRecords.length < 10 ? `0${departmentRecords.length}` : departmentRecords.length} total entries
                </span>
              </div>
              {departmentRecords.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted mb-3">No records recorded across operational modules yet.</p>
                  {enabledModulesList.length > 0 && (
                    <button
                      onClick={() => {
                        const firstMod = enabledModulesList[0];
                        if (firstMod) setActiveTab(firstMod.key);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-2 hover:bg-hover text-main border border-divider text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Open First Module
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {departmentRecords.slice(0, 4).map(rec => (
                    <div key={rec.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-hover/30 px-2 rounded-lg transition-colors">
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
        <div className="space-y-5 animate-fade-in">
          {/* Module Header Bar */}
          {(() => {
            const ModIcon = getTabIcon(currentOperationalModule.key, currentOperationalModule.category);
            return (
              <div className="p-4 bg-card-bg border border-divider rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-2 border border-divider flex items-center justify-center text-accent shrink-0 shadow-2xs">
                    <ModIcon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-main tracking-tight">{currentOperationalModule.name}</h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-surface-2 border border-divider text-muted">
                        {currentOperationalModule.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 font-normal">{currentOperationalModule.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRecordStatus(currentOperationalModule.workflowStages[0] || 'pending');
                    setIsNewRecordOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Add {currentOperationalModule.name} Entry</span>
                </button>
              </div>
            );
          })()}

          {/* Toolbar: Search & Workflow Stages Lifecycle */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg border border-divider rounded-xl shadow-sm p-3">
            <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-sm">
              <div className="relative w-full">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search deliverables, status, or priorities..."
                  value={recordSearch}
                  onChange={e => setRecordSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-text placeholder-muted/60 focus:outline-none transition-colors"
                />
                {recordSearch && (
                  <button onClick={() => setRecordSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono select-none">
              <span className="text-[10px] font-mono font-bold text-muted uppercase tracking-wider mr-1">Lifecycle:</span>
              {currentOperationalModule.workflowStages.map((stage, sIdx) => (
                <span key={sIdx} className="inline-flex items-center gap-1">
                  {sIdx > 0 && <span className="text-muted/40">→</span>}
                  <span className="px-2 py-0.5 rounded-md bg-surface-2 border border-line text-muted font-semibold text-[10px]">
                    {stage}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Module Records Cards */}
          {currentModuleRecords.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title={recordSearch ? 'No matching deliverables' : `No entries in ${currentOperationalModule.name}`}
              description={
                recordSearch
                  ? 'No records match your query. Clear the search input to see all deliverables.'
                  : 'Begin tracking operational deliverables, records, and milestones for this module.'
              }
              action={{
                label: `Add First Entry`,
                onClick: () => {
                  setRecordStatus(currentOperationalModule.workflowStages[0] || 'pending');
                  setIsNewRecordOpen(true);
                },
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentModuleRecords.map((rec, rIdx) => {
                const priorityStyles: Record<string, string> = {
                  low: 'bg-surface-2 text-muted border-line',
                  medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
                  high: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
                  urgent: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
                };

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(rIdx * 0.03, 0.3) }}
                    key={rec.id}
                    className="bg-card-bg border border-divider hover:border-accent/40 rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-main leading-snug group-hover:text-accent transition-colors">
                          {rec.title}
                        </span>
                        {canManageThisDept && (
                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                            title="Delete Entry"
                            aria-label={`Delete ${rec.title}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {rec.description && (
                        <p className="text-xs text-muted/90 line-clamp-3 leading-relaxed font-normal">
                          {rec.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-divider space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${priorityStyles[rec.priority] || priorityStyles.medium}`}>
                          {rec.priority}
                        </span>
                        {rec.due_date && (
                          <span className="tabular-nums">Due: {new Date(rec.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        )}
                      </div>

                      {/* Status Stage Switcher */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[10px] font-mono font-semibold text-muted uppercase">Stage:</span>
                        <select
                          value={rec.status}
                          onChange={e => handleUpdateRecordStatus(rec.id, e.target.value)}
                          className="px-2.5 py-1 bg-surface-2 border border-line focus:border-accent rounded text-[11px] font-semibold text-accent focus:outline-none cursor-pointer"
                        >
                          {currentOperationalModule.workflowStages.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: MEMBERS MANAGEMENT                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="space-y-4 animate-fade-in">
          {/* Members Toolbar matching Projects standard */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg border border-divider rounded-xl shadow-sm p-3">
            <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-sm">
              <div className="relative w-full">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search roster by name, email, or role..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-text placeholder-muted/60 focus:outline-none transition-colors"
                />
                {memberSearch && (
                  <button onClick={() => setMemberSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-surface-2 border border-divider text-muted tabular-nums">
                {filteredMembers.length} of {members.length} Members
              </span>

              {canManageThisDept && (
                <button
                  onClick={() => setIsAddMemberOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Add Member</span>
                </button>
              )}
            </div>
          </div>

          {/* Members Structured Table */}
          {filteredMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={memberSearch ? 'No members match this query' : 'No department members assigned'}
              description={
                memberSearch
                  ? 'Try searching by a different name, email, or department role.'
                  : 'Assign personnel to this department to enable collaborative workspaces and role delegation.'
              }
              action={canManageThisDept ? { label: 'Add First Member', onClick: () => setIsAddMemberOpen(true) } : undefined}
            />
          ) : (
            <div className="bg-card-bg border border-divider rounded-xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-surface-2/50 select-none">
                <div className="col-span-6 sm:col-span-5">Member Personnel</div>
                <div className="col-span-3 sm:col-span-3">Department Role</div>
                <div className="col-span-3 sm:col-span-3">Enrolled</div>
                <div className="col-span-12 sm:col-span-1 text-right">Action</div>
              </div>

              <div className="divide-y divide-divider">
                {filteredMembers.map((m, mIdx) => (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(mIdx * 0.03, 0.3) }}
                    key={m.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-hover/60 transition-colors items-center text-xs group"
                  >
                    <div className="col-span-6 sm:col-span-5 min-w-0 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center font-bold text-main text-xs shrink-0 shadow-2xs">
                          {m.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-main text-xs block truncate group-hover:text-accent transition-colors">
                            {m.user?.full_name}
                          </span>
                          <span className="text-[11px] font-mono text-muted truncate block mt-0.5">
                            {m.user?.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3 sm:col-span-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-2 border border-divider text-accent uppercase">
                        {m.department_role}
                      </span>
                    </div>

                    <div className="col-span-3 sm:col-span-3 text-[11px] font-mono text-muted tabular-nums">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Active'}
                    </div>

                    <div className="col-span-12 sm:col-span-1 text-right">
                      {canManageThisDept && m.user_id !== user?.id && (
                        <button
                          onClick={() => setRemoveMemberUserId(m.user_id)}
                          className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                          title="Remove Member"
                          aria-label={`Remove ${m.user?.full_name} from department`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: REAL-TIME DEPARTMENT CHAT                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div className="bg-card-bg border border-divider rounded-xl flex flex-col h-[540px] sm:h-[600px] overflow-hidden shadow-sm animate-fade-in">
          <div className="p-3.5 border-b border-divider bg-surface-2/40 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-accent" />
              <span className="text-xs font-bold font-mono text-main tracking-tight">
                #{dept?.name?.toLowerCase().replace(/\s+/g, '-')}-general
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted tabular-nums">{messages.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No messages yet"
                description={`Start the conversation with the ${dept?.name || 'department'} team. Messages sent here are encrypted and scoped to department personnel.`}
              />
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-lg bg-surface-2 border border-line text-main flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 shadow-2xs">
                    {msg.sender?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 select-none">
                      <span className="font-semibold text-main text-[11px]">{msg.sender?.full_name || 'Member'}</span>
                      <span className="text-[9px] font-mono text-muted tabular-nums">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-main bg-surface-2/60 border border-line rounded-lg p-2.5 inline-block max-w-xl leading-relaxed font-normal">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t border-divider bg-surface-2/30 flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder={`Message #${dept?.name?.toLowerCase().replace(/\s+/g, '-')}-general...`}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main placeholder-muted/60 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={sendingMsg || !newMessage.trim()}
              className="p-2 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white cursor-pointer shadow-sm shadow-accent/20 transition-all"
              title="Send Message"
              aria-label="Send Message"
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
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between bg-card-bg border border-divider rounded-xl shadow-sm p-3 select-none">
            <div>
              <h3 className="text-[10px] font-mono font-bold text-muted uppercase tracking-wider">
                Department Bulletins & Official Notices
              </h3>
              <p className="text-[11px] text-muted font-normal mt-0.5">Direct official broadcasts for department staff.</p>
            </div>
            {canManageThisDept && (
              <button
                onClick={() => setIsNewAnnounceOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-sm shadow-accent/20 cursor-pointer transition-all"
              >
                <Plus size={14} />
                <span>New Announcement</span>
              </button>
            )}
          </div>

          {announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements posted"
              description="Keep your department informed with pinned bulletins, operational directives, and official updates."
              action={canManageThisDept ? { label: 'Post First Announcement', onClick: () => setIsNewAnnounceOpen(true) } : undefined}
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((ann, aIdx) => (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(aIdx * 0.04, 0.3) }}
                  key={ann.id}
                  className="bg-card-bg border border-divider hover:border-accent/40 rounded-xl p-4.5 space-y-2.5 shadow-sm transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-main flex items-center gap-2 group-hover:text-accent transition-colors tracking-tight">
                      {ann.is_pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 border border-accent/25 text-accent text-[10px] font-mono font-semibold">
                          <Pin size={10} />
                          <span>PINNED</span>
                        </span>
                      )}
                      <span>{ann.title}</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted tabular-nums">
                      {new Date(ann.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted/90 leading-relaxed font-normal whitespace-pre-line">
                    {ann.content}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6: WORKSPACE SETTINGS (MODULE CONFIGURATION & PURPOSE EDITOR)       */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && canManageThisDept && (
        <div className="bg-card-bg border border-divider rounded-xl p-6 shadow-sm space-y-6 animate-fade-in">
          <div className="border-b border-divider pb-3.5 flex items-center justify-between select-none">
            <div>
              <h3 className="text-xs font-bold text-main uppercase font-mono tracking-wider">
                Department Workspace Configuration
              </h3>
              <p className="text-[11px] text-muted font-normal mt-0.5">Customize operational scope, responsibilities and active modules.</p>
            </div>
            <button
              onClick={() => setShowAddModuleModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-hover border border-divider text-xs font-semibold text-muted hover:text-main cursor-pointer transition-colors"
            >
              <Plus size={13} />
              <span>Add Custom Module</span>
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1.5">
                Department Purpose
              </label>
              <input
                type="text"
                value={editPurpose}
                onChange={e => setEditPurpose(e.target.value)}
                placeholder="Operational purpose of this department..."
                className="w-full px-3.5 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Summary description of department operations..."
                className="w-full px-3.5 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none resize-none transition-colors"
              />
            </div>

            {/* Responsibilities Tag Editor */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1.5">
                Operational Responsibilities
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Add responsibility and press Enter..."
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
                  className="flex-1 px-3.5 py-1.5 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editRespInput.trim() && !editResponsibilities.includes(editRespInput.trim())) {
                      setEditResponsibilities([...editResponsibilities, editRespInput.trim()]);
                      setEditRespInput('');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-surface-2 hover:bg-hover border border-divider text-xs font-semibold text-main transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 p-2.5 bg-surface-2/40 border border-line rounded-lg min-h-[44px]">
                {editResponsibilities.length === 0 ? (
                  <span className="text-[11px] text-muted/60 font-mono py-1">No responsibilities added yet.</span>
                ) : (
                  editResponsibilities.map((resp, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-divider text-muted text-[11px] font-mono"
                    >
                      <Tag size={10} className="text-accent" />
                      <span>{resp}</span>
                      <button
                        type="button"
                        onClick={() => setEditResponsibilities(editResponsibilities.filter((_, i) => i !== idx))}
                        className="hover:text-red-400 cursor-pointer transition-colors"
                        aria-label={`Remove responsibility ${resp}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-divider flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-sm shadow-accent/20 transition-all"
              >
                {savingSettings ? 'Saving...' : 'Save Workspace Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Add Custom Module in Settings ── */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4 font-sans select-none my-8 animate-scale-in">
            <div className="flex items-center justify-between pb-2.5 border-b border-divider">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-main">
                Add Custom Operational Module
              </h3>
              <button
                onClick={() => setShowAddModuleModal(false)}
                className="p-1 rounded text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Module Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Code Review, Grant Tracking, Market Intelligence"
                  value={newModName}
                  onChange={e => setNewModName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Module Description
                </label>
                <input
                  type="text"
                  placeholder="Operational purpose and scope..."
                  value={newModDesc}
                  onChange={e => setNewModDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-divider">
              <button
                type="button"
                onClick={() => setShowAddModuleModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomModuleInSettings}
                disabled={!newModName.trim()}
                className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-sm shadow-accent/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                Activate Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Operational Record Entry ── */}
      {isNewRecordOpen && currentOperationalModule && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4 font-sans select-none my-8 animate-scale-in">
            <div className="flex items-center justify-between pb-2.5 border-b border-divider">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-main flex items-center gap-2">
                <Zap size={14} className="text-accent" />
                <span>New {currentOperationalModule.name} Entry</span>
              </h3>
              <button
                onClick={() => setIsNewRecordOpen(false)}
                className="p-1 rounded text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateOperationalRecord} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Record or deliverable title..."
                  value={recordTitle}
                  onChange={e => setRecordTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Details and operational context..."
                  value={recordDesc}
                  onChange={e => setRecordDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none resize-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                    Stage
                  </label>
                  <select
                    value={recordStatus}
                    onChange={e => setRecordStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-line rounded-lg text-xs text-main focus:outline-none"
                  >
                    {currentOperationalModule.workflowStages.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={recordPriority}
                    onChange={e => setRecordPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-2 border border-line rounded-lg text-xs text-main focus:outline-none"
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
                  <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={recordAssignee}
                    onChange={e => setRecordAssignee(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-line rounded-lg text-xs text-main focus:outline-none"
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
                  <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={recordDueDate}
                    onChange={e => setRecordDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-line rounded-lg text-xs text-main focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsNewRecordOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecord || !recordTitle.trim()}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-sm shadow-accent/20 disabled:opacity-50 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4 font-sans select-none my-8 animate-scale-in">
            <div className="flex items-center justify-between pb-2.5 border-b border-divider">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-main">
                Add Member to Department
              </h3>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="p-1 rounded text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Select Employee
                </label>
                <select
                  value={selectedAddUserId}
                  onChange={e => setSelectedAddUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-lg text-xs text-main focus:outline-none"
                >
                  {allOrgUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Department Role
                </label>
                <select
                  value={selectedAddRole}
                  onChange={e => setSelectedAddRole(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-lg text-xs text-main focus:outline-none"
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
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-sm shadow-accent/20 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 shadow-2xl space-y-4 font-sans select-none my-8 animate-scale-in">
            <div className="flex items-center justify-between pb-2.5 border-b border-divider">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-main">
                Post Department Announcement
              </h3>
              <button
                onClick={() => setIsNewAnnounceOpen(false)}
                className="p-1 rounded text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Announcement title..."
                  value={annTitle}
                  onChange={e => setAnnTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  Content *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Official notice or briefing..."
                  value={annContent}
                  onChange={e => setAnnContent(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-main focus:outline-none resize-none transition-colors"
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
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAnn}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-sm shadow-accent/20 transition-all cursor-pointer"
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
