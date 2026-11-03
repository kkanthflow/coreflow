import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, CheckSquare, Plus, Search, Filter, Shield,
  Users, BarChart2, CheckCircle2, Clock, AlertCircle,
  Settings, ArrowRight, Tag, Calendar, FolderCheck
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../ui/Toast';
import { DepartmentHeader } from '../DepartmentHeader';
import { DepartmentTabs, type TabDefinition } from '../DepartmentTabs';
import type { DepartmentOperationalRecord } from '../modules/ModuleDetailView';

interface CustomWorkspaceProps {
  department: any;
  deptId: string;
  orgId: string;
  members: any[];
  canAdminWorkspace: boolean;
  isOwner: boolean;
  hasOrgOversight: boolean;
  activeCapabilities: any[];
  onRefresh: () => void;
  onOpenSettings?: () => void;
}

export function CustomWorkspace({
  department,
  deptId,
  orgId,
  members,
  canAdminWorkspace,
  isOwner,
  hasOrgOversight,
  activeCapabilities = [],
  onRefresh,
  onOpenSettings,
}: CustomWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [records, setRecords] = useState<DepartmentOperationalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // New Record Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordDesc, setRecordDesc] = useState('');
  const [recordModule, setRecordModule] = useState('');
  const [recordPriority, setRecordPriority] = useState('normal');

  const fetchCustomData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('department_records')
        .select('*')
        .eq('department_id', deptId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err: any) {
      console.error('Error fetching custom department data:', err);
      toast.error('Failed to load department records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (deptId) {
      fetchCustomData();
    }
  }, [deptId]);

  useEffect(() => {
    if (activeCapabilities.length > 0 && !recordModule) {
      setRecordModule(activeCapabilities[0].key || activeCapabilities[0].name);
    }
  }, [activeCapabilities, recordModule]);

  // Handlers
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordTitle.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: recordModule || 'general_tasks',
        title: recordTitle.trim(),
        description: recordDesc.trim(),
        record_type: 'custom_item',
        status: 'active',
        priority: recordPriority,
        metadata: {
          created_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
      toast.success('Record created successfully.');
      setIsRecordModalOpen(false);
      setRecordTitle('');
      setRecordDesc('');
      fetchCustomData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', recordId);

      if (error) throw error;
      toast.success(`Record updated to ${newStatus}.`);
      fetchCustomData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update record.');
    }
  };

  // Group capabilities by category
  const capabilityStats = useMemo(() => {
    const totalCaps = activeCapabilities.length;
    const totalRecords = records.length;
    const completedRecords = records.filter((r) => r.status === 'completed' || r.status === 'closed').length;
    const activeRecords = records.filter((r) => r.status === 'active' || r.status === 'pending' || r.status === 'in_progress').length;

    return {
      totalCaps,
      totalRecords,
      completedRecords,
      activeRecords,
    };
  }, [activeCapabilities, records]);

  // Tabs
  const tabs: TabDefinition[] = [
    { key: 'overview', label: 'Overview', icon: BarChart2 },
    { key: 'operations', label: 'Operational Hub', icon: Layers, badge: records.length },
    { key: 'capabilities', label: 'Active Capabilities', icon: CheckSquare, badge: activeCapabilities.length },
    { key: 'team', label: 'Department Team', icon: Users, badge: members.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <DepartmentHeader
        department={department}
        deptId={deptId}
        canAdminWorkspace={canAdminWorkspace}
        isOwner={isOwner}
        hasOrgOversight={hasOrgOversight}
        primaryDomain="Dynamic Capability Engine"
        onRefresh={() => {
          onRefresh();
          fetchCustomData();
        }}
      />

      {/* Navigation */}
      <DepartmentTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Enabled Capabilities</span>
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text-primary">{capabilityStats.totalCaps}</span>
                <span className="text-xs text-text-muted">active modules</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-indigo-400">
                <span>Dynamically synthesized</span>
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Work Items</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <CheckSquare className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text-primary">{capabilityStats.activeRecords}</span>
                <span className="text-xs text-emerald-400">in progress</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-text-muted">
                <span>{capabilityStats.completedRecords} completed</span>
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Team Personnel</span>
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text-primary">{members.length}</span>
                <span className="text-xs text-text-muted">members assigned</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-cyan-400">
                <span>Collaborating across domains</span>
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Workspace Governance</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">Secure</span>
                <span className="text-xs text-text-muted">RLS Enforced</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-text-muted">
                <span>Org-scoped private identity</span>
              </div>
            </div>
          </div>

          {/* Department Scope & Mission */}
          <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6">
            <h3 className="text-base font-semibold text-text-primary mb-2">Department Mission & Objectives</h3>
            <p className="text-sm text-text-secondary">
              {department.description || 'This department operates as an agile, capability-driven unit within the organization.'}
            </p>
          </div>

          {/* Capabilities Grid */}
          <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Enabled Capabilities ({activeCapabilities.length})
              </h3>
              {canAdminWorkspace && onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configure Capabilities
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeCapabilities.map((cap) => (
                <div key={cap.id || cap.key} className="p-3 bg-surface-base border border-border-subtle rounded-lg">
                  <p className="text-sm font-semibold text-text-primary">{cap.name || cap.key}</p>
                  <p className="text-xs text-text-muted mt-1">{cap.description || 'Functional capability active.'}</p>
                  <span className="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                    {cap.category || 'Operational'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. OPERATIONS HUB */}
      {activeTab === 'operations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-text-primary">Department Operational Items</h2>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Work Item
            </button>
          </div>

          <div className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-base border-b border-border-subtle text-xs text-text-muted uppercase">
                  <tr>
                    <th className="px-6 py-3">Title / Work Item</th>
                    <th className="px-6 py-3">Capability Module</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                        No operational items logged for this department yet.
                      </td>
                    </tr>
                  ) : (
                    records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-surface-base/50">
                        <td className="px-6 py-4 font-medium text-text-primary">{rec.title}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium">
                            {rec.module_key}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                            rec.priority === 'urgent' ? 'bg-red-500/10 text-red-400' :
                            rec.priority === 'high' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-surface-base text-text-muted'
                          }`}>
                            {rec.priority || 'normal'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={rec.status}
                            onChange={(e) => handleStatusChange(rec.id, e.target.value)}
                            className="bg-surface-base text-xs border border-border-subtle rounded px-2 py-1 text-text-secondary"
                          >
                            <option value="active">Active</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-xs text-text-muted">
                          {new Date(rec.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-emerald-400">Synced</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. CAPABILITIES */}
      {activeTab === 'capabilities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Department Capabilities Architecture</h3>
            {canAdminWorkspace && onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                Manage Capabilities
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCapabilities.map((cap) => (
              <div key={cap.id || cap.key} className="bg-surface-elevated border border-border-subtle rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                    {cap.category || 'Operational'}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="mt-3 text-base font-semibold text-text-primary">{cap.name || cap.key}</h4>
                <p className="mt-1 text-xs text-text-muted">{cap.description || 'Active operational capability.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TEAM */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Department Personnel</h3>
            <span className="text-xs text-text-muted">{members.length} Members</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <div key={member.id} className="bg-surface-elevated border border-border-subtle rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                  {member.user?.name ? member.user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">{member.user?.name || member.user?.email || 'Unknown'}</p>
                  <p className="text-xs text-text-muted capitalize">{member.department_role || 'Member'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-elevated border border-border-subtle rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Create Work Item</h3>
            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={recordTitle}
                  onChange={(e) => setRecordTitle(e.target.value)}
                  placeholder="e.g. Q4 Milestone Audit"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Module</label>
                  <select
                    value={recordModule}
                    onChange={(e) => setRecordModule(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    {activeCapabilities.map((cap) => (
                      <option key={cap.id || cap.key} value={cap.key || cap.name}>
                        {cap.name || cap.key}
                      </option>
                    ))}
                    {activeCapabilities.length === 0 && (
                      <option value="general_tasks">General Tasks</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Priority</label>
                  <select
                    value={recordPriority}
                    onChange={(e) => setRecordPriority(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
                <textarea
                  rows={3}
                  value={recordDesc}
                  onChange={(e) => setRecordDesc(e.target.value)}
                  placeholder="Details regarding this work item..."
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  {submitting ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
