import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import { clientApi } from '../lib/clientApi';
import {
  Building, Plus, Search,
  Edit2, Trash2, X, RefreshCw, ExternalLink,
  ShieldCheck, Key, Send, CheckCircle2, Clock, Ban, Copy, Check
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from '../components/ui/Toast';
import {
  PageHeader, MetricStrip, ContextInspector, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

interface Client {
  id: string;
  organization_id: string | null;
  owner_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  gst_number: string | null;
  address: string | null;
  notes: string | null;
  user_id?: string | null;
  portal_status?: 'no_access' | 'pending_login' | 'active' | 'disabled';
  portal_enabled_at?: string | null;
  portal_last_login_at?: string | null;
  created_at: string;
}

export default function Clients() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { orgId } = useWorkspace();
  const canManage = hasPermission(role, 'manage_clients');

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [inspectingClient, setInspectingClient] = useState<Client | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [enablePortal, setEnablePortal] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Credential Modal State (Shown only once after creation if credentials generated)
  const [credentialModal, setCredentialModal] = useState<{
    isOpen: boolean;
    clientName: string;
    email: string;
    tempPassword?: string | null;
    setupLink?: string | null;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchAvailableProjects = useCallback(async () => {
    if (!user) return;
    try {
      let q = supabase
        .from('projects')
        .select('id, title, status')
        .is('deleted_at', null)
        .order('title', { ascending: true });

      if (orgId) {
        q = q.eq('org_id', orgId);
      } else {
        q = q.eq('owner_id', user.id);
      }

      const { data } = await q;
      setAvailableProjects(data || []);
    } catch (e) {
      console.warn('Failed to load available projects:', e);
    }
  }, [user, orgId]);

  const fetchClients = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (orgId) {
        query = query.eq('organization_id', orgId);
      } else {
        query = query.eq('owner_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (e) {
      console.error('Failed to load clients:', e);
    } finally {
      setLoading(false);
    }
  }, [user, orgId]);

  useEffect(() => {
    fetchClients();
    fetchAvailableProjects();
  }, [fetchClients, fetchAvailableProjects]);

  const openCreateModal = () => {
    setEditingClient(null);
    setName('');
    setCompanyName('');
    setEmail('');
    setPhone('');
    setGstNumber('');
    setAddress('');
    setNotes('');
    setEnablePortal(false);
    setSelectedProjectIds([]);
    setIsModalOpen(true);
  };

  const openEditModal = async (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setCompanyName(client.company_name || '');
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setGstNumber(client.gst_number || '');
    setAddress(client.address || '');
    setNotes(client.notes || '');
    setEnablePortal(client.portal_status === 'active' || client.portal_status === 'pending_login');

    if (client.user_id) {
      const { data: pcas } = await supabase
        .from('project_client_access')
        .select('project_id')
        .eq('client_id', client.id);
      setSelectedProjectIds((pcas || []).map((p: any) => p.project_id));
    } else {
      setSelectedProjectIds([]);
    }

    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setSaving(true);
    try {
      const payload = {
        id: editingClient?.id,
        name: name.trim(),
        companyName: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        gstNumber: gstNumber.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        enablePortal,
        projectIds: selectedProjectIds,
      };

      const result = await clientApi.saveClientWithPortal(payload, orgId);

      if (result.client) {
        setClients(prev => {
          const exists = prev.some(c => c.id === result.client.id);
          if (exists) {
            return prev.map(c => (c.id === result.client.id ? result.client : c));
          } else {
            return [result.client, ...prev];
          }
        });

        if (inspectingClient?.id === result.client.id) {
          setInspectingClient(result.client);
        }
      }

      setIsModalOpen(false);
      toast.success(editingClient ? 'Client account updated' : 'Client registered successfully');

      // If credentials were newly generated, display the credential modal
      if (result.tempPassword || result.setupLink) {
        setCredentialModal({
          isOpen: true,
          clientName: result.client.name,
          email: result.client.email,
          tempPassword: result.tempPassword,
          setupLink: result.setupLink,
        });
      }
    } catch (e: any) {
      console.error('Failed to save client:', e);
      toast.error(e.message || 'Failed to save client account');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePortal = async (client: Client, newEnabled: boolean) => {
    setActionLoading(true);
    try {
      const res = await clientApi.togglePortalAccess(client.id, newEnabled, orgId);
      if (res.client) {
        setClients(prev => prev.map(c => (c.id === client.id ? res.client : c)));
        setInspectingClient(res.client);
      }
      toast.success(newEnabled ? 'Portal access enabled' : 'Portal access disabled');
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle portal access');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendAccess = async (client: Client) => {
    setActionLoading(true);
    try {
      const res = await clientApi.resendAccessLink(client.id, orgId);
      if (res.setupLink) {
        setCredentialModal({
          isOpen: true,
          clientName: client.name,
          email: client.email || '',
          setupLink: res.setupLink,
        });
      }
      toast.success('Access setup link generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate access link');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (client: Client) => {
    setActionLoading(true);
    try {
      const res = await clientApi.resetPassword(client.id, orgId);
      if (res.setupLink) {
        setCredentialModal({
          isOpen: true,
          clientName: client.name,
          email: client.email || '',
          setupLink: res.setupLink,
        });
      }
      toast.success('Password recovery link generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate password recovery link');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const confirmDeleteClient = async () => {
    if (!deleteClientId) return;
    try {
      const { data: clientInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', deleteClientId);

      const invoiceIds = (clientInvoices || []).map(i => i.id);

      if (invoiceIds.length > 0) {
        await supabase.from('invoice_payments').delete().in('invoice_id', invoiceIds);
        await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds);
        await supabase.from('invoice_taxes').delete().in('invoice_id', invoiceIds);
        await supabase.from('invoices').delete().in('id', invoiceIds);
      }

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', deleteClientId);

      if (error) throw error;
      setClients(prev => prev.filter(c => c.id !== deleteClientId));
      if (inspectingClient?.id === deleteClientId) {
        setInspectingClient(null);
      }
      toast.success('Client and associated records deleted from database');
    } catch (e: any) {
      console.error('Failed to delete client:', e);
      toast.error(e.message || 'Failed to delete client');
    } finally {
      setDeleteClientId(null);
    }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const corporateCount = clients.filter(c => c.company_name).length;
  const portalActiveCount = clients.filter(c => c.portal_status === 'active' || c.portal_status === 'pending_login').length;

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'ACTIVE ACCOUNTS', value: clients.length < 10 ? `0${clients.length}` : clients.length, isOrange: true },
    { label: 'PORTAL ENABLED', value: portalActiveCount < 10 ? `0${portalActiveCount}` : portalActiveCount, indicator: 'Clients Linked' },
    { label: 'CORPORATE ENTITIES', value: corporateCount < 10 ? `0${corporateCount}` : corporateCount },
    { label: 'GST VERIFIED', value: clients.filter(c => c.gst_number).length },
  ], [clients, portalActiveCount, corporateCount]);

  const renderPortalBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span>Active Portal</span>
          </span>
        );
      case 'pending_login':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Clock size={11} className="text-amber-400" />
            <span>Pending Login</span>
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            <Ban size={11} className="text-rose-400" />
            <span>Disabled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-muted bg-white/[0.03] border border-divider">
            <span>No Access</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Clients CRM & Accounts"
        description="Customer relationship governance, verified client portal access, and billing telemetry."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchClients}
              className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors"
              title="Sync accounts"
            >
              <RefreshCw size={13} />
            </button>
            {canManage && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>Add Client</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Search Bar ── */}
      <div className="flex items-center justify-between gap-3 bg-card-bg border border-divider rounded-lg p-2.5 max-w-md">
        <div className="relative w-full">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search clients by name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-app border border-divider focus:border-[#FF6B4A]/40 rounded text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Structured Accounts Table ── */}
      {loading ? (
        <SkeletonRow count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No client accounts registered"
          description={search ? "No accounts match this query." : "Add client companies and contacts to streamline invoice generation and verified portal access."}
          action={canManage && !search ? { label: "Add First Client", onClick: openCreateModal } : undefined}
        />
      ) : (
        <div className="bg-card-bg border border-divider rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-card-bg">
            <div className="col-span-3">Client & Company</div>
            <div className="col-span-3">Contact Email</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2">Portal Status</div>
            <div className="col-span-1">Tax ID</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {filtered.map((client, idx) => (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                key={client.id}
                onClick={() => setInspectingClient(client)}
                className="grid grid-cols-12 gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors cursor-pointer items-center text-xs group"
              >
                <div className="col-span-3 min-w-0 pr-2">
                  <div className="font-semibold text-main group-hover:text-[#FF6B4A] transition-colors truncate">
                    {client.company_name || client.name}
                  </div>
                  {client.company_name && (
                    <div className="text-[11px] text-muted truncate mt-0.5">{client.name}</div>
                  )}
                </div>

                <div className="col-span-3 text-muted truncate">
                  {client.email || '—'}
                </div>

                <div className="col-span-2 text-muted font-mono text-[11px]">
                  {client.phone || '—'}
                </div>

                <div className="col-span-2">
                  {renderPortalBadge(client.portal_status)}
                </div>

                <div className="col-span-1 text-muted font-mono text-[11px] truncate">
                  {client.gst_number || '—'}
                </div>

                <div className="col-span-1 text-right" onClick={e => e.stopPropagation()}>
                  {canManage && (
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-1 rounded hover:bg-white/[0.05] text-muted hover:text-main transition-colors"
                        title="Edit Account & Portal Access"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteClientId(client.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Client Context Inspector ── */}
      {inspectingClient && (
        <ContextInspector
          title={inspectingClient.company_name || inspectingClient.name}
          subtitle="Corporate Client Account"
          badge={inspectingClient.portal_status === 'active' ? 'ACTIVE PORTAL' : inspectingClient.portal_status === 'pending_login' ? 'PENDING LOGIN' : 'CRM RECORD'}
          onClose={() => setInspectingClient(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => navigate('/projects')}
                className="px-3 py-1.5 bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
              >
                <ExternalLink size={12} className="text-[#FF6B4A]" />
                <span>Associated Projects</span>
              </button>
              <button
                onClick={() => { openEditModal(inspectingClient); setInspectingClient(null); }}
                className="px-3 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold rounded transition-colors"
              >
                Edit Account Details
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Primary Details Card */}
            <div className="bg-card-bg p-3.5 rounded border border-divider space-y-2">
              <div>
                <span className="text-[10px] font-mono text-muted block mb-0.5">Primary Contact</span>
                <span className="text-main font-medium">{inspectingClient.name}</span>
              </div>
              {inspectingClient.company_name && (
                <div>
                  <span className="text-[10px] font-mono text-muted block mb-0.5">Organization Entity</span>
                  <span className="text-main font-medium">{inspectingClient.company_name}</span>
                </div>
              )}
              {inspectingClient.email && (
                <div>
                  <span className="text-[10px] font-mono text-muted block mb-0.5">Email</span>
                  <span className="text-muted font-mono text-[11px]">{inspectingClient.email}</span>
                </div>
              )}
              {inspectingClient.phone && (
                <div>
                  <span className="text-[10px] font-mono text-muted block mb-0.5">Phone</span>
                  <span className="text-muted font-mono text-[11px]">{inspectingClient.phone}</span>
                </div>
              )}
              {inspectingClient.gst_number && (
                <div>
                  <span className="text-[10px] font-mono text-muted block mb-0.5">Tax / GST Number</span>
                  <span className="text-muted font-mono text-[11px]">{inspectingClient.gst_number}</span>
                </div>
              )}
            </div>

            {/* Portal Access Governance Card */}
            <div className="bg-card-bg p-3.5 rounded border border-divider space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-[#FF6B4A]" />
                  <span>Portal Governance</span>
                </span>
                {renderPortalBadge(inspectingClient.portal_status)}
              </div>

              {inspectingClient.portal_enabled_at && (
                <p className="text-[11px] text-muted">
                  Enabled on {new Date(inspectingClient.portal_enabled_at).toLocaleDateString()}
                </p>
              )}

              {canManage && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-divider">
                  {inspectingClient.portal_status === 'disabled' ? (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleTogglePortal(inspectingClient, true)}
                      className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-xs font-medium transition-colors"
                    >
                      Re-enable Portal Access
                    </button>
                  ) : inspectingClient.portal_status === 'active' || inspectingClient.portal_status === 'pending_login' ? (
                    <>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleResendAccess(inspectingClient)}
                        className="px-2.5 py-1.5 bg-hover hover:bg-hover text-muted hover:text-main border border-divider rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Send size={12} className="text-[#FF6B4A]" />
                        <span>Resend Access Link</span>
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleResetPassword(inspectingClient)}
                        className="px-2.5 py-1.5 bg-hover hover:bg-hover text-muted hover:text-main border border-divider rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Key size={12} className="text-amber-400" />
                        <span>Reset Password</span>
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleTogglePortal(inspectingClient, false)}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-xs font-medium transition-colors"
                      >
                        Disable Access
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleTogglePortal(inspectingClient, true)}
                      className="px-2.5 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-main rounded text-xs font-semibold transition-colors"
                    >
                      Enable Client Portal
                    </button>
                  )}
                </div>
              )}
            </div>

            {inspectingClient.address && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-1">Billing Address</span>
                <p className="text-muted bg-card-bg p-3 rounded border border-divider leading-relaxed">
                  {inspectingClient.address}
                </p>
              </div>
            )}

            {inspectingClient.notes && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-1">Account Notes</span>
                <p className="text-muted bg-card-bg p-3 rounded border border-divider leading-relaxed whitespace-pre-wrap">
                  {inspectingClient.notes}
                </p>
              </div>
            )}
          </div>
        </ContextInspector>
      )}

      {/* ── Add / Edit Client Modal with Portal Access ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card-bg border border-divider rounded-xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h2 className="text-sm font-bold text-main uppercase tracking-wider font-mono flex items-center gap-2">
                <Building size={15} className="text-[#FF6B4A]" />
                <span>{editingClient ? 'Edit Client Account' : 'New Client Account'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-main">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Primary Contact Name <span className="text-[#FF6B4A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Company / Organization Entity
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp Technologies"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Email Address {enablePortal && <span className="text-[#FF6B4A]">*</span>}
                  </label>
                  <input
                    type="email"
                    required={enablePortal}
                    placeholder="billing@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+1 555-0199"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  GST / Tax ID Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={gstNumber}
                  onChange={e => setGstNumber(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, City, Postal Code..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* ── Client Portal Access Toggle Section ── */}
              <div className="bg-app p-3 rounded-lg border border-divider space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-main block">Enable Client Portal Access</span>
                    <span className="text-[11px] text-muted">
                      Grants secure login access to view projects and invoices.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePortal}
                      onChange={e => setEnablePortal(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-card-bg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-divider after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF6B4A]" />
                  </label>
                </div>

                {enablePortal && (
                  <div className="pt-2 border-t border-divider space-y-2">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block">
                      Assign Associated Projects
                    </label>
                    {availableProjects.length === 0 ? (
                      <p className="text-[11px] text-muted italic">No active projects available to link.</p>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {availableProjects.map(proj => {
                          const isChecked = selectedProjectIds.includes(proj.id);
                          return (
                            <label
                              key={proj.id}
                              className="flex items-center gap-2 p-1.5 rounded hover:bg-hover cursor-pointer text-xs text-zinc-300"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedProjectIds(prev => prev.filter(id => id !== proj.id));
                                  } else {
                                    setSelectedProjectIds(prev => [...prev, proj.id]);
                                  }
                                }}
                                className="rounded border-divider bg-card-bg text-[#FF6B4A] focus:ring-0"
                              />
                              <span className="truncate">{proj.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-hover hover:bg-hover text-muted text-xs rounded border border-divider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim() || (enablePortal && !email.trim())}
                  className="px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm"
                >
                  {saving ? 'Saving...' : editingClient ? 'Update Account' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── One-Time Credential Modal ── */}
      {credentialModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-divider">
              <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Key size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-main">Client Portal Credentials Generated</h3>
                <p className="text-[11px] text-muted">Single-use credentials for {credentialModal.clientName}</p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs leading-relaxed">
              <strong>Notice:</strong> Temporary credentials and setup links are shown only once and will never be stored or displayed again. Share them securely with the client.
            </div>

            {credentialModal.tempPassword && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                  Temporary Password
                </label>
                <div className="flex items-center justify-between p-2.5 bg-app border border-divider rounded font-mono text-xs text-main">
                  <span className="font-semibold text-emerald-400">{credentialModal.tempPassword}</span>
                  <button
                    onClick={() => copyToClipboard(credentialModal.tempPassword!, 'pw')}
                    className="p-1 text-muted hover:text-main rounded hover:bg-hover transition-colors"
                    title="Copy Password"
                  >
                    {copiedKey === 'pw' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            {credentialModal.setupLink && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                  Single-Use Setup Link
                </label>
                <div className="flex items-center justify-between p-2.5 bg-app border border-divider rounded font-mono text-xs text-main">
                  <span className="truncate text-muted text-[11px] pr-2">{credentialModal.setupLink}</span>
                  <button
                    onClick={() => copyToClipboard(credentialModal.setupLink!, 'link')}
                    className="p-1 text-muted hover:text-main rounded hover:bg-hover transition-colors shrink-0"
                    title="Copy Link"
                  >
                    {copiedKey === 'link' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-divider">
              <button
                onClick={() => setCredentialModal(null)}
                className="px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-semibold text-xs rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Client Modal ── */}
      <ConfirmModal
        isOpen={!!deleteClientId}
        title="Delete Client Account"
        message="Are you sure you want to permanently delete this client? This account will be removed from the database."
        confirmText="Delete Client"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDeleteClient}
        onCancel={() => setDeleteClientId(null)}
      />

    </div>
  );
}
