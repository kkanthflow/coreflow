import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { formatCurrency } from '../lib/currency';
import { hasPermission } from '../lib/permissions';
import { Search, X, Plus, RefreshCw, Receipt } from 'lucide-react';
import {
  PageHeader, MetricStrip, StatusSignal, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

interface Invoice {
  id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  issue_date: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  clients: { name: string; company_name: string };
}

const STATUS_FILTERS = [
  { key: 'all',            label: 'All Invoices' },
  { key: 'sent',           label: 'Awaiting Payment' },
  { key: 'partially_paid', label: 'Partially Paid' },
  { key: 'paid',           label: 'Settled & Paid' },
  { key: 'overdue',        label: 'Overdue' },
  { key: 'draft',          label: 'Drafts' },
];

export default function Invoices() {
  const { user, role } = useAuth();
  const { orgId, defaultCurrency } = useWorkspace();
  const navigate = useNavigate();
  const canManage = hasPermission(role, 'create_invoices') || hasPermission(role, 'edit_invoices');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');

  const fetchInvoices = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          id, invoice_number, status, due_date, issue_date,
          currency, total_amount, paid_amount, balance_due,
          clients:client_id (name, company_name)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (orgId) {
        query = query.eq('org_id', orgId);
      } else {
        query = query.eq('owner_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices((data || []) as any);
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  }, [user, orgId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = invoices.filter(inv => {
    const matchFilter = filter === 'all' || inv.status === filter;
    const clientName = inv.clients?.name || '';
    const companyName = inv.clients?.company_name || '';
    const matchSearch = !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      companyName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalInvoiced = invoices.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalPaid = invoices.reduce((acc, curr) => acc + Number(curr.paid_amount || 0), 0);
  const totalOutstanding = invoices.reduce((acc, curr) => acc + Number(curr.balance_due || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'TOTAL INVOICED', value: formatCurrency(totalInvoiced, defaultCurrency) },
    { label: 'COLLECTED REVENUE', value: formatCurrency(totalPaid, defaultCurrency), indicator: 'Settled' },
    { label: 'RECEIVABLES', value: formatCurrency(totalOutstanding, defaultCurrency), isOrange: totalOutstanding > 0 },
    { label: 'OVERDUE CLAIMS', value: overdueCount < 10 ? `0${overdueCount}` : overdueCount, trend: overdueCount > 0 ? 'Requires Action' : undefined },
    { label: 'TOTAL INVOICES', value: invoices.length < 10 ? `0${invoices.length}` : invoices.length },
    { label: 'LEDGER HEALTH', value: '100% Synced' },
  ], [totalInvoiced, totalPaid, totalOutstanding, overdueCount, invoices, defaultCurrency]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Invoices & Billing Telemetry"
        description="Accounts receivable governance, payment tracking, and ledger reconciliation."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInvoices}
              className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors"
              title="Sync ledger"
            >
              <RefreshCw size={13} />
            </button>
            {canManage && (
              <button
                onClick={() => navigate('/invoices/new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>Create Invoice</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Continuous Financial Metric Strip (Tabular Numerals) ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Filter Bar & Search ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg border border-divider rounded-lg p-2.5">
        <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-sm">
          <div className="relative w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search invoice ID or client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#07080B] border border-divider focus:border-[#FF6B4A]/40 rounded text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex bg-[#07080B] border border-divider rounded p-0.5 overflow-x-auto">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? 'bg-hover text-main font-semibold'
                  : 'text-muted hover:text-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Financial Ledger Table (Aligned Tabular Numerals) ── */}
      {loading ? (
        <SkeletonRow count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description={search ? "No invoice records match this filter." : "Generate your first invoice to begin receivables tracking."}
          action={canManage && !search ? { label: "Create First Invoice", onClick: () => navigate('/invoices/new') } : undefined}
        />
      ) : (
        <div className="bg-card-bg border border-divider rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-card-bg">
            <div className="col-span-3">Invoice Number</div>
            <div className="col-span-3">Client Entity</div>
            <div className="col-span-2">Settlement Status</div>
            <div className="col-span-2">Issue / Due Date</div>
            <div className="col-span-2 text-right">Total & Balance</div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {filtered.map(inv => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors items-center text-xs group"
              >
                <div className="col-span-3 min-w-0 pr-2">
                  <div className="font-mono font-bold text-main group-hover:text-[#FF6B4A] transition-colors truncate">
                    {inv.invoice_number}
                  </div>
                </div>

                <div className="col-span-3 min-w-0 pr-2">
                  <div className="font-semibold text-main truncate">
                    {inv.clients?.company_name || inv.clients?.name || 'Unassigned Client'}
                  </div>
                  {inv.clients?.company_name && inv.clients?.name && (
                    <div className="text-muted text-[11px] truncate mt-0.5">{inv.clients.name}</div>
                  )}
                </div>

                <div className="col-span-2">
                  <StatusSignal status={inv.status} />
                </div>

                <div className="col-span-2 text-muted text-xs font-mono text-[11px]">
                  <div>Issued: {new Date(inv.issue_date || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                  <div className="text-muted text-[10px]">Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Immediate'}</div>
                </div>

                <div className="col-span-2 text-right font-mono tabular-nums">
                  <div className="font-bold text-main text-xs">{formatCurrency(inv.total_amount, inv.currency || defaultCurrency)}</div>
                  <div className="text-[11px] font-mono text-muted">
                    {inv.balance_due > 0 ? (
                      <span className="text-[#FF6B4A]">{formatCurrency(inv.balance_due, inv.currency || defaultCurrency)} bal</span>
                    ) : (
                      <span className="text-emerald-400">Settled</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
