import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck, CheckSquare, Building, ShoppingBag, Package,
  AlertCircle, CheckCircle2, Clock, Plus, Search, Filter,
  RefreshCw, ArrowRight, Shield, Users, Calendar, AlertTriangle,
  ChevronRight, ArrowUpRight, BarChart2, Layers
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../ui/Toast';
import { DepartmentHeader } from '../DepartmentHeader';
import { DepartmentTabs, type TabDefinition } from '../DepartmentTabs';
import type { DepartmentOperationalRecord } from '../modules/ModuleDetailView';

interface OperationsWorkspaceProps {
  department: any;
  deptId: string;
  orgId: string;
  members: any[];
  canAdminWorkspace: boolean;
  isOwner: boolean;
  hasOrgOversight: boolean;
  onRefresh: () => void;
}

export function OperationsWorkspace({
  department,
  deptId,
  orgId,
  members,
  canAdminWorkspace,
  isOwner,
  hasOrgOversight,
  onRefresh,
}: OperationsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [sops, setSops] = useState<DepartmentOperationalRecord[]>([]);
  const [vendors, setVendors] = useState<DepartmentOperationalRecord[]>([]);
  const [procurements, setProcurements] = useState<DepartmentOperationalRecord[]>([]);
  const [assets, setAssets] = useState<DepartmentOperationalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isSopModalOpen, setIsSopModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isProcurementModalOpen, setIsProcurementModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // SOP form
  const [sopTitle, setSopTitle] = useState('');
  const [sopCategory, setSopCategory] = useState('Safety & Compliance');
  const [sopFrequency, setSopFrequency] = useState('Daily');
  const [sopDescription, setSopDescription] = useState('');

  // Vendor form
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Logistics');
  const [vendorTier, setVendorTier] = useState('Tier 1 (Critical)');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorSla, setVendorSla] = useState('99.5%');

  // Procurement form
  const [procTitle, setProcTitle] = useState('');
  const [procAmount, setProcAmount] = useState('');
  const [procVendor, setProcVendor] = useState('');
  const [procPriority, setProcPriority] = useState('normal');

  // Asset form
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('Equipment');
  const [assetLocation, setAssetLocation] = useState('HQ Building');
  const [assetSerial, setAssetSerial] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOperationsData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('department_records')
        .select('*')
        .eq('department_id', deptId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching operations department_records:', error);
      } else {
        const allRecords = data || [];
        setSops(allRecords.filter((r) => r.module_key === 'sops' || r.module_key === 'runbooks' || r.record_type === 'sop'));
        setVendors(allRecords.filter((r) => r.module_key === 'vendors' || r.record_type === 'vendor'));
        setProcurements(allRecords.filter((r) => r.module_key === 'procurement' || r.module_key === 'purchase_orders' || r.record_type === 'procurement'));
        setAssets(allRecords.filter((r) => r.module_key === 'assets' || r.module_key === 'inventory' || r.record_type === 'asset'));
      }
    } catch (err: any) {
      console.error('Error fetching operations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (deptId) {
      fetchOperationsData();
    }
  }, [deptId]);

  // Calculations
  const stats = useMemo(() => {
    const totalSops = sops.length;
    const completedSops = sops.filter((s) => s.status === 'completed' || s.status === 'active').length;
    const activeVendors = vendors.filter((v) => v.status !== 'inactive').length;
    const pendingProc = procurements.filter((p) => p.status === 'pending' || p.status === 'submitted').length;
    const totalProcVal = procurements.reduce((sum, p) => sum + (Number(p.metadata?.amount) || 0), 0);
    const totalAssets = assets.length;
    const activeAssets = assets.filter((a) => a.status === 'active' || a.status === 'operational').length;

    return {
      totalSops,
      completedSops,
      activeVendors,
      pendingProc,
      totalProcVal,
      totalAssets,
      activeAssets,
    };
  }, [sops, vendors, procurements, assets]);

  // Handlers
  const handleCreateSop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sopTitle.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'sops',
        title: sopTitle.trim(),
        description: sopDescription.trim(),
        record_type: 'sop',
        status: 'active',
        priority: 'normal',
        metadata: {
          category: sopCategory,
          frequency: sopFrequency,
          created_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
      toast.success('Runbook / SOP registered successfully.');
      setIsSopModalOpen(false);
      setSopTitle('');
      setSopDescription('');
      fetchOperationsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create SOP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'vendors',
        title: vendorName.trim(),
        record_type: 'vendor',
        status: 'active',
        priority: 'high',
        metadata: {
          category: vendorCategory,
          tier: vendorTier,
          contact: vendorContact.trim(),
          sla: vendorSla.trim(),
          added_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
      toast.success('Vendor profile added.');
      setIsVendorModalOpen(false);
      setVendorName('');
      setVendorContact('');
      fetchOperationsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add vendor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procTitle.trim() || !procAmount) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'procurement',
        title: procTitle.trim(),
        record_type: 'procurement',
        status: 'pending',
        priority: procPriority,
        metadata: {
          amount: parseFloat(procAmount),
          vendor: procVendor.trim() || 'Unassigned',
          requested_date: new Date().toISOString(),
        },
      });

      if (error) throw error;
      toast.success('Procurement requisition submitted.');
      setIsProcurementModalOpen(false);
      setProcTitle('');
      setProcAmount('');
      setProcVendor('');
      fetchOperationsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit requisition.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'assets',
        title: assetName.trim(),
        record_type: 'asset',
        status: 'operational',
        priority: 'normal',
        metadata: {
          type: assetType,
          location: assetLocation,
          serial: assetSerial.trim(),
          registered_at: new Date().toISOString(),
        },
      });

      if (error) throw error;
      toast.success('Asset tracked in inventory.');
      setIsAssetModalOpen(false);
      setAssetName('');
      setAssetSerial('');
      fetchOperationsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add asset.');
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
      fetchOperationsData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  // Tabs
  const tabs: TabDefinition[] = [
    { key: 'overview', label: 'Overview', icon: BarChart2 },
    { key: 'sops', label: 'Runbooks & SOPs', icon: CheckSquare, badge: sops.length },
    { key: 'vendors', label: 'Vendors & Supply', icon: Truck, badge: vendors.length },
    { key: 'procurement', label: 'Procurement & Orders', icon: ShoppingBag, badge: stats.pendingProc || undefined },
    { key: 'assets', label: 'Assets & Facilities', icon: Package, badge: assets.length },
    { key: 'team', label: 'Operations Team', icon: Users, badge: members.length },
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
        primaryDomain="Operations & Logistics"
        onRefresh={() => {
          onRefresh();
          fetchOperationsData();
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
          {/* Operations Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Standard Runbooks</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <CheckSquare className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text-primary">{stats.completedSops}</span>
                <span className="text-xs text-text-muted">/ {stats.totalSops} active</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                <span>Operational Compliance High</span>
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Partnered Vendors</span>
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text-primary">{stats.activeVendors}</span>
                <span className="text-xs text-cyan-400">contracted</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-text-muted">
                <span>Supply Chain SLA: 99.4%</span>
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Procurement Requisitions</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400">{stats.pendingProc}</span>
                <span className="text-xs text-text-muted">awaiting approval</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-text-muted">
                <span>Total Value: ${stats.totalProcVal.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Inventory & Equipment</span>
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text-primary">{stats.activeAssets}</span>
                <span className="text-xs text-text-muted">/ {stats.totalAssets} monitored</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-purple-400">
                <span>All facilities operational</span>
              </div>
            </div>
          </div>

          {/* Operations Hub Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions & Runbook Status */}
            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Active Runbooks & Procedures
                </h3>
                <button
                  onClick={() => setIsSopModalOpen(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New SOP
                </button>
              </div>

              {sops.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm border border-dashed border-border-subtle rounded-lg">
                  No Standard Operating Procedures registered yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {sops.slice(0, 4).map((sop) => (
                    <div
                      key={sop.id}
                      className="flex items-center justify-between p-3 bg-surface-base border border-border-subtle rounded-lg hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium text-text-primary truncate">{sop.title}</p>
                        <p className="text-xs text-text-muted">{sop.metadata?.category || 'General'} • Frequency: {sop.metadata?.frequency || 'Daily'}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {sop.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Requisitions */}
            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  Recent Purchase Requisitions
                </h3>
                <button
                  onClick={() => setIsProcurementModalOpen(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Request PO
                </button>
              </div>

              {procurements.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm border border-dashed border-border-subtle rounded-lg">
                  No purchase requisitions on record.
                </div>
              ) : (
                <div className="space-y-3">
                  {procurements.slice(0, 4).map((proc) => (
                    <div
                      key={proc.id}
                      className="flex items-center justify-between p-3 bg-surface-base border border-border-subtle rounded-lg hover:border-amber-500/40 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium text-text-primary truncate">{proc.title}</p>
                        <p className="text-xs text-text-muted">Vendor: {proc.metadata?.vendor || 'TBD'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-text-primary">
                          ${(Number(proc.metadata?.amount) || 0).toLocaleString()}
                        </p>
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded capitalize ${
                          proc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                          proc.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {proc.status}
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

      {/* 2. SOPS & RUNBOOKS */}
      {activeTab === 'sops' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-text-primary">Standard Operating Procedures</h2>
            <button
              onClick={() => setIsSopModalOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New SOP
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sops.map((sop) => (
              <div key={sop.id} className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 font-medium">
                      {sop.metadata?.frequency || 'Daily'}
                    </span>
                    <select
                      value={sop.status}
                      onChange={(e) => handleStatusChange(sop.id, e.target.value)}
                      className="bg-surface-base text-xs border border-border-subtle rounded px-2 py-1 text-text-secondary"
                    >
                      <option value="active">Active</option>
                      <option value="in_review">In Review</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-text-primary">{sop.title}</h4>
                  <p className="mt-1 text-xs text-text-muted line-clamp-3">{sop.description || 'No execution details specified.'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between">
                  <span>Category: {sop.metadata?.category || 'General'}</span>
                  <span>{new Date(sop.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. VENDORS */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-text-primary">Suppliers & Vendor Network</h2>
            <button
              onClick={() => setIsVendorModalOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Vendor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-cyan-500/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-md border border-cyan-500/20 font-medium">
                      {vendor.metadata?.tier || 'Tier 1'}
                    </span>
                    <span className="text-xs text-text-muted">SLA: {vendor.metadata?.sla || '99.9%'}</span>
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-text-primary">{vendor.title}</h4>
                  <p className="mt-1 text-xs text-text-secondary">Category: {vendor.metadata?.category || 'Logistics'}</p>
                  <p className="mt-0.5 text-xs text-text-muted">Contact: {vendor.metadata?.contact || 'support@vendor.com'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between">
                  <span className="capitalize">{vendor.status}</span>
                  <select
                    value={vendor.status}
                    onChange={(e) => handleStatusChange(vendor.id, e.target.value)}
                    className="bg-surface-base text-xs border border-border-subtle rounded px-2 py-1 text-text-secondary"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. PROCUREMENT */}
      {activeTab === 'procurement' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-text-primary">Procurement Requisitions & POs</h2>
            <button
              onClick={() => setIsProcurementModalOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Request Requisition
            </button>
          </div>

          <div className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-base border-b border-border-subtle text-xs text-text-muted uppercase">
                  <tr>
                    <th className="px-6 py-3">Item / Service</th>
                    <th className="px-6 py-3">Vendor</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {procurements.map((proc) => (
                    <tr key={proc.id} className="hover:bg-surface-base/50">
                      <td className="px-6 py-4 font-medium text-text-primary">{proc.title}</td>
                      <td className="px-6 py-4 text-text-muted">{proc.metadata?.vendor || 'N/A'}</td>
                      <td className="px-6 py-4 font-semibold text-text-primary">
                        ${(Number(proc.metadata?.amount) || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                          proc.priority === 'urgent' ? 'bg-red-500/10 text-red-400' :
                          proc.priority === 'high' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-surface-base text-text-muted'
                        }`}>
                          {proc.priority || 'normal'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                          proc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                          proc.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {proc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canAdminWorkspace && proc.status === 'pending' && (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => handleStatusChange(proc.id, 'approved')}
                              className="px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-xs rounded font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusChange(proc.id, 'rejected')}
                              className="px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs rounded font-medium"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. ASSETS & FACILITIES */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-text-primary">Facilities & Physical Assets</h2>
            <button
              onClick={() => setIsAssetModalOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Register Asset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div key={asset.id} className="bg-surface-elevated border border-border-subtle rounded-xl p-5 hover:border-purple-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20 font-medium">
                    {asset.metadata?.type || 'Equipment'}
                  </span>
                  <span className="text-xs text-text-muted">{asset.metadata?.location || 'HQ'}</span>
                </div>
                <h4 className="mt-3 text-base font-semibold text-text-primary">{asset.title}</h4>
                <p className="mt-1 text-xs text-text-muted">Serial: {asset.metadata?.serial || 'SN-UNASSIGNED'}</p>
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
                  <span className="text-text-muted capitalize">Status: {asset.status}</span>
                  <select
                    value={asset.status}
                    onChange={(e) => handleStatusChange(asset.id, e.target.value)}
                    className="bg-surface-base text-xs border border-border-subtle rounded px-2 py-1 text-text-secondary"
                  >
                    <option value="operational">Operational</option>
                    <option value="maintenance">In Maintenance</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TEAM */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Operations Personnel</h3>
            <span className="text-xs text-text-muted">{members.length} Assigned Staff</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <div key={member.id} className="bg-surface-elevated border border-border-subtle rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  {member.user?.name ? member.user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">{member.user?.name || member.user?.email || 'Unknown User'}</p>
                  <p className="text-xs text-text-muted capitalize">{member.department_role || 'Staff'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* SOP Modal */}
      {isSopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-elevated border border-border-subtle rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Create Standard Operating Procedure</h3>
            <form onSubmit={handleCreateSop} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={sopTitle}
                  onChange={(e) => setSopTitle(e.target.value)}
                  placeholder="e.g. Server Room Backup Generator Testing"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Category</label>
                  <select
                    value={sopCategory}
                    onChange={(e) => setSopCategory(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="Safety & Compliance">Safety & Compliance</option>
                    <option value="Facility Maintenance">Facility Maintenance</option>
                    <option value="IT Operations">IT Operations</option>
                    <option value="Logistics">Logistics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Frequency</label>
                  <select
                    value={sopFrequency}
                    onChange={(e) => setSopFrequency(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Instructions / Description</label>
                <textarea
                  rows={3}
                  value={sopDescription}
                  onChange={(e) => setSopDescription(e.target.value)}
                  placeholder="Step-by-step checklist or verification instructions..."
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSopModalOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  {submitting ? 'Saving...' : 'Save SOP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendor Modal */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-elevated border border-border-subtle rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Add Vendor / Supplier</h3>
            <form onSubmit={handleCreateVendor} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Vendor Name</label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Apex Freight & Logistics"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Tier</label>
                  <select
                    value={vendorTier}
                    onChange={(e) => setVendorTier(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="Tier 1 (Critical)">Tier 1 (Critical)</option>
                    <option value="Tier 2 (Secondary)">Tier 2 (Secondary)</option>
                    <option value="Tier 3 (Commodity)">Tier 3 (Commodity)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Target SLA</label>
                  <input
                    type="text"
                    value={vendorSla}
                    onChange={(e) => setVendorSla(e.target.value)}
                    placeholder="99.5%"
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Contact Email / Phone</label>
                <input
                  type="text"
                  value={vendorContact}
                  onChange={(e) => setVendorContact(e.target.value)}
                  placeholder="ops@vendor.com"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg"
                >
                  {submitting ? 'Saving...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Procurement Modal */}
      {isProcurementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-elevated border border-border-subtle rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary">New Purchase Requisition</h3>
            <form onSubmit={handleCreateProcurement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Item / Description</label>
                <input
                  type="text"
                  required
                  value={procTitle}
                  onChange={(e) => setProcTitle(e.target.value)}
                  placeholder="e.g. 5x Workstation Monitors & Docks"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Estimated Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={procAmount}
                    onChange={(e) => setProcAmount(e.target.value)}
                    placeholder="1500.00"
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Priority</label>
                  <select
                    value={procPriority}
                    onChange={(e) => setProcPriority(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Preferred Vendor</label>
                <input
                  type="text"
                  value={procVendor}
                  onChange={(e) => setProcVendor(e.target.value)}
                  placeholder="e.g. CDW / Dell"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProcurementModalOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg"
                >
                  {submitting ? 'Submitting...' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Modal */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-elevated border border-border-subtle rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Track Inventory / Asset</h3>
            <form onSubmit={handleCreateAsset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Asset Name</label>
                <input
                  type="text"
                  required
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g. HVAC Unit 3 or MacBook Pro 16"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Type</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="Equipment">Equipment</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Vehicle">Vehicle</option>
                    <option value="Facility Asset">Facility Asset</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Location</label>
                  <input
                    type="text"
                    value={assetLocation}
                    onChange={(e) => setAssetLocation(e.target.value)}
                    placeholder="HQ Building 2, Floor 3"
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Serial / Asset Tag</label>
                <input
                  type="text"
                  value={assetSerial}
                  onChange={(e) => setAssetSerial(e.target.value)}
                  placeholder="TAG-8849-B"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
                >
                  {submitting ? 'Saving...' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
