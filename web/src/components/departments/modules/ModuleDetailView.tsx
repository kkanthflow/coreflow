import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Plus, Search, Filter, CheckCircle2, Clock,
  AlertTriangle, Trash2, Edit2, X, ExternalLink, FileText,
  DollarSign, Layers, User, Calendar, Tag, ChevronDown,
  Check, Briefcase, Shield, TrendingUp, Bug, Users, Receipt,
  PiggyBank, HelpCircle, Send, Save, AlertCircle, RefreshCw,
  Sparkles, Award, Compass, LifeBuoy, CheckSquare, Package, Truck
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from '../../ui/Toast';
import ConfirmModal from '../../ConfirmModal';

export interface DepartmentOperationalRecord {
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
  updated_at: string;
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface ModuleDetailViewProps {
  module: {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    capabilityKey: string;
  };
  deptId: string;
  orgId: string;
  deptName: string;
  members: {
    id: string;
    user_id: string;
    department_role: string;
    user?: {
      id: string;
      full_name?: string;
      email?: string;
    };
  }[];
  canManage: boolean;
  onBack: () => void;
}

export function ModuleDetailView({
  module,
  deptId,
  orgId,
  deptName,
  members,
  canManage,
  onBack,
}: ModuleDetailViewProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<DepartmentOperationalRecord[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DepartmentOperationalRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [metaAmount, setMetaAmount] = useState('');
  const [metaPeriod, setMetaPeriod] = useState('Q1');
  const [metaVendor, setMetaVendor] = useState('');
  const [metaSeverity, setMetaSeverity] = useState('medium');
  const [metaPoints, setMetaPoints] = useState('');
  const [metaCompany, setMetaCompany] = useState('');

  // 1. Fetch Records
  const fetchRecords = async () => {
    setLoading(true);
    try {
      if (module.id === 'invoices') {
        // Query live invoices
        const { data: invData, error: invErr } = await supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            status,
            total_amount,
            balance_due,
            currency,
            due_date,
            created_at,
            client:clients(name, company_name)
          `)
          .eq('organization_id', orgId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (invErr) throw invErr;
        setInvoices(invData || []);
      } else {
        const { data, error } = await supabase
          .from('department_records')
          .select(`
            *,
            assigned_user:users!assigned_to(id, full_name, email)
          `)
          .eq('department_id', deptId)
          .eq('module_key', module.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRecords(data || []);
      }
    } catch (err: any) {
      console.error('Failed to load module records:', err);
      toast.error(err.message || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [module.id, deptId, orgId]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setTitle('');
    setDescription('');
    setStatus(module.id === 'sprint_board' ? 'planning' : module.id === 'leads' ? 'new' : 'pending');
    setPriority('medium');
    setAssignedTo('');
    setDueDate('');
    setMetaAmount('');
    setMetaPeriod('Q1');
    setMetaVendor('');
    setMetaSeverity('medium');
    setMetaPoints('5');
    setMetaCompany('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: DepartmentOperationalRecord) => {
    setEditingRecord(rec);
    setTitle(rec.title);
    setDescription(rec.description || '');
    setStatus(rec.status);
    setPriority(rec.priority || 'medium');
    setAssignedTo(rec.assigned_to || '');
    setDueDate(rec.due_date || '');
    setMetaAmount(rec.metadata?.amount?.toString() || rec.metadata?.allocated_amount?.toString() || '');
    setMetaPeriod(rec.metadata?.fiscal_period || 'Q1');
    setMetaVendor(rec.metadata?.vendor || '');
    setMetaSeverity(rec.metadata?.severity || 'medium');
    setMetaPoints(rec.metadata?.story_points?.toString() || '');
    setMetaCompany(rec.metadata?.company || '');
    setIsModalOpen(true);
  };

  // Save Record (Create or Update)
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const metadata: Record<string, any> = { ...(editingRecord?.metadata || {}) };

      if (metaAmount) {
        if (module.id === 'budgets') {
          metadata.allocated_amount = parseFloat(metaAmount) || 0;
          metadata.fiscal_period = metaPeriod;
          metadata.spent_amount = metadata.spent_amount || 0;
        } else {
          metadata.amount = parseFloat(metaAmount) || 0;
        }
      }
      if (metaVendor) metadata.vendor = metaVendor;
      if (metaSeverity) metadata.severity = metaSeverity;
      if (metaPoints) metadata.story_points = parseInt(metaPoints, 10) || 0;
      if (metaCompany) metadata.company = metaCompany;

      if (editingRecord) {
        // Update
        const { error } = await supabase
          .from('department_records')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            status,
            priority,
            assigned_to: assignedTo || null,
            due_date: dueDate || null,
            metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRecord.id);

        if (error) throw error;
        toast.success('Record updated successfully.');
      } else {
        // Insert
        const { error } = await supabase
          .from('department_records')
          .insert({
            org_id: orgId,
            department_id: deptId,
            module_key: module.id,
            title: title.trim(),
            description: description.trim() || null,
            status,
            priority,
            assigned_to: assignedTo || null,
            due_date: dueDate || null,
            metadata,
            created_by: user?.id || null,
          });

        if (error) throw error;
        toast.success('Record created successfully.');
      }

      setIsModalOpen(false);
      fetchRecords();
    } catch (err: any) {
      console.error('Error saving record:', err);
      toast.error(err.message || 'Failed to save record.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Record deleted.');
      setDeleteConfirmId(null);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record.');
    }
  };

  // Quick Status Update
  const handleQuickStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Status updated to ${newStatus}.`);
      setRecords(prev => prev.map(r => (r.id === id ? { ...r, status: newStatus } : r)));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.assigned_user?.full_name && r.assigned_user.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [records, searchQuery, statusFilter, priorityFilter]);

  // Metrics
  const metrics = useMemo(() => {
    if (module.id === 'invoices') {
      const totalAmount = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
      const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
      const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
      return { total: invoices.length, totalAmount, paid: paidInvoices, overdue: overdueInvoices };
    }

    const total = records.length;
    const completed = records.filter(r => ['completed', 'approved', 'resolved', 'won', 'reimbursed'].includes(r.status)).length;
    const active = records.filter(r => ['active', 'in_progress', 'qualified', 'proposal'].includes(r.status)).length;
    const urgent = records.filter(r => r.priority === 'urgent' || r.priority === 'high').length;

    let totalBudget = 0;
    let totalSpent = 0;
    if (module.id === 'budgets') {
      records.forEach(r => {
        totalBudget += Number(r.metadata?.allocated_amount || 0);
        totalSpent += Number(r.metadata?.spent_amount || 0);
      });
    }

    return { total, completed, active, urgent, totalBudget, totalSpent };
  }, [records, invoices, module.id]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── TOP BREADCRUMB & HEADER ── */}
      <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Capability Modules</span>
            </button>
            <span>/</span>
            <span className="text-text-muted uppercase tracking-wider text-[11px] font-semibold">
              {module.category}
            </span>
            <span>/</span>
            <span className="text-text-primary font-bold">{module.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRecords}
              className="p-2 text-text-muted hover:text-text-primary border border-border-subtle rounded-lg bg-surface-2 transition-colors"
              title="Refresh Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {module.id !== 'invoices' && canManage && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {module.id === 'budgets'
                    ? 'New Budget'
                    : module.id === 'expenses'
                    ? 'Submit Expense'
                    : module.id === 'leads'
                    ? 'New Lead'
                    : module.id === 'sprint_board'
                    ? 'Create Sprint'
                    : module.id === 'bug_tracker'
                    ? 'Log Bug'
                    : `Add ${module.name} Record`}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-text-primary">{module.name}</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-2 border border-border-subtle text-text-muted">
                {deptName} Workspace
              </span>
            </div>
            <p className="text-xs text-text-muted max-w-2xl">{module.description}</p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs">
            {module.id === 'budgets' ? (
              <>
                <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-right">
                  <div className="text-[10px] text-text-muted uppercase font-semibold">Allocated Budget</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    ${metrics.totalBudget.toLocaleString()}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-right">
                  <div className="text-[10px] text-text-muted uppercase font-semibold">Remaining</div>
                  <div className="text-sm font-bold text-text-primary font-mono">
                    ${(metrics.totalBudget - metrics.totalSpent).toLocaleString()}
                  </div>
                </div>
              </>
            ) : module.id === 'invoices' ? (
              <>
                <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-right">
                  <div className="text-[10px] text-text-muted uppercase font-semibold">Total Billed</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    ${metrics.totalAmount?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-right">
                  <div className="text-[10px] text-text-muted uppercase font-semibold">Invoices</div>
                  <div className="text-sm font-bold text-text-primary font-mono">{metrics.total}</div>
                </div>
              </>
            ) : (
              <>
                <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-right">
                  <div className="text-[10px] text-text-muted uppercase font-semibold">Total Records</div>
                  <div className="text-sm font-bold text-text-primary font-mono">{metrics.total}</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-right">
                  <div className="text-[10px] text-text-muted uppercase font-semibold">Active</div>
                  <div className="text-sm font-bold text-accent font-mono">{metrics.active}</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-right">
                  <div className="text-[10px] text-text-muted uppercase font-semibold">Completed</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">{metrics.completed}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      {module.id !== 'invoices' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${module.name} records...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-1 border border-border-subtle rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 bg-surface-1 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="in_progress">In Progress</option>
              <option value="planning">Planning</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-2.5 py-2 bg-surface-1 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      )}

      {/* ── DATA SECTION ── */}
      {loading ? (
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-12 text-center text-text-muted text-xs space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-accent" />
          <p>Loading operational records for {module.name}...</p>
        </div>
      ) : module.id === 'invoices' ? (
        /* INVOICES SPECIAL VIEW */
        invoices.length === 0 ? (
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-12 text-center space-y-3">
            <FileText className="w-10 h-10 mx-auto text-text-muted" />
            <h4 className="text-sm font-semibold text-text-primary">No Invoices Found</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              No organization invoices recorded yet. You can create invoices from the top-level Invoices module.
            </p>
          </div>
        ) : (
          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                      {inv.invoice_number || 'INV-DRAFT'}
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {inv.client?.company_name || inv.client?.name || 'Standard Client'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-text-primary">
                      ${Number(inv.total_amount).toLocaleString()} {inv.currency || 'USD'}
                    </td>
                    <td className="py-3 px-4 font-mono text-text-muted">
                      ${Number(inv.balance_due || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : inv.status === 'overdue'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filteredRecords.length === 0 ? (
        /* EMPTY STATE FOR RECORDS */
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-text-primary">No Records in {module.name}</h4>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Get started by creating your first operational entry for this capability. All records persist to the
              department database and can be tracked by authorized team members.
            </p>
          </div>
          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Record</span>
            </button>
          )}
        </div>
      ) : (
        /* RECORDS TABLE & CARDS */
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Title & Details</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority</th>
                {module.id === 'budgets' && <th className="py-3 px-4">Allocated / Spent</th>}
                {module.id === 'expenses' && <th className="py-3 px-4">Amount & Vendor</th>}
                {module.id === 'leads' && <th className="py-3 px-4">Deal Value & Company</th>}
                {module.id === 'sprint_board' && <th className="py-3 px-4">Story Points</th>}
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Due Date</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredRecords.map(rec => (
                <tr key={rec.id} className="hover:bg-surface-2/40 transition-colors">
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-semibold text-text-primary truncate">{rec.title}</div>
                    {rec.description && (
                      <div className="text-[11px] text-text-muted truncate mt-0.5">{rec.description}</div>
                    )}
                  </td>

                  {/* Status Cell with Quick Actions */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {canManage ? (
                      <select
                        value={rec.status}
                        onChange={e => handleQuickStatus(rec.id, e.target.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border bg-surface-2 ${
                          ['completed', 'approved', 'resolved', 'won'].includes(rec.status)
                            ? 'text-emerald-400 border-emerald-500/20'
                            : ['in_progress', 'active'].includes(rec.status)
                            ? 'text-accent border-accent/20'
                            : ['rejected', 'lost'].includes(rec.status)
                            ? 'text-red-400 border-red-500/20'
                            : 'text-amber-400 border-amber-500/20'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-2 border border-border-subtle text-text-muted">
                        {rec.status}
                      </span>
                    )}
                  </td>

                  {/* Priority Tag */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        rec.priority === 'urgent'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : rec.priority === 'high'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : rec.priority === 'medium'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-surface-2 text-text-muted border border-border-subtle'
                      }`}
                    >
                      {rec.priority}
                    </span>
                  </td>

                  {/* Domain Columns */}
                  {module.id === 'budgets' && (
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      <span className="font-bold text-emerald-400">
                        ${Number(rec.metadata?.allocated_amount || 0).toLocaleString()}
                      </span>
                      <span className="text-text-muted text-[10px] ml-1">
                        / ${(Number(rec.metadata?.spent_amount) || 0).toLocaleString()}
                      </span>
                    </td>
                  )}

                  {module.id === 'expenses' && (
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-text-primary">
                        ${Number(rec.metadata?.amount || 0).toLocaleString()}
                      </span>
                      {rec.metadata?.vendor && (
                        <div className="text-[10px] text-text-muted">{rec.metadata.vendor}</div>
                      )}
                    </td>
                  )}

                  {module.id === 'leads' && (
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-emerald-400">
                        ${Number(rec.metadata?.amount || 0).toLocaleString()}
                      </span>
                      {rec.metadata?.company && (
                        <div className="text-[10px] text-text-muted">{rec.metadata.company}</div>
                      )}
                    </td>
                  )}

                  {module.id === 'sprint_board' && (
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-semibold text-accent">
                      {rec.metadata?.story_points || '—'} pts
                    </td>
                  )}

                  {/* Assigned User */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {rec.assigned_user ? (
                      <span className="inline-flex items-center gap-1.5 text-text-primary">
                        <User className="w-3.5 h-3.5 text-text-muted" />
                        <span>{rec.assigned_user.full_name || rec.assigned_user.email}</span>
                      </span>
                    ) : (
                      <span className="text-text-muted">Unassigned</span>
                    )}
                  </td>

                  {/* Due Date */}
                  <td className="py-3 px-4 whitespace-nowrap text-text-muted">
                    {rec.due_date ? new Date(rec.due_date).toLocaleDateString() : '—'}
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1.5 hover:bg-surface-2 rounded text-text-muted hover:text-text-primary transition-colors"
                          title="Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(rec.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-400 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-lg w-full shadow-xl overflow-hidden animate-scale-in">
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">
                  {editingRecord ? `Edit ${module.name} Record` : `Create New ${module.name} Record`}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRecord} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    module.id === 'budgets'
                      ? 'e.g. Q1 Infrastructure & Cloud Budget'
                      : module.id === 'expenses'
                      ? 'e.g. Cloud Hosting Renewal AWS'
                      : module.id === 'leads'
                      ? 'e.g. Acme Corp Enterprise Deal'
                      : module.id === 'sprint_board'
                      ? 'e.g. Sprint 24 — Authentication Upgrade'
                      : module.id === 'bug_tracker'
                      ? 'e.g. Payment Gateway Webhook Timeout'
                      : 'Record title...'
                  }
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">Description & Operational Notes</label>
                <textarea
                  rows={2}
                  placeholder="Provide scope, deliverables, or context..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent resize-none"
                />
              </div>

              {/* Dynamic Domain Specific Inputs */}
              {(module.id === 'budgets' || module.id === 'expenses' || module.id === 'leads') && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-primary">
                      {module.id === 'budgets' ? 'Budget Allocation ($)' : 'Amount ($)'}
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={metaAmount}
                      onChange={e => setMetaAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-primary">
                      {module.id === 'budgets'
                        ? 'Fiscal Period'
                        : module.id === 'expenses'
                        ? 'Vendor'
                        : 'Company Name'}
                    </label>
                    {module.id === 'budgets' ? (
                      <select
                        value={metaPeriod}
                        onChange={e => setMetaPeriod(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
                      >
                        <option value="Q1">Q1 (Jan - Mar)</option>
                        <option value="Q2">Q2 (Apr - Jun)</option>
                        <option value="Q3">Q3 (Jul - Sep)</option>
                        <option value="Q4">Q4 (Oct - Dec)</option>
                        <option value="Annual">Annual Fiscal Year</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder={module.id === 'expenses' ? 'e.g. AWS, Zoom' : 'e.g. Global Tech Ltd'}
                        value={module.id === 'expenses' ? metaVendor : metaCompany}
                        onChange={e =>
                          module.id === 'expenses'
                            ? setMetaVendor(e.target.value)
                            : setMetaCompany(e.target.value)
                        }
                        className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
                      />
                    )}
                  </div>
                </div>
              )}

              {module.id === 'sprint_board' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Story Points Capacity</label>
                  <input
                    type="number"
                    placeholder="e.g. 40"
                    value={metaPoints}
                    onChange={e => setMetaPoints(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden focus:border-accent"
                  />
                </div>
              )}

              {/* Row for Status, Priority, Assignee */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">Assign To Team Member</label>
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden focus:border-accent"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.user?.id || m.user_id}>
                      {m.user?.full_name || m.user?.email || `Member (${m.department_role})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 bg-surface-2 border border-border-subtle text-text-muted hover:text-text-primary rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editingRecord ? 'Save Changes' : 'Create Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <ConfirmModal
          isOpen={true}
          title="Delete Operational Record"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete Record"
          isDanger={true}
          onConfirm={() => handleDeleteRecord(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
