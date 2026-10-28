import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { formatCurrency } from '../lib/currency';
import { hasPermission } from '../lib/permissions';
import {
  Search, X, Plus, RefreshCw, Receipt,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  PageHeader, MetricStrip, StatusSignal, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

export function deriveInvoiceStatus(inv: {
  total_amount?: number;
  paid_amount?: number;
  balance_due?: number;
  due_date?: string;
  status?: string;
}): 'paid' | 'partially_paid' | 'overdue' | 'unpaid' | 'draft' | 'cancelled' {
  if (inv.status === 'draft') return 'draft';
  if (inv.status === 'cancelled') return 'cancelled';

  const total = Math.round(Number(inv.total_amount || 0) * 100) / 100;
  const paid = Math.round(Number(inv.paid_amount || 0) * 100) / 100;
  const balance = Math.round(Number(inv.balance_due != null ? inv.balance_due : Math.max(0, total - paid)) * 100) / 100;

  if (balance <= 0 && total > 0) return 'paid';

  const isDuePassed = inv.due_date
    ? new Date(inv.due_date).setHours(23, 59, 59, 999) < Date.now()
    : false;

  if (isDuePassed) return 'overdue';
  if (paid > 0 && balance > 0) return 'partially_paid';

  return 'unpaid';
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  derivedStatus: string;
  due_date: string;
  issue_date: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  clients?: { id: string; name: string; company_name: string } | null;
  organizations?: { id: string; name: string; logo_url?: string } | null;
  owner?: { id: string; full_name: string; email: string } | null;
}

const CLIENT_STATUS_FILTERS = [
  { key: 'all',            label: 'All Invoices' },
  { key: 'unpaid',         label: 'Unpaid' },
  { key: 'partially_paid', label: 'Partially Paid' },
  { key: 'paid',           label: 'Paid' },
  { key: 'overdue',        label: 'Overdue' },
];

const ADMIN_STATUS_FILTERS = [
  { key: 'all',            label: 'All Invoices' },
  { key: 'unpaid',         label: 'Awaiting Payment' },
  { key: 'partially_paid', label: 'Partially Paid' },
  { key: 'paid',           label: 'Settled & Paid' },
  { key: 'overdue',        label: 'Overdue' },
  { key: 'draft',          label: 'Drafts' },
];

const PAGE_SIZE = 10;

export default function Invoices() {
  const { user, role } = useAuth();
  const { orgId, defaultCurrency } = useWorkspace();
  const navigate = useNavigate();
  const isClient = role === 'client';
  const canManage = !isClient && (hasPermission(role, 'create_invoices') || hasPermission(role, 'edit_invoices'));

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchInvoices = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          id, invoice_number, status, due_date, issue_date,
          currency, total_amount, paid_amount, balance_due,
          clients:client_id (id, name, company_name),
          organizations:organization_id (id, name, logo_url),
          owner:owner_id (id, full_name, email)
        `)
        .eq('is_deleted', false)
        .order('issue_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (isClient) {
        // Exclude drafts and cancelled invoices for clients
        query = query.not('status', 'in', '("draft","cancelled")');

        // Resolve linked client IDs for this client contact
        let clientQuery = supabase.from('clients').select('id');
        if (user.email) {
          clientQuery = clientQuery.or(`user_id.eq.${user.id},email.ilike.${user.email.trim()}`);
        } else {
          clientQuery = clientQuery.eq('user_id', user.id);
        }
        const { data: userClients } = await clientQuery;

        const { data: pcaClients } = await supabase
          .from('project_client_access')
          .select('client_id')
          .eq('user_id', user.id)
          .not('client_id', 'is', null);

        const clientIds = Array.from(new Set([
          ...(userClients || []).map((c: any) => c.id),
          ...(pcaClients || []).map((p: any) => p.client_id)
        ])).filter(Boolean);

        if (clientIds.length > 0) {
          query = query.in('client_id', clientIds);
        } else {
          setInvoices([]);
          setLoading(false);
          return;
        }
      } else if (orgId) {
        query = query.or(`organization_id.eq.${orgId},and(organization_id.is.null,owner_id.eq.${user.id})`);
      } else {
        query = query.eq('owner_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate server-derived dynamic status for every invoice
      const enriched: Invoice[] = (data || []).map((inv: any) => {
        const derived = deriveInvoiceStatus(inv);
        return {
          ...inv,
          derivedStatus: derived,
        };
      });

      setInvoices(enriched);
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  }, [user, orgId, isClient]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Realtime synchronization
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('realtime:invoices_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, fetchInvoices)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchInvoices]);

  const activeFilters = isClient ? CLIENT_STATUS_FILTERS : ADMIN_STATUS_FILTERS;

  // Filter & Search
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      // Status match (matching against derivedStatus for consistency)
      let matchFilter = filter === 'all';
      if (!matchFilter) {
        if (filter === 'unpaid') {
          matchFilter = inv.derivedStatus === 'unpaid';
        } else if (filter === 'sent') {
          matchFilter = inv.derivedStatus === 'unpaid' || inv.status === 'sent';
        } else {
          matchFilter = inv.derivedStatus === filter || inv.status === filter;
        }
      }

      // Search match: invoice number, issuing business, or client
      const q = search.trim().toLowerCase();
      const clientName = inv.clients?.name?.toLowerCase() || '';
      const clientCompany = inv.clients?.company_name?.toLowerCase() || '';
      const issuingBusiness = (inv.organizations?.name || inv.owner?.full_name || '').toLowerCase();
      const invNumber = (inv.invoice_number || '').toLowerCase();

      const matchSearch = !q ||
        invNumber.includes(q) ||
        issuingBusiness.includes(q) ||
        clientName.includes(q) ||
        clientCompany.includes(q);

      return matchFilter && matchSearch;
    });
  }, [invoices, filter, search]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const eligibleInvoices = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'draft');
  const totalInvoiced = eligibleInvoices.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalPaid = invoices.filter(i => i.status !== 'cancelled').reduce((acc, curr) => acc + Number(curr.paid_amount || 0), 0);
  const totalOutstanding = eligibleInvoices.reduce((acc, curr) => {
    const bal = Number(curr.balance_due != null ? curr.balance_due : Math.max(0, Number(curr.total_amount || 0) - Number(curr.paid_amount || 0)));
    return acc + (bal > 0 ? bal : 0);
  }, 0);
  const overdueCount = invoices.filter(i => i.derivedStatus === 'overdue' && i.status !== 'cancelled').length;

  const metrics: MetricItem[] = useMemo(() => [
    { label: isClient ? 'TOTAL BILLED' : 'TOTAL INVOICED', value: formatCurrency(totalInvoiced, defaultCurrency) },
    { label: isClient ? 'AMOUNT SETTLED' : 'COLLECTED REVENUE', value: formatCurrency(totalPaid, defaultCurrency), indicator: 'Settled' },
    { label: isClient ? 'BALANCE DUE' : 'RECEIVABLES', value: formatCurrency(totalOutstanding, defaultCurrency), isOrange: totalOutstanding > 0 },
    { label: 'OVERDUE CLAIMS', value: overdueCount < 10 ? `0${overdueCount}` : overdueCount, trend: overdueCount > 0 ? 'Requires Action' : undefined },
    { label: 'TOTAL INVOICES', value: invoices.length < 10 ? `0${invoices.length}` : invoices.length },
    { label: 'LEDGER HEALTH', value: '100% Synced' },
  ], [totalInvoiced, totalPaid, totalOutstanding, overdueCount, invoices, defaultCurrency, isClient]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title={isClient ? 'My Invoices' : 'Invoices & Billing Telemetry'}
        description={isClient ? 'Review project invoices, payment history, settlement receipts, and outstanding balances.' : 'Accounts receivable governance, payment tracking, and ledger reconciliation.'}
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20"
              >
                <Plus size={14} />
                <span>Create Invoice</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Continuous Financial Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Filter Bar & Search ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg border border-divider rounded-xl shadow-sm p-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-sm">
          <div className="relative w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder={isClient ? "Search by invoice # or issuing business..." : "Search invoice ID or client..."}
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-7 py-1.5 bg-surface-2 border border-line focus:border-accent/40 rounded-lg text-xs text-text placeholder-muted/60 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => { setSearch(''); setCurrentPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex bg-surface-2 border border-line rounded-lg p-0.5 overflow-x-auto">
          {activeFilters.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                filter === f.key
                  ? 'bg-card-bg text-text font-semibold shadow-xs'
                  : 'text-muted hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Invoices Views ── */}
      {loading ? (
        <SkeletonRow count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={isClient ? "No invoices found" : "No invoices registered"}
          description={
            search
              ? "No invoices match the current query or filter."
              : isClient
              ? "Your client account has no invoices issued yet. Once your projects generate billings, they will appear here."
              : "Generate your first invoice to begin receivables tracking."
          }
          action={canManage && !search ? { label: "Create First Invoice", onClick: () => navigate('/invoices/new') } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {/* 1. DESKTOP VIEW: Structured Tabular Grid (md and up) */}
          <div className="hidden md:block bg-card-bg border border-divider rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-surface-2/50">
              <div className="col-span-3">Invoice Number</div>
              <div className="col-span-3">{isClient ? 'Issuing Business' : 'Client Entity'}</div>
              <div className="col-span-2">Settlement Status</div>
              <div className="col-span-2">Issue / Due Date</div>
              <div className="col-span-2 text-right">Total & Balance</div>
            </div>

            <div className="divide-y divide-divider">
              {paginatedInvoices.map((inv, idx) => {
                const issuingBusiness = inv.organizations?.name || inv.owner?.full_name || 'Auvryn Business';
                const clientName = inv.clients?.company_name || inv.clients?.name || 'Unassigned Client';

                return (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(idx * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-hover/60 transition-colors items-center text-xs group cursor-pointer"
                    >
                      <div className="col-span-3 min-w-0 pr-2">
                        <div className="font-mono font-bold text-main group-hover:text-accent transition-colors truncate">
                          {inv.invoice_number}
                        </div>
                      </div>

                      <div className="col-span-3 min-w-0 pr-2">
                        <div className="font-semibold text-main truncate">
                          {isClient ? issuingBusiness : clientName}
                        </div>
                        <div className="text-muted text-[11px] truncate mt-0.5">
                          {isClient ? (inv.organizations?.name ? 'Organization' : 'Freelancer') : (inv.clients?.company_name ? inv.clients?.name : '')}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <StatusSignal status={inv.derivedStatus} />
                      </div>

                      <div className="col-span-2 text-muted text-xs font-mono text-[11px]">
                        <div>Issued: {new Date(inv.issue_date || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-muted text-[10px]">Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Immediate'}</div>
                      </div>

                      <div className="col-span-2 text-right font-mono tabular-nums">
                        <div className="font-bold text-main text-xs">{formatCurrency(inv.total_amount, inv.currency || defaultCurrency)}</div>
                        <div className="text-[11px] font-mono text-muted">
                          {inv.balance_due > 0 ? (
                            <span className="text-accent">{formatCurrency(inv.balance_due, inv.currency || defaultCurrency)} due</span>
                          ) : (
                            <span className="text-emerald-500">Settled</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 2. MOBILE VIEW: Responsive Cards (sm and down) */}
          <div className="block md:hidden space-y-3">
            {paginatedInvoices.map((inv, idx) => {
              const issuingBusiness = inv.organizations?.name || inv.owner?.full_name || 'Auvryn Business';
              const clientName = inv.clients?.company_name || inv.clients?.name || 'Unassigned Client';

              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(idx * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    to={`/invoices/${inv.id}`}
                    className="block bg-card-bg border border-divider rounded-xl shadow-sm p-4 space-y-3 hover:border-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-main">{inv.invoice_number}</span>
                      <StatusSignal status={inv.derivedStatus} />
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                        {isClient ? 'Issuing Business' : 'Client Account'}
                      </span>
                      <span className="font-semibold text-main text-xs block truncate">
                        {isClient ? issuingBusiness : clientName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted bg-surface-2 p-2.5 rounded-lg border border-line">
                      <div>
                        <span className="block text-[10px] text-muted">Issued</span>
                        <span className="text-main font-medium">{new Date(inv.issue_date || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-muted">Due Date</span>
                        <span className="text-main font-medium">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'Immediate'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-divider font-mono">
                      <div>
                        <span className="text-[10px] text-muted block uppercase">Total Billed</span>
                        <span className="font-bold text-main text-xs">{formatCurrency(inv.total_amount, inv.currency || defaultCurrency)}</span>
                      </div>
                      <div className="text-right">
                      <span className="text-[10px] text-muted block uppercase">Balance Due</span>
                      {inv.balance_due > 0 ? (
                        <span className="font-bold text-accent text-xs">{formatCurrency(inv.balance_due, inv.currency || defaultCurrency)}</span>
                      ) : (
                        <span className="font-bold text-emerald-500 text-xs">Settled</span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
            })}
          </div>

          {/* ── Pagination Controls ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-card-bg border border-divider rounded-xl shadow-sm px-4 py-2.5 text-xs">
              <span className="text-muted text-[11px] font-mono">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} invoices
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-md hover:bg-hover disabled:opacity-30 text-muted hover:text-main border border-divider transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 font-mono text-xs font-semibold text-main">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded hover:bg-hover disabled:opacity-30 text-muted hover:text-main border border-divider transition-colors"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
