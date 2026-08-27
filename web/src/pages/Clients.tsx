import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  Building, Plus, Search,
  Edit2, Trash2, X, RefreshCw
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
  created_at: string;
}

export default function Clients() {
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
  const [saving, setSaving] = useState(false);

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
        query = query.or(`organization_id.eq.${orgId},org_id.eq.${orgId}`);
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

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const openCreateModal = () => {
    setEditingClient(null);
    setName('');
    setCompanyName('');
    setEmail('');
    setPhone('');
    setGstNumber('');
    setAddress('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setCompanyName(client.company_name || '');
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setGstNumber(client.gst_number || '');
    setAddress(client.address || '');
    setNotes(client.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setSaving(true);
    try {
      if (editingClient) {
        const { data, error } = await supabase
          .from('clients')
          .update({
            name: name.trim(),
            company_name: companyName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            gst_number: gstNumber.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
          })
          .eq('id', editingClient.id)
          .select()
          .single();

        if (error) throw error;
        setClients(prev => prev.map(c => (c.id === editingClient.id ? data : c)));
      } else {
        const payload: any = {
          owner_id: user.id,
          name: name.trim(),
          company_name: companyName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          gst_number: gstNumber.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        };
        if (orgId) payload.organization_id = orgId;

        const { data, error } = await supabase.from('clients').insert(payload).select().single();
        if (error) throw error;
        setClients(prev => [data, ...prev]);
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error('Failed to save client:', e);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteClient = async () => {
    if (!deleteClientId) return;
    try {
      // 1. Find all invoice IDs associated with this client
      const { data: clientInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', deleteClientId);

      const invoiceIds = (clientInvoices || []).map(i => i.id);

      if (invoiceIds.length > 0) {
        // Delete dependent payments and items for all client invoices
        await supabase.from('invoice_payments').delete().in('invoice_id', invoiceIds);
        await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds);
        await supabase.from('invoice_taxes').delete().in('invoice_id', invoiceIds);
        // Delete the invoices themselves
        await supabase.from('invoices').delete().in('id', invoiceIds);
      }

      // 2. Hard delete the client from database
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

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'ACTIVE ACCOUNTS', value: clients.length < 10 ? `0${clients.length}` : clients.length, isOrange: true },
    { label: 'CORPORATE ENTITIES', value: corporateCount < 10 ? `0${corporateCount}` : corporateCount },
    { label: 'GST VERIFIED', value: clients.filter(c => c.gst_number).length },
    { label: 'CRM PIPELINE', value: 'Active' },
  ], [clients, corporateCount]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Clients CRM & Accounts"
        description="Customer relationship intelligence, billing entities, and account communications."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchClients}
              className="p-2 rounded bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] transition-colors"
              title="Sync accounts"
            >
              <RefreshCw size={13} />
            </button>
            {canManage && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold transition-colors shadow-sm"
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
      <div className="flex items-center justify-between gap-3 bg-[#0C0D12] border border-white/[0.06] rounded-lg p-2.5 max-w-md">
        <div className="relative w-full">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search clients by name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-[#07080B] border border-white/[0.05] focus:border-[#FF6B4A]/40 rounded text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
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
          description={search ? "No accounts match this query." : "Add client companies and contacts to streamline invoice generation."}
          action={canManage && !search ? { label: "Add First Client", onClick: openCreateModal } : undefined}
        />
      ) : (
        <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-white/[0.05] text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider bg-[#090A0E]">
            <div className="col-span-4">Client & Company</div>
            <div className="col-span-3">Contact Email</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2">Tax ID / GST</div>
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
                className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.025] transition-colors cursor-pointer items-center text-xs group"
              >
                <div className="col-span-4 min-w-0 pr-2">
                  <div className="font-semibold text-white group-hover:text-[#FF6B4A] transition-colors truncate">
                    {client.company_name || client.name}
                  </div>
                  {client.company_name && (
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">{client.name}</div>
                  )}
                </div>

                <div className="col-span-3 text-zinc-400 truncate">
                  {client.email || '—'}
                </div>

                <div className="col-span-2 text-zinc-400 font-mono text-[11px]">
                  {client.phone || '—'}
                </div>

                <div className="col-span-2 text-zinc-500 font-mono text-[11px] truncate">
                  {client.gst_number || '—'}
                </div>

                <div className="col-span-1 text-right" onClick={e => e.stopPropagation()}>
                  {canManage && (
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-1 rounded hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteClientId(client.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
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
          badge="ACTIVE"
          onClose={() => setInspectingClient(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { openEditModal(inspectingClient); setInspectingClient(null); }}
                className="px-3 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded transition-colors"
              >
                Edit Account Details
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#08090C] p-3.5 rounded border border-white/[0.04] space-y-2">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Primary Contact</span>
                <span className="text-white font-medium">{inspectingClient.name}</span>
              </div>
              {inspectingClient.company_name && (
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Organization Entity</span>
                  <span className="text-white font-medium">{inspectingClient.company_name}</span>
                </div>
              )}
              {inspectingClient.email && (
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Email</span>
                  <span className="text-zinc-300 font-mono text-[11px]">{inspectingClient.email}</span>
                </div>
              )}
              {inspectingClient.phone && (
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Phone</span>
                  <span className="text-zinc-300 font-mono text-[11px]">{inspectingClient.phone}</span>
                </div>
              )}
              {inspectingClient.gst_number && (
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Tax / GST Number</span>
                  <span className="text-zinc-300 font-mono text-[11px]">{inspectingClient.gst_number}</span>
                </div>
              )}
            </div>

            {inspectingClient.address && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">Billing Address</span>
                <p className="text-zinc-300 bg-[#08090C] p-3 rounded border border-white/[0.04] leading-relaxed">
                  {inspectingClient.address}
                </p>
              </div>
            )}

            {inspectingClient.notes && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">Account Notes</span>
                <p className="text-zinc-400 bg-[#08090C] p-3 rounded border border-white/[0.04] leading-relaxed whitespace-pre-wrap">
                  {inspectingClient.notes}
                </p>
              </div>
            )}
          </div>
        </ContextInspector>
      )}

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0C0D12] border border-white/[0.08] rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Building size={15} className="text-[#FF6B4A]" />
                <span>{editingClient ? 'Edit Client' : 'New Client Account'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Primary Contact Name <span className="text-[#FF6B4A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Company / Organization Entity
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp Technologies"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="billing@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+1 555-0199"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  GST / Tax ID Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={gstNumber}
                  onChange={e => setGstNumber(e.target.value)}
                  className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, City, Postal Code..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-[#10121A] hover:bg-[#151822] text-zinc-300 text-xs rounded border border-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-white font-semibold text-xs rounded transition-colors shadow-sm"
                >
                  {saving ? 'Saving...' : editingClient ? 'Update' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
