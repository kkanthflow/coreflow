import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Receipt, PiggyBank, FileText, ArrowDownRight,
  ArrowUpRight, BarChart3, Plus, Search, Filter, CheckCircle2,
  Clock, AlertTriangle, RefreshCw, Users, Shield, ArrowRight,
  TrendingUp, Check, X, Calendar, User, Tag, Download
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../ui/Toast';
import { DepartmentHeader } from '../DepartmentHeader';
import { DepartmentTabs, type TabDefinition } from '../DepartmentTabs';
import type { DepartmentOperationalRecord } from '../modules/ModuleDetailView';
import ConfirmModal from '../../ConfirmModal';

interface FinanceWorkspaceProps {
  department: any;
  deptId: string;
  orgId: string;
  members: any[];
  canAdminWorkspace: boolean;
  isOwner: boolean;
  hasOrgOversight: boolean;
  onRefresh: () => void;
}

export function FinanceWorkspace({
  department,
  deptId,
  orgId,
  members,
  canAdminWorkspace,
  isOwner,
  hasOrgOversight,
  onRefresh,
}: FinanceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [budgets, setBudgets] = useState<DepartmentOperationalRecord[]>([]);
  const [expenses, setExpenses] = useState<DepartmentOperationalRecord[]>([]);
  const [payables, setPayables] = useState<DepartmentOperationalRecord[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Budget form
  const [budgetTitle, setBudgetTitle] = useState('');
  const [budgetDesc, setBudgetDesc] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState('Q1');
  const [budgetCategory, setBudgetCategory] = useState('Operations');

  // Expense form
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Software');

  // Load finance records
  const loadFinanceData = async () => {
    setLoading(true);
    try {
      // 1. Load department_records for budgets, expenses, payables
      const { data: recordsData, error: recordsErr } = await supabase
        .from('department_records')
        .select(`
          *,
          assigned_user:users!assigned_to(id, full_name, email)
        `)
        .eq('department_id', deptId);

      if (recordsErr) throw recordsErr;

      const allRecords = recordsData || [];
      setBudgets(allRecords.filter(r => r.module_key === 'budgets'));
      setExpenses(allRecords.filter(r => r.module_key === 'expenses'));
      setPayables(allRecords.filter(r => r.module_key === 'payables'));

      // 2. Load organization invoices from public.invoices
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, status, total_amount, balance_due, currency, due_date, created_at,
          client:clients(name, company_name)
        `)
        .eq('organization_id', orgId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (invErr) throw invErr;
      setInvoices(invData || []);
    } catch (err: any) {
      console.error('Error loading finance workspace data:', err);
      toast.error('Failed to load financial records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, [deptId, orgId]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalAllocated = 0;
    let totalSpent = 0;
    budgets.forEach(b => {
      totalAllocated += Number(b.metadata?.allocated_amount || 0);
      totalSpent += Number(b.metadata?.spent_amount || 0);
    });

    const pendingExpenses = expenses.filter(e => e.status === 'pending');
    const totalPendingClaims = pendingExpenses.reduce((sum, e) => sum + Number(e.metadata?.amount || 0), 0);

    const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
    const totalDue = invoices.reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

    const utilizationPct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

    return {
      totalAllocated,
      totalSpent,
      remaining: Math.max(0, totalAllocated - totalSpent),
      utilizationPct,
      pendingCount: pendingExpenses.length,
      totalPendingClaims,
      totalInvoiced,
      totalDue,
    };
  }, [budgets, expenses, invoices]);

  // Handle Create Budget
  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetTitle.trim() || !budgetAmount) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'budgets',
        title: budgetTitle.trim(),
        description: budgetDesc.trim() || null,
        status: 'active',
        priority: 'high',
        metadata: {
          allocated_amount: parseFloat(budgetAmount),
          spent_amount: 0,
          fiscal_period: budgetPeriod,
          category: budgetCategory,
        },
      });

      if (error) throw error;
      toast.success('Budget allocation created.');
      setIsBudgetModalOpen(false);
      setBudgetTitle('');
      setBudgetDesc('');
      setBudgetAmount('');
      loadFinanceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create budget.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Submit Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'expenses',
        title: expenseTitle.trim(),
        description: `Expense claim for ${expenseVendor || 'Vendor'}`,
        status: 'pending',
        priority: 'medium',
        metadata: {
          amount: parseFloat(expenseAmount),
          vendor: expenseVendor.trim() || 'General Vendor',
          category: expenseCategory,
        },
      });

      if (error) throw error;
      toast.success('Expense claim submitted for approval.');
      setIsExpenseModalOpen(false);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseVendor('');
      loadFinanceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Expense Status (Approve / Reject)
  const handleExpenseAction = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Expense marked as ${newStatus}.`);
      loadFinanceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update expense status.');
    }
  };

  // Finance Navigation Tabs
  const financeTabs: TabDefinition[] = [
    { id: 'overview', label: 'Fiscal Overview', icon: DollarSign },
    { id: 'budgets', label: 'Budgets & Allocations', count: budgets.length, icon: PiggyBank },
    { id: 'expenses', label: 'Expense Claims', count: expenses.length, icon: Receipt },
    { id: 'invoices', label: 'Invoices & Billing', count: invoices.length, icon: FileText },
    { id: 'payables', label: 'Accounts Payable', count: payables.length, icon: ArrowDownRight },
    { id: 'reports', label: 'Financial Audits', icon: BarChart3 },
    { id: 'team', label: 'Finance Team', count: members.length, icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <DepartmentHeader
        name={department.name}
        description={department.description || 'Departmental fiscal planning, budget governance, expenses, and invoices.'}
        color={department.color || '#10B981'}
        badge="FINANCE & TREASURY"
        headUser={department.head_user}
        parentDepartmentName={department.parent_department?.name}
      />

      {/* ── FINANCIAL KPI METRIC STRIP ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Total Budget</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            ${metrics.totalAllocated.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1">{budgets.length} Active Allocations</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Total Spent</div>
          <div className="text-xl font-bold font-mono text-text-primary mt-1">
            ${metrics.totalSpent.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1">{metrics.utilizationPct}% Budget Utilized</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Remaining Budget</div>
          <div className="text-xl font-bold font-mono text-accent mt-1">
            ${metrics.remaining.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-1">Positive Variance</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Total Billed Invoices</div>
          <div className="text-xl font-bold font-mono text-blue-400 mt-1">
            ${metrics.totalInvoiced.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1">{invoices.length} Invoices (${metrics.totalDue.toLocaleString()} Due)</div>
        </div>
      </div>

      {/* ── FINANCE TABS ── */}
      <DepartmentTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={financeTabs}
      />

      {/* ── TAB 1: FISCAL OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Row: Budget Utilization & Cashflow Run-Rate */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Budget Burn-Rate Card */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <PiggyBank className="w-4 h-4 text-emerald-400" />
                      <span>Fiscal Allocation & Budget Burn-Rate</span>
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">Real-time expenditure tracking against departmental caps.</p>
                  </div>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsBudgetModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Budget</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-text-muted">Burn-rate: ${metrics.totalSpent.toLocaleString()}</span>
                    <span className="font-bold text-emerald-400">${metrics.totalAllocated.toLocaleString()} Total</span>
                  </div>
                  <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(metrics.utilizationPct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>{metrics.utilizationPct}% Utilized</span>
                    <span>Remaining: ${metrics.remaining.toLocaleString()}</span>
                  </div>
                </div>

                {/* Active Budgets List */}
                <div className="space-y-2 pt-3 border-t border-border-subtle">
                  <div className="text-xs font-semibold text-text-primary">Allocated Cost Centers</div>
                  {budgets.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">No budget allocations yet. Click 'New Budget' to set one.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {budgets.map(b => (
                        <div key={b.id} className="p-3 bg-surface-2 border border-border-subtle rounded-lg space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-semibold text-text-primary">{b.title}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-1 rounded text-text-muted">
                              {b.metadata?.fiscal_period || 'Q1'}
                            </span>
                          </div>
                          <div className="text-sm font-bold font-mono text-emerald-400">
                            ${Number(b.metadata?.allocated_amount || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Approvals */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Pending Expense Claims ({metrics.pendingCount})</span>
                  </h3>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsExpenseModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Submit Claim</span>
                    </button>
                  )}
                </div>

                {expenses.filter(e => e.status === 'pending').length === 0 ? (
                  <p className="text-xs text-text-muted">All submitted expense claims have been processed.</p>
                ) : (
                  <div className="space-y-2">
                    {expenses
                      .filter(e => e.status === 'pending')
                      .slice(0, 4)
                      .map(exp => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between p-3 bg-surface-2 border border-border-subtle rounded-lg text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-text-primary">{exp.title}</div>
                            <div className="text-[11px] text-text-muted">
                              Vendor: {exp.metadata?.vendor || 'Unknown'} | Category: {exp.metadata?.category || 'General'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-text-primary">
                              ${Number(exp.metadata?.amount || 0).toLocaleString()}
                            </span>
                            {canAdminWorkspace && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleExpenseAction(exp.id, 'approved')}
                                  className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 font-semibold"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleExpenseAction(exp.id, 'rejected')}
                                  className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 font-semibold"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Invoices & Treasury Controls */}
            <div className="space-y-6">
              {/* Invoices Ledger Overview */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Recent Billing</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('invoices')}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    View All →
                  </button>
                </div>

                <div className="space-y-2">
                  {invoices.slice(0, 4).map(inv => (
                    <div key={inv.id} className="p-2.5 bg-surface-2 rounded-lg border border-border-subtle flex justify-between items-center text-xs">
                      <div>
                        <div className="font-mono font-semibold text-text-primary">{inv.invoice_number || 'INV-DRAFT'}</div>
                        <div className="text-[11px] text-text-muted">{inv.client?.company_name || 'Standard Client'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-text-primary">${Number(inv.total_amount).toLocaleString()}</div>
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                          inv.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Governance & Approvals */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  <span>Fiscal Governance</span>
                </h3>
                <div className="text-xs text-text-muted space-y-2">
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>Audit Status:</span>
                    <strong className="text-emerald-400">Compliant</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>Approval Ceiling:</span>
                    <strong className="text-text-primary">$50,000 / claim</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Department Head:</span>
                    <strong className="text-text-primary">{department.head_user?.full_name || 'Unassigned'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: BUDGETS & ALLOCATIONS ── */}
      {activeTab === 'budgets' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Departmental Budget Allocations</h3>
              <p className="text-xs text-text-muted">Manage departmental budgets, quarterly caps, and fiscal variance.</p>
            </div>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsBudgetModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Allocation</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {budgets.map(b => (
              <div key={b.id} className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-2 border border-border-subtle text-text-muted">
                    {b.metadata?.fiscal_period || 'Q1'}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Active</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary">{b.title}</h4>
                  <p className="text-xs text-text-muted mt-1">{b.description || 'General departmental allocation.'}</p>
                </div>
                <div className="pt-3 border-t border-border-subtle flex justify-between items-end">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Allocated</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      ${Number(b.metadata?.allocated_amount || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-muted uppercase">Category</div>
                    <div className="text-xs font-semibold text-text-primary">{b.metadata?.category || 'Operations'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: EXPENSE CLAIMS & APPROVALS ── */}
      {activeTab === 'expenses' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Department Expense Ledger</h3>
              <p className="text-xs text-text-muted">Track employee claims, receipts, vendor reimbursements, and status.</p>
            </div>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit Claim</span>
              </button>
            )}
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  {canAdminWorkspace && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{exp.title}</td>
                    <td className="py-3 px-4 text-text-muted">{exp.metadata?.vendor || 'General'}</td>
                    <td className="py-3 px-4 text-text-muted">{exp.metadata?.category || 'Operations'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-text-primary">
                      ${Number(exp.metadata?.amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        exp.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        exp.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {exp.status}
                      </span>
                    </td>
                    {canAdminWorkspace && (
                      <td className="py-3 px-4 text-right">
                        {exp.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleExpenseAction(exp.id, 'approved')}
                              className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 font-semibold"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleExpenseAction(exp.id, 'rejected')}
                              className="px-2 py-1 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 font-semibold"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-text-muted text-[11px]">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: INVOICES & BILLING ── */}
      {activeTab === 'invoices' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Department Invoices & Accounts Receivable</h3>
              <p className="text-xs text-text-muted">Live billing ledger synced directly with organizational financial accounts.</p>
            </div>
          </div>

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
                  <tr key={inv.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-text-primary">{inv.invoice_number || 'INV-DRAFT'}</td>
                    <td className="py-3 px-4 text-text-muted">{inv.client?.company_name || 'Standard Client'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-text-primary">
                      ${Number(inv.total_amount).toLocaleString()} {inv.currency || 'USD'}
                    </td>
                    <td className="py-3 px-4 font-mono text-text-muted">${Number(inv.balance_due || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-text-muted">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        inv.status === 'overdue' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: ACCOUNTS PAYABLE ── */}
      {activeTab === 'payables' && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Accounts Payable & Supplier Liabilities</h3>
            <p className="text-xs text-text-muted">Vendor billing commitments, scheduled disbursements, and supplier invoices.</p>
          </div>
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center text-xs text-text-muted">
            <ArrowDownRight className="w-8 h-8 mx-auto text-accent mb-2" />
            <p className="font-semibold text-text-primary">Payables ledger synchronized.</p>
            <p className="mt-1">All approved vendor invoices and operational liabilities are tracked here.</p>
          </div>
        </div>
      )}

      {/* ── TAB 6: REPORTS & AUDITS ── */}
      {activeTab === 'reports' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Financial Audits & Variance Analytics</h3>
              <p className="text-xs text-text-muted">Quarterly profit & loss reconciliations and budget compliance audits.</p>
            </div>
            <button
              onClick={() => toast.success('Financial report exported to CSV.')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border-subtle text-xs font-semibold rounded-lg text-text-primary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Cost Center Performance</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border-subtle">
                  <span>Gross Budget Allocation</span>
                  <span className="font-mono font-bold text-emerald-400">${metrics.totalAllocated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border-subtle">
                  <span>Total Executed Outflows</span>
                  <span className="font-mono font-bold text-text-primary">${metrics.totalSpent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Net Budget Surplus</span>
                  <span className="font-mono font-bold text-accent">${metrics.remaining.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Accounts Receivable Summary</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border-subtle">
                  <span>Total Issued Invoices</span>
                  <span className="font-mono font-bold text-text-primary">${metrics.totalInvoiced.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border-subtle">
                  <span>Outstanding Balances Due</span>
                  <span className="font-mono font-bold text-amber-400">${metrics.totalDue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Collection Ratio</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {metrics.totalInvoiced > 0
                      ? Math.round(((metrics.totalInvoiced - metrics.totalDue) / metrics.totalInvoiced) * 100)
                      : 100}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: TEAM ── */}
      {activeTab === 'team' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Finance Department Staff & Approvers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {members.map(m => (
              <div key={m.id} className="bg-surface-1 border border-border-subtle rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  {m.user?.full_name?.charAt(0) || 'F'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-primary truncate">{m.user?.full_name || m.user?.email}</div>
                  <div className="text-[11px] text-text-muted capitalize">{m.department_role || 'member'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CREATE BUDGET MODAL ── */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">New Budget Allocation</h3>
              <button onClick={() => setIsBudgetModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBudget} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Budget Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q1 Infrastructure & Cloud"
                  value={budgetTitle}
                  onChange={e => setBudgetTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Allocation ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="25000"
                    value={budgetAmount}
                    onChange={e => setBudgetAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Period</label>
                  <select
                    value={budgetPeriod}
                    onChange={e => setBudgetPeriod(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  >
                    <option value="Q1">Q1 (Jan - Mar)</option>
                    <option value="Q2">Q2 (Apr - Jun)</option>
                    <option value="Q3">Q3 (Jul - Sep)</option>
                    <option value="Q4">Q4 (Oct - Dec)</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-primary">Category</label>
                <select
                  value={budgetCategory}
                  onChange={e => setBudgetCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                >
                  <option value="Operations">Operations</option>
                  <option value="Technology & Cloud">Technology & Cloud</option>
                  <option value="Personnel & Payroll">Personnel & Payroll</option>
                  <option value="Marketing & Outreach">Marketing & Outreach</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SUBMIT EXPENSE MODAL ── */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">Submit Expense Claim</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Expense Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Production Cloud Renewal"
                  value={expenseTitle}
                  onChange={e => setExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Amount ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="1250"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Amazon Web Services"
                    value={expenseVendor}
                    onChange={e => setExpenseVendor(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg"
                >
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
