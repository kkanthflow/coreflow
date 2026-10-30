import { useState, useEffect, useCallback, useRef } from 'react';
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
  Shield, CheckCircle2, ChevronRight, Download
} from 'lucide-react';
import { toast } from '../components/ui/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

interface DepartmentDetail {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
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

export default function DepartmentWorkspace() {
  const { id: deptId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, isOwner, canManageDepartments } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'chat' | 'tasks' | 'projects' | 'meetings' | 'announcements'>('overview');
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState<DepartmentDetail | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(true);

  // Sub-modules state
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [tasks, setTasks] = useState<DeptTask[]>([]);
  const [projects, setProjects] = useState<DeptProject[]>([]);
  const [meetings, setMeetings] = useState<DeptMeeting[]>([]);
  const [announcements, setAnnouncements] = useState<DeptAnnouncement[]>([]);

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
        // Auto-provision channel if not exists
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

        // Fetch recent messages
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

      // 9. Fetch all org users for member add modal
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
          // Fetch sender details
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

          // Scroll to bottom
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channelId]);

  // Scroll chat on messages update
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

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

      // Local optimistic append if not already received via realtime
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
      const { data, error } = await supabase.rpc('assign_department_member', {
        p_department_id: deptId,
        p_target_user_id: selectedAddUserId,
        p_department_role: selectedAddRole,
        p_is_primary: true,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to assign member');

      toast.success(data?.message || 'Member assigned to department');
      setIsAddMemberOpen(false);
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign member');
    } finally {
      setAddingMember(false);
    }
  };

  // Remove Member from Department
  const handleConfirmRemoveMember = async () => {
    if (!deptId || !removeMemberUserId) return;

    try {
      const { error } = await supabase
        .from('department_members')
        .delete()
        .eq('department_id', deptId)
        .eq('user_id', removeMemberUserId);

      if (error) throw error;

      // Also remove primary department pointer in user_organizations
      await supabase
        .from('user_organizations')
        .update({ department_id: null })
        .eq('department_id', deptId)
        .eq('user_id', removeMemberUserId);

      toast.success('Member removed from department');
      setRemoveMemberUserId(null);
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !user || !annTitle.trim() || !annContent.trim()) return;

    setSavingAnn(true);
    try {
      const { error } = await supabase
        .from('department_announcements')
        .insert({
          org_id: dept?.org_id,
          department_id: deptId,
          author_id: user.id,
          title: annTitle.trim(),
          content: annContent.trim(),
          is_pinned: annPinned,
        });

      if (error) throw error;
      toast.success('Announcement published');
      setIsNewAnnounceOpen(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnPinned(false);
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish announcement');
    } finally {
      setSavingAnn(false);
    }
  };

  // Create Department Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !user || !taskTitle.trim()) return;

    setSavingTask(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          org_id: dept?.org_id,
          department_id: deptId,
          title: taskTitle.trim(),
          priority: taskPriority,
          status: 'todo',
          due_date: taskDueDate || null,
          assignee_id: taskAssigneeId || null,
          created_by: user.id,
        });

      if (error) throw error;
      toast.success('Department task created');
      setIsNewTaskOpen(false);
      setTaskTitle('');
      setTaskDueDate('');
      setTaskAssigneeId('');
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-main">Private Department Workspace</h2>
        <p className="text-xs text-muted max-w-sm">
          You do not have authorization to view this department workspace. Access is restricted to assigned department members and Organization Owners.
        </p>
        <button
          onClick={() => navigate('/departments')}
          className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg"
        >
          Return to Departments Directory
        </button>
      </div>
    );
  }

  const isHead = dept?.head_user_id === user?.id;
  const canManageThisDept = isOwner || isHead || canManageDepartments;

  const todayIso = new Date().toISOString().split('T')[0];
  const pendingTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'completed').length;
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'completed' && t.due_date && t.due_date < todayIso).length;

  const metricItems: MetricItem[] = [
    { label: 'DEPARTMENT MEMBERS', value: members.length, isOrange: true },
    { label: 'ACTIVE PROJECTS', value: projects.length },
    { label: 'PENDING TASKS', value: pendingTasks },
    { label: 'OVERDUE TASKS', value: overdueTasks },
    { label: 'UPCOMING SESSIONS', value: meetings.length },
    { label: 'ANNOUNCEMENTS', value: announcements.length },
  ];

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      {/* ── Page Header ── */}
      <PageHeader
        title={`${dept?.name || 'Department'} Workspace`}
        description={dept?.description || 'Dedicated organizational workspace for department collaboration, tasks, and real-time communication.'}
        badge={dept?.status?.toUpperCase() || 'ACTIVE'}
        breadcrumbs={[
          { label: 'Departments', href: '/departments' },
          { label: dept?.name || 'Workspace' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/departments')}
              className="p-1.5 rounded-lg border border-divider hover:border-white/20 hover:text-main text-muted transition-colors cursor-pointer"
              title="Return to Directory"
            >
              <ChevronLeft size={14} />
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
      <MetricStrip items={metricItems} />

      {/* ── Sub-module Tabs ── */}
      <div className="flex items-center bg-surface-2 p-1 rounded-xl border border-divider gap-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Building2 },
          { id: 'members', label: `Members (${members.length})`, icon: Users },
          { id: 'chat', label: 'Department Chat', icon: MessageSquare },
          { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
          { id: 'projects', label: `Projects (${projects.length})`, icon: Briefcase },
          { id: 'meetings', label: `Meetings (${meetings.length})`, icon: Video },
          { id: 'announcements', label: `Announcements (${announcements.length})`, icon: Bell },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-surface text-main shadow-xs border border-divider'
                : 'text-muted hover:text-main'
            }`}
          >
            <tab.icon size={13} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION A: DEPARTMENT OVERVIEW                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Announcements Highlight */}
            {announcements.length > 0 && (
              <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-divider pb-2.5">
                  <h3 className="text-xs font-bold text-main flex items-center gap-2">
                    <Pin size={14} className="text-accent" />
                    <span>Latest Announcements</span>
                  </h3>
                  <button onClick={() => setActiveTab('announcements')} className="text-[11px] text-accent hover:underline">
                    View all →
                  </button>
                </div>
                <div className="space-y-3">
                  {announcements.slice(0, 2).map(ann => (
                    <div key={ann.id} className="bg-surface-2/40 border border-divider rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-main">{ann.title}</span>
                        <span className="text-[10px] font-mono text-muted">
                          {new Date(ann.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted/90">{ann.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Initiatives / Projects */}
            <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-divider pb-2.5">
                <h3 className="text-xs font-bold text-main flex items-center gap-2">
                  <Briefcase size={14} className="text-blue-400" />
                  <span>Active Department Projects</span>
                </h3>
                <button onClick={() => setActiveTab('projects')} className="text-[11px] text-accent hover:underline">
                  View all ({projects.length}) →
                </button>
              </div>

              {projects.length === 0 ? (
                <p className="text-xs text-muted py-2">No projects assigned to this department yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {projects.slice(0, 4).map(p => (
                    <Link
                      key={p.id}
                      to={`/projects/${p.id}`}
                      className="bg-surface-2/40 border border-divider hover:border-accent/40 rounded-lg p-3 space-y-1.5 transition-colors block"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-main truncate">{p.title}</span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface border border-divider text-muted">
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted line-clamp-1">{p.description || 'No description'}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Tasks */}
            <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-divider pb-2.5">
                <h3 className="text-xs font-bold text-main flex items-center gap-2">
                  <CheckSquare size={14} className="text-emerald-400" />
                  <span>Operational Deliverables & Tasks</span>
                </h3>
                <button onClick={() => setActiveTab('tasks')} className="text-[11px] text-accent hover:underline">
                  View all ({tasks.length}) →
                </button>
              </div>

              {tasks.length === 0 ? (
                <p className="text-xs text-muted py-2">No active tasks in this department.</p>
              ) : (
                <div className="divide-y divide-divider">
                  {tasks.slice(0, 4).map(t => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-main truncate max-w-sm">{t.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 border border-divider text-muted">
                          {t.priority}
                        </span>
                        <span className="text-[10px] font-mono text-muted">
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No date'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Department Head & Quick Info */}
          <div className="space-y-6">
            <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-main border-b border-divider pb-2.5">
                Department Leadership
              </h3>

              {dept?.head_user ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-accent-soft border border-accent/20 text-accent flex items-center justify-center font-bold text-sm">
                    {dept.head_user.full_name?.charAt(0).toUpperCase() || 'H'}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-main block">{dept.head_user.full_name}</span>
                    <span className="text-[10px] font-mono font-bold text-accent uppercase">DEPARTMENT HEAD</span>
                    <p className="text-[11px] text-muted font-mono">{dept.head_user.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No department head currently designated.</p>
              )}

              <div className="pt-3 border-t border-divider space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Established</span>
                  <span className="font-mono text-main">{new Date(dept?.created_at || '').toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Primary Color</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept?.color || '#60A5FA' }} />
                    <span className="font-mono text-muted text-[11px]">{dept?.color}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Chat Shortcut Card */}
            <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-main flex items-center gap-2">
                  <MessageSquare size={14} className="text-accent" />
                  <span>Real-time Channel</span>
                </h3>
                <span className="text-[10px] font-mono text-emerald-400">ACTIVE</span>
              </div>
              <p className="text-xs text-muted">
                Collaborate with {members.length} team members in the dedicated department group conversation.
              </p>
              <button
                onClick={() => setActiveTab('chat')}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-2 hover:bg-hover text-main text-xs font-semibold border border-divider transition-colors cursor-pointer"
              >
                <span>Open Department Chat</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION B: DEPARTMENT MEMBERS                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <Users size={16} className="text-accent" />
              <span>Assigned Department Personnel ({members.length})</span>
            </h3>

            {canManageThisDept && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <UserPlus size={13} />
                <span>Add Member</span>
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <EmptyState
              icon={<Users size={32} className="text-muted/60" />}
              title="No personnel assigned"
              description="Add members to this department to grant them access to department workspaces, tasks, and discussions."
            />
          ) : (
            <div className="divide-y divide-divider">
              {members.map(m => {
                const isSelf = m.user_id === user?.id;
                const isHeadMember = m.department_role === 'head';

                return (
                  <div key={m.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-surface-2 border border-divider text-main flex items-center justify-center font-bold text-xs shrink-0">
                        {m.user?.full_name?.charAt(0).toUpperCase() || 'M'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-main truncate">{m.user?.full_name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-accent/10 text-accent border border-accent/20">
                              YOU
                            </span>
                          )}
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                            isHeadMember
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-surface-2 text-muted border border-divider'
                          }`}>
                            {m.department_role}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted font-mono truncate">
                          {m.user?.job_title && <span className="text-main font-sans font-medium mr-1">{m.user.job_title} ·</span>}
                          {m.user?.email}
                        </p>
                      </div>
                    </div>

                    {canManageThisDept && !isSelf && (
                      <button
                        onClick={() => setRemoveMemberUserId(m.user_id)}
                        className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remove from Department"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION C: REAL-TIME DEPARTMENT CHAT                                      */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div className="bg-card-bg border border-divider rounded-xl h-[620px] flex flex-col overflow-hidden shadow-xs">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-divider bg-surface-2/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent border border-accent/20 flex items-center justify-center font-bold text-xs">
                <MessageSquare size={15} />
              </div>
              <div>
                <span className="text-xs font-bold text-main block">{dept?.name} Collaboration</span>
                <span className="text-[10px] font-mono text-muted">{members.length} members · Encrypted in-transit</span>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted">
                <MessageSquare size={32} className="text-muted/40 mb-2" />
                <p className="text-xs font-medium">No messages yet in this department.</p>
                <p className="text-[11px] text-muted/70">Start the conversation with your team.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex gap-2.5 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-lg bg-surface-2 border border-divider flex items-center justify-center text-[10px] font-bold text-main shrink-0">
                        {msg.sender?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <span className="text-[10px] font-mono text-muted mb-0.5 ml-1">
                          {msg.sender?.full_name || 'Member'}
                        </span>
                      )}

                      {/* Reply preview if any */}
                      {msg.reply_to && (
                        <div className="text-[10px] bg-black/20 border-l-2 border-accent px-2 py-1 rounded mb-1 text-muted">
                          <span className="font-bold text-main">{msg.reply_to.sender?.full_name}:</span> {msg.reply_to.content}
                        </div>
                      )}

                      <div className={`rounded-xl px-3.5 py-2 text-xs leading-relaxed ${
                        isMe
                          ? 'bg-accent text-white shadow-xs'
                          : 'bg-surface-2 border border-divider text-main'
                      }`}>
                        {msg.content}
                      </div>

                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted/70 mt-1 px-1">
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="hover:text-main cursor-pointer"
                          title="Reply"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Replying Banner */}
          {replyingTo && (
            <div className="px-4 py-2 bg-surface-2 border-t border-divider flex items-center justify-between text-xs text-muted shrink-0">
              <span className="truncate">Replying to <strong>{replyingTo.sender?.full_name}</strong>: "{replyingTo.content}"</span>
              <button onClick={() => setReplyingTo(null)} className="hover:text-main p-0.5">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Input Box */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-divider bg-surface flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={`Message #${dept?.name || 'department'}...`}
              className="flex-1 bg-surface-2 border border-divider rounded-lg px-3.5 py-2 text-xs text-main placeholder-muted focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={sendingMsg || !newMessage.trim()}
              className="p-2 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white transition-all cursor-pointer shadow-xs shrink-0"
              title="Send Message"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION D: DEPARTMENT TASKS                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tasks' && (
        <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <CheckSquare size={16} className="text-emerald-400" />
              <span>Department Deliverables & Tasks ({tasks.length})</span>
            </h3>

            <button
              onClick={() => setIsNewTaskOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Create Task</span>
            </button>
          </div>

          {tasks.length === 0 ? (
            <EmptyState
              icon={<CheckSquare size={32} className="text-muted/60" />}
              title="No tasks recorded"
              description="Create department-specific tasks with priorities, assignees, and deadlines."
            />
          ) : (
            <div className="divide-y divide-divider">
              {tasks.map(task => {
                const isOverdue = task.due_date && task.due_date < todayIso && task.status !== 'done';
                return (
                  <div key={task.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-main truncate">{task.title}</span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">
                        Assignee: {task.assignee?.full_name || 'Unassigned'} · Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'None'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface-2 border border-divider text-muted">
                        {task.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-accent-soft text-accent border border-accent/20">
                        {task.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION E: DEPARTMENT PROJECTS                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'projects' && (
        <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <Briefcase size={16} className="text-blue-400" />
              <span>Department Initiatives & Workspaces ({projects.length})</span>
            </h3>

            <Link
              to="/projects/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>New Project</span>
            </Link>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={<Briefcase size={32} className="text-muted/60" />}
              title="No projects linked"
              description="Projects linked to this department will display here for cross-functional collaboration."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="bg-surface-2/40 border border-divider hover:border-accent/40 rounded-xl p-4 space-y-2.5 transition-all block"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-main truncate">{p.title}</span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface border border-divider text-muted">
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2">{p.description || 'No project description provided.'}</p>
                  <div className="pt-2 border-t border-divider flex items-center justify-between text-[11px] font-mono text-muted">
                    <span>Priority: {p.priority}</span>
                    <span>{p.due_date ? new Date(p.due_date).toLocaleDateString() : 'Ongoing'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION F: DEPARTMENT MEETINGS                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'meetings' && (
        <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <Video size={16} className="text-purple-400" />
              <span>Department Sessions & Standups ({meetings.length})</span>
            </h3>

            <Link
              to="/meetings/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Schedule Session</span>
            </Link>
          </div>

          {meetings.length === 0 ? (
            <EmptyState
              icon={<Video size={32} className="text-muted/60" />}
              title="No upcoming sessions"
              description="Schedule standups or sync sessions for this department."
            />
          ) : (
            <div className="divide-y divide-divider">
              {meetings.map(m => (
                <div key={m.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-main block">{m.title}</span>
                    <p className="text-[11px] text-muted font-mono mt-0.5">
                      {new Date(m.start_time).toLocaleString()} · Hosted by {m.host?.full_name || 'Leader'}
                    </p>
                  </div>

                  <Link
                    to={`/meetings/${m.id}`}
                    className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-hover text-main border border-divider text-xs font-semibold transition-colors"
                  >
                    Join Room
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION G: DEPARTMENT ANNOUNCEMENTS                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'announcements' && (
        <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <Bell size={16} className="text-accent" />
              <span>Department Notices & Bulletins ({announcements.length})</span>
            </h3>

            {canManageThisDept && (
              <button
                onClick={() => setIsNewAnnounceOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus size={13} />
                <span>Publish Notice</span>
              </button>
            )}
          </div>

          {announcements.length === 0 ? (
            <EmptyState
              icon={<Bell size={32} className="text-muted/60" />}
              title="No announcements posted"
              description="Publish notices, policy updates, and pinned circulars to all department members."
            />
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <div
                  key={ann.id}
                  className={`bg-surface-2/40 border rounded-xl p-4 space-y-2 ${
                    ann.is_pinned ? 'border-accent/40 shadow-xs' : 'border-divider'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {ann.is_pinned && <Pin size={13} className="text-accent" />}
                      <span className="text-xs font-bold text-main">{ann.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted">
                      {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                  <div className="text-[10px] font-mono text-muted/70 pt-2 border-t border-divider">
                    Posted by {ann.author?.full_name || 'Leader'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Add Member to Department ── */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg border border-divider rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
                <h3 className="text-sm font-bold text-main flex items-center gap-2">
                  <UserPlus size={16} className="text-accent" />
                  <span>Assign Personnel to Department</span>
                </h3>
                <button onClick={() => setIsAddMemberOpen(false)} className="text-muted hover:text-main p-1">
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Select Employee
                  </label>
                  <select
                    value={selectedAddUserId}
                    onChange={e => setSelectedAddUserId(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  >
                    {allOrgUsers
                      .filter(u => !members.some(m => m.user_id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Department Role
                  </label>
                  <select
                    value={selectedAddRole}
                    onChange={e => setSelectedAddRole(e.target.value)}
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  >
                    <option value="member">Department Member</option>
                    <option value="lead">Team / Discipline Lead</option>
                    <option value="head">Department Head</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-divider">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-divider text-xs text-muted hover:text-main cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingMember || !selectedAddUserId}
                    className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    {addingMember ? 'Assigning...' : 'Assign to Department'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Create Announcement ── */}
      <AnimatePresence>
        {isNewAnnounceOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg border border-divider rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
                <h3 className="text-sm font-bold text-main flex items-center gap-2">
                  <Pin size={16} className="text-accent" />
                  <span>Publish Department Announcement</span>
                </h3>
                <button onClick={() => setIsNewAnnounceOpen(false)} className="text-muted hover:text-main p-1">
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    required
                    placeholder="e.g. Q4 Sprint Objectives & Deadlines"
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Announcement Details
                  </label>
                  <textarea
                    rows={4}
                    value={annContent}
                    onChange={e => setAnnContent(e.target.value)}
                    required
                    placeholder="Provide relevant context, action items, or announcements for this department..."
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-main cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={e => setAnnPinned(e.target.checked)}
                    className="rounded border-divider text-accent focus:ring-0"
                  />
                  <span>Pin this announcement to top of department workspace</span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-divider">
                  <button
                    type="button"
                    onClick={() => setIsNewAnnounceOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-divider text-xs text-muted hover:text-main cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAnn || !annTitle.trim()}
                    className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    {savingAnn ? 'Publishing...' : 'Publish Announcement'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Create Task ── */}
      <AnimatePresence>
        {isNewTaskOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg border border-divider rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
                <h3 className="text-sm font-bold text-main flex items-center gap-2">
                  <CheckSquare size={16} className="text-accent" />
                  <span>Create Department Task</span>
                </h3>
                <button onClick={() => setIsNewTaskOpen(false)} className="text-muted hover:text-main p-1">
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    required
                    placeholder="e.g. Audit API telemetry logs"
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={e => setTaskPriority(e.target.value)}
                      className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={e => setTaskDueDate(e.target.value)}
                      className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={taskAssigneeId}
                    onChange={e => setTaskAssigneeId(e.target.value)}
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user?.full_name} ({m.user?.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-divider">
                  <button
                    type="button"
                    onClick={() => setIsNewTaskOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-divider text-xs text-muted hover:text-main cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTask || !taskTitle.trim()}
                    className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    {savingTask ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Confirm Remove Member ── */}
      <ConfirmModal
        isOpen={!!removeMemberUserId}
        onClose={() => setRemoveMemberUserId(null)}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Member from Department"
        message="Are you sure you want to remove this member from the department? Their general organization account and access to other workspaces will not be affected."
        confirmText="Remove"
        variant="danger"
      />
    </div>
  );
}

