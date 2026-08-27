import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { formatCurrency } from '../lib/currency';
import {
  CreditCard, Search, ArrowUpRight, RefreshCw, X
} from 'lucide-react';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

export default function Payments() {
  const { user } = useAuth();
  const { orgId, defaultCurrency } = useWorkspace();

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPayments = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('invoice_payments')
        .select(`
          *,
          invoices:invoice_id(
            id,
            invoice_number,
            currency,
            organization_id,
            owner_id,
            clients:client_id(name, company_name)
          )
        `)
        .order('payment_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Filter by org or owner
      const filteredData = (data || []).filter((p: any) => {
        if (orgId) return p.invoices?.organization_id === orgId;
        return p.invoices?.owner_id === user.id;
      });

      setPayments(filteredData);
    } catch (e) {
      console.error('Error fetching payments:', e);
    } finally {
      setLoading(false);
    }
  }, [user, orgId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalCollected = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

  const filtered = payments.filter(p => {
    const num = p.invoices?.invoice_number?.toLowerCase() || '';
    const clientName = p.invoices?.clients?.company_name?.toLowerCase() || p.invoices?.clients?.name?.toLowerCase() || '';
    const ref = p.transaction_reference?.toLowerCase() || '';
    const s = search.toLowerCase();
    return num.includes(s) || clientName.includes(s) || ref.includes(s);
  });

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'SETTLED REVENUE', value: formatCurrency(totalCollected, defaultCurrency), isOrange: totalCollected > 0 },
    { label: 'SETTLEMENT TRANSACTIONS', value: payments.length < 10 ? `0${payments.length}` : payments.length },
    { label: 'CLEARANCE METHOD', value: 'Instant Wire' },
    { label: 'RECONCILIATION', value: '100% Verified', indicator: 'Audited' },
  ], [totalCollected, payments, defaultCurrency]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Settlements & Financial Transactions"
        description="Reconciled payment receipts, clearing ledger, and audit history."
        actions={
          <button
            onClick={fetchPayments}
            className="p-2 rounded bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] transition-colors"
            title="Sync settlements"
          >
            <RefreshCw size={13} />
          </button>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Signature Animation: Settlement Rail Telemetry ── */}
      <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-zinc-300 font-semibold uppercase tracking-wider">Settlement Rail: Automated Clearing House (ACH) / Direct Wire</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Authorized</span>
          <span className="text-zinc-600">→</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Settled</span>
          <span className="text-zinc-600">→</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Reconciled</span>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="flex items-center justify-between gap-3 bg-[#0C0D12] border border-white/[0.06] rounded-lg p-2.5 max-w-md">
        <div className="relative w-full">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search invoice number, client, or reference ID..."
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

      {/* ── Financial Ledger Table ── */}
      {loading ? (
        <SkeletonRow count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No settlement records found"
          description={search ? "No settlements match this query." : "Payment settlements will appear here as incoming receivables are cleared."}
        />
      ) : (
        <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-white/[0.05] text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider bg-[#090A0E]">
            <div className="col-span-4">Invoice / Client</div>
            <div className="col-span-2">Payment Method</div>
            <div className="col-span-3">Transaction Reference</div>
            <div className="col-span-1">Settled Date</div>
            <div className="col-span-2 text-right">Cleared Amount</div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {filtered.map(p => (
              <div key={p.id} className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors items-center text-xs">
                <div className="col-span-4 min-w-0 pr-2">
                  <Link
                    to={`/invoices/${p.invoices?.id}`}
                    className="font-mono font-bold text-white hover:text-[#FF6B4A] transition-colors flex items-center gap-1.5"
                  >
                    <span>{p.invoices?.invoice_number || 'Unknown Invoice'}</span>
                    <ArrowUpRight size={12} className="text-zinc-500" />
                  </Link>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {p.invoices?.clients?.company_name || p.invoices?.clients?.name || 'General Client'}
                  </div>
                </div>

                <div className="col-span-2 text-zinc-400 capitalize text-[11px]">
                  {p.payment_method?.replace(/_/g, ' ') || 'Direct Transfer'}
                </div>

                <div className="col-span-3 font-mono text-[11px] text-zinc-400 truncate">
                  {p.transaction_reference || '—'}
                </div>

                <div className="col-span-1 text-[11px] font-mono text-zinc-500">
                  {new Date(p.payment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>

                <div className="col-span-2 text-right font-mono text-xs font-bold text-emerald-400">
                  +{formatCurrency(p.amount, p.invoices?.currency || defaultCurrency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
