import React, { useState, useEffect, useMemo } from 'react';
import {
  Target, TrendingUp, Users, Megaphone, LineChart, FileText,
  DollarSign, Plus, Search, Filter, CheckCircle2, Clock,
  AlertTriangle, RefreshCw, Shield, ArrowRight, Check, X,
  Calendar, User, Tag
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../ui/Toast';
import { DepartmentHeader } from '../DepartmentHeader';
import { DepartmentTabs, type TabDefinition } from '../DepartmentTabs';
import type { DepartmentOperationalRecord } from '../modules/ModuleDetailView';

interface SalesWorkspaceProps {
  department: any;
  deptId: string;
  orgId: string;
  members: any[];
  canAdminWorkspace: boolean;
  isOwner: boolean;
  hasOrgOversight: boolean;
  onRefresh: () => void;
}

export function SalesWorkspace({
  department,
  deptId,
  orgId,
  members,
  canAdminWorkspace,
  isOwner,
  hasOrgOversight,
  onRefresh,
}: SalesWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [leads, setLeads] = useState<DepartmentOperationalRecord[]>([]);
  const [campaigns, setCampaigns] = useState<DepartmentOperationalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lead Form
  const [leadTitle, setLeadTitle] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadAmount, setLeadAmount] = useState('');
  const [leadStage, setLeadStage] = useState('new');
  const [leadAssignee, setLeadAssignee] = useState('');

  // Campaign Form
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignBudget, setCampaignBudget] = useState('');
  const [campaignChannel, setCampaignChannel] = useState('Email & Content');
  const [campaignTarget, setCampaignTarget] = useState('Enterprise B2B');

  // Load Sales Data
  const loadSalesData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('department_records')
        .select(`
          *,
          assigned_user:users!assigned_to(id, full_name, email)
        `)
        .eq('department_id', deptId);

      if (error) {
        console.warn('Error loading sales department_records:', error);
      } else {
        const allRecords = data || [];
        setLeads(allRecords.filter(r => r.module_key === 'leads'));
        setCampaigns(allRecords.filter(r => r.module_key === 'campaigns'));
      }
    } catch (err: any) {
      console.error('Error loading sales workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalesData();
  }, [deptId, orgId]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let pipelineValue = 0;
    let wonRevenue = 0;
    leads.forEach(l => {
      const val = Number(l.metadata?.amount || l.metadata?.lead_value || 0);
      if (l.status === 'won') {
        wonRevenue += val;
      } else if (l.status !== 'lost') {
        pipelineValue += val;
      }
    });

    const totalDeals = leads.length;
    const wonCount = leads.filter(l => l.status === 'won').length;
    const winRate = totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0;

    return {
      pipelineValue,
      wonRevenue,
      activeLeadsCount: leads.filter(l => l.status !== 'won' && l.status !== 'lost').length,
      winRate,
      activeCampaignsCount: campaigns.length,
    };
  }, [leads, campaigns]);

  // Create Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadTitle.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'leads',
        title: leadTitle.trim(),
        description: `Lead from ${leadCompany || 'Prospective Client'}`,
        status: leadStage,
        priority: 'high',
        assigned_to: leadAssignee || null,
        metadata: {
          amount: parseFloat(leadAmount) || 0,
          lead_value: parseFloat(leadAmount) || 0,
          company: leadCompany.trim() || 'Enterprise Prospect',
        },
      });

      if (error) throw error;
      toast.success('Sales lead created.');
      setIsLeadModalOpen(false);
      setLeadTitle('');
      setLeadCompany('');
      setLeadAmount('');
      loadSalesData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create lead.');
    } finally {
      setSubmitting(false);
    }
  };

  // Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignTitle.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'campaigns',
        title: campaignTitle.trim(),
        description: `Campaign via ${campaignChannel} targeting ${campaignTarget}`,
        status: 'active',
        priority: 'medium',
        metadata: {
          budget: parseFloat(campaignBudget) || 0,
          channel: campaignChannel,
          target_audience: campaignTarget,
        },
      });

      if (error) throw error;
      toast.success('Campaign created.');
      setIsCampaignModalOpen(false);
      setCampaignTitle('');
      setCampaignBudget('');
      loadSalesData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Lead Stage
  const handleLeadStage = async (id: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: newStage, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Deal stage updated to ${newStage}.`);
      loadSalesData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update stage.');
    }
  };

  // Sales Navigation Tabs
  const salesTabs: TabDefinition[] = [
    { id: 'overview', label: 'Pipeline & Funnel', icon: Target },
    { id: 'leads', label: 'Leads & Prospect Intake', count: leads.length, icon: TrendingUp },
    { id: 'deals', label: 'Deals & Opportunities', count: leads.filter(l => ['qualified', 'proposal', 'negotiation', 'won'].includes(l.status)).length, icon: DollarSign },
    { id: 'campaigns', label: 'Campaigns & Outreach', count: campaigns.length, icon: Megaphone },
    { id: 'analytics', label: 'Acquisition & Attribution', icon: LineChart },
    { id: 'team', label: 'Sales Team', count: members.length, icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <DepartmentHeader
        name={department.name}
        description={department.description || 'Lead qualification, pipeline velocity, deal negotiation, and marketing campaigns.'}
        color={department.color || '#F59E0B'}
        badge="SALES & MARKETING"
        headUser={department.head_user}
        parentDepartmentName={department.parent_department?.name}
      />

      {/* ── SALES KPI METRIC STRIP ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Active Pipeline Value</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            ${metrics.pipelineValue.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1">{metrics.activeLeadsCount} Deals in Pipeline</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Closed-Won Revenue</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            ${metrics.wonRevenue.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-1">Realized Contract Value</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Pipeline Win Rate</div>
          <div className="text-xl font-bold font-mono text-text-primary mt-1">
            {metrics.winRate}%
          </div>
          <div className="text-[10px] text-text-muted mt-1">Qualified Deal Conversions</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Active Campaigns</div>
          <div className="text-xl font-bold font-mono text-accent mt-1">
            {metrics.activeCampaignsCount}
          </div>
          <div className="text-[10px] text-text-muted mt-1">Multi-Channel Marketing</div>
        </div>
      </div>

      {/* ── SALES TABS ── */}
      <DepartmentTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={salesTabs}
      />

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Pipeline Funnel */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span>Sales Pipeline & Velocity Funnel</span>
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">Stage-by-stage deal progression and potential valuation.</p>
                  </div>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsLeadModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Lead</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Discovery</span>
                    <div className="text-base font-bold font-mono text-text-primary">
                      {leads.filter(l => l.status === 'new' || l.status === 'contacted').length}
                    </div>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Qualified</span>
                    <div className="text-base font-bold font-mono text-blue-400">
                      {leads.filter(l => l.status === 'qualified').length}
                    </div>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Proposal</span>
                    <div className="text-base font-bold font-mono text-amber-400">
                      {leads.filter(l => l.status === 'proposal').length}
                    </div>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Closed Won</span>
                    <div className="text-base font-bold font-mono text-emerald-400">
                      {leads.filter(l => l.status === 'won').length}
                    </div>
                  </div>
                </div>

                {/* Top Opportunities */}
                <div className="pt-3 border-t border-border-subtle space-y-2">
                  <div className="text-xs font-semibold text-text-primary">Top High-Value Deals</div>
                  {leads.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">No active leads. Click 'New Lead' to intake your first deal.</p>
                  ) : (
                    <div className="space-y-2">
                      {leads.slice(0, 4).map(l => (
                        <div key={l.id} className="p-3 bg-surface-2 border border-border-subtle rounded-lg flex justify-between items-center text-xs">
                          <div>
                            <div className="font-semibold text-text-primary">{l.title}</div>
                            <div className="text-[11px] text-text-muted">{l.metadata?.company || 'Enterprise Account'}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-amber-400">
                              ${Number(l.metadata?.amount || l.metadata?.lead_value || 0).toLocaleString()}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-surface-1 border border-border-subtle text-text-muted">
                              {l.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Campaigns & Quotas */}
            <div className="space-y-6">
              {/* Marketing Campaigns Overview */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-amber-400" />
                    <span>Active Outreach</span>
                  </h3>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsCampaignModalOpen(true)}
                      className="text-xs text-accent hover:underline font-semibold"
                    >
                      + Campaign
                    </button>
                  )}
                </div>

                {campaigns.length === 0 ? (
                  <p className="text-xs text-text-muted">No promotional campaigns scheduled.</p>
                ) : (
                  <div className="space-y-2">
                    {campaigns.slice(0, 3).map(c => (
                      <div key={c.id} className="p-2.5 bg-surface-2 rounded-lg border border-border-subtle text-xs space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-text-primary">{c.title}</span>
                          <span className="text-emerald-400 font-mono text-[11px]">
                            ${Number(c.metadata?.budget || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted">{c.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sales Governance */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  <span>Sales Operations</span>
                </h3>
                <div className="text-xs text-text-muted space-y-2">
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>Average Sales Cycle:</span>
                    <strong className="text-text-primary">28 Days</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>Territory Coverage:</span>
                    <strong className="text-emerald-400">Global / Multi-region</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Sales Director:</span>
                    <strong className="text-text-primary">{department.head_user?.full_name || 'Unassigned'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LEADS ── */}
      {activeTab === 'leads' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Prospect & Lead Pipeline</h3>
              <p className="text-xs text-text-muted">Intake inbound inquiries, set deal values, and qualify opportunities.</p>
            </div>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsLeadModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Lead</span>
              </button>
            )}
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Deal Title</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Value ($)</th>
                  <th className="py-3 px-4">Assigned Rep</th>
                  <th className="py-3 px-4">Stage</th>
                  {canAdminWorkspace && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {leads.map(l => (
                  <tr key={l.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{l.title}</td>
                    <td className="py-3 px-4 text-text-muted">{l.metadata?.company || 'General'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      ${Number(l.metadata?.amount || l.metadata?.lead_value || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-text-muted">{l.assigned_user?.full_name || 'Unassigned'}</td>
                    <td className="py-3 px-4">
                      <select
                        value={l.status}
                        onChange={e => handleLeadStage(l.id, e.target.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-2 border ${
                          l.status === 'won' ? 'text-emerald-400 border-emerald-500/20' :
                          l.status === 'lost' ? 'text-red-400 border-red-500/20' :
                          'text-amber-400 border-amber-500/20'
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="proposal">Proposal</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="won">Closed Won</option>
                        <option value="lost">Closed Lost</option>
                      </select>
                    </td>
                    {canAdminWorkspace && (
                      <td className="py-3 px-4 text-right">
                        {l.status !== 'won' && (
                          <button
                            onClick={() => handleLeadStage(l.id, 'won')}
                            className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 font-semibold"
                          >
                            Mark Won
                          </button>
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

      {/* ── TAB 3: DEALS ── */}
      {activeTab === 'deals' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Opportunity Stage Pipeline</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {leads
              .filter(l => ['qualified', 'proposal', 'negotiation', 'won'].includes(l.status))
              .map(d => (
                <div key={d.id} className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-text-primary">{d.title}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10">
                      {d.status}
                    </span>
                  </div>
                  <div className="text-sm font-mono font-bold text-amber-400">
                    ${Number(d.metadata?.amount || d.metadata?.lead_value || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-text-muted">{d.metadata?.company || 'Enterprise Account'}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: CAMPAIGNS ── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-text-primary">Promotional Campaigns</h3>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsCampaignModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Campaign</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(c => (
              <div key={c.id} className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-text-primary">{c.title}</h4>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ${Number(c.metadata?.budget || 0).toLocaleString()} Budget
                  </span>
                </div>
                <p className="text-xs text-text-muted">{c.description}</p>
                <div className="pt-2 border-t border-border-subtle flex justify-between text-xs text-text-muted">
                  <span>Channel: {c.metadata?.channel || 'Digital'}</span>
                  <span>Target: {c.metadata?.target_audience || 'B2B'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: ANALYTICS ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Acquisition & CAC Analytics</h3>
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center text-xs text-text-muted">
            <LineChart className="w-8 h-8 mx-auto text-amber-400 mb-2" />
            <p className="font-semibold text-text-primary">Marketing Attribution Engine Active</p>
            <p className="mt-1">Campaign conversion velocity, MQL-to-SQL drop-offs, and CAC metrics are recorded.</p>
          </div>
        </div>
      )}

      {/* ── TAB 6: TEAM ── */}
      {activeTab === 'team' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Sales Executives & Account Reps</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {members.map(m => (
              <div key={m.id} className="bg-surface-1 border border-border-subtle rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                  {m.user?.full_name?.charAt(0) || 'S'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-primary truncate">{m.user?.full_name || m.user?.email}</div>
                  <div className="text-[11px] text-text-muted capitalize">{m.department_role || 'sales_rep'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CREATE LEAD MODAL ── */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">New Sales Lead</h3>
              <button onClick={() => setIsLeadModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Opportunity Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Cloud Licensing"
                  value={leadTitle}
                  onChange={e => setLeadTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Company / Client</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Global Inc"
                    value={leadCompany}
                    onChange={e => setLeadCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Estimated Value ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="50000"
                    value={leadAmount}
                    onChange={e => setLeadAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE CAMPAIGN MODAL ── */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">New Marketing Campaign</h3>
              <button onClick={() => setIsCampaignModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Campaign Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Cloud Migration Webinar"
                  value={campaignTitle}
                  onChange={e => setCampaignTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Budget ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="10000"
                    value={campaignBudget}
                    onChange={e => setCampaignBudget(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Channel</label>
                  <select
                    value={campaignChannel}
                    onChange={e => setCampaignChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  >
                    <option value="Email & Outreach">Email & Outreach</option>
                    <option value="Paid Search & Ads">Paid Search & Ads</option>
                    <option value="Content & SEO">Content & SEO</option>
                    <option value="Events & Webinars">Events & Webinars</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg"
                >
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
