import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import { formatCurrency } from '../lib/currency';
import {
  CreditCard, Search, ArrowUpRight, RefreshCw, X, Check, FileText,
  Clock, CheckCircle2, AlertTriangle, ExternalLink, Eye, Loader2
} from 'lucide-react';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import { toast } from '../components/ui/Toast';
import { paymentSubmissionApi, type PaymentSubmission } from '../lib/paymentSubmissionApi';

export default function Payments() {
  const { user, role } = useAuth();
  const { orgId, defaultCurrency } = useWorkspace();
  const canVerify = hasPermission(role, 'record_payments') || role === 'owner' || role === 'administrator';

  const [activeTab, setActiveTab] = useState<'verification' | 'ledger'>('verification');

  // Ledger state
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Verification queue state
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionFilter, setSubmissionFilter] = useState<'pending' | 'confirmed' | 'rejected' | 'all'>('pending');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Receipt Preview Modal
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewMime, setPreviewMime] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPayments = useCallback(async () => {
    if (!user) { setLoadingPayments(false); return; }
    setLoadingPayments(true);
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
      setLoadingPayments(false);
    }
  }, [user, orgId]);

  const fetchSubmissions = useCallback(async () => {
    if (!user) { setLoadingSubmissions(false); return; }
    setLoadingSubmissions(true);
    try {
      const list = await paymentSubmissionApi.listSubmissions({ orgId: orgId || undefined });
      setSubmissions(list);
    } catch (e) {
      console.error('Error fetching payment submissions:', e);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [user, orgId]);

  useEffect(() => {
    fetchPayments();
    fetchSubmissions();
  }, [fetchPayments, fetchSubmissions]);

  // Realtime subscription for submissions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('realtime:payment_submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_submissions' }, () => {
        fetchSubmissions();
        fetchPayments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSubmissions, fetchPayments]);

  const pendingCount = useMemo(() => {
    return submissions.filter(s => s.status === 'pending').length;
  }, [submissions]);

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      let matchFilter = submissionFilter === 'all';
      if (!matchFilter) {
        matchFilter = s.status === submissionFilter;
      }

      const q = submissionSearch.trim().toLowerCase();
      const num = s.invoices?.invoice_number?.toLowerCase() || '';
      const client = s.clients?.company_name?.toLowerCase() || s.clients?.name?.toLowerCase() || '';
      const ref = s.transaction_reference?.toLowerCase() || '';
      const notes = s.notes?.toLowerCase() || '';

      const matchSearch = !q || num.includes(q) || client.includes(q) || ref.includes(q) || notes.includes(q);
      return matchFilter && matchSearch;
    });
  }, [submissions, submissionFilter, submissionSearch]);

  // Confirm Submission
  const handleConfirm = async (sub: PaymentSubmission) => {
    if (!canVerify) {
      toast.error('You do not have permission to verify payment submissions');
      return;
    }
    setProcessingId(sub.id);
    try {
      await paymentSubmissionApi.confirmSubmission(sub.id);
      toast.success(`Payment confirmed for invoice ${sub.invoices?.invoice_number || ''}`);
      await Promise.all([fetchSubmissions(), fetchPayments()]);
    } catch (err: any) {
      console.error('Confirmation failed:', err);
      toast.error(err.message || 'Failed to confirm payment');
    } finally {
      setProcessingId(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (subId: string) => {
    if (!canVerify) {
      toast.error('You do not have permission to reject payment submissions');
      return;
    }
    setRejectingId(subId);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  // Execute Rejection
  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason for the client');
      return;
    }

    setProcessingId(rejectingId);
    try {
      await paymentSubmissionApi.rejectSubmission(rejectingId, rejectReason.trim());
      toast.success('Payment submission marked as rejected');
      setIsRejectModalOpen(false);
      setRejectingId(null);
      setRejectReason('');
      await fetchSubmissions();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      toast.error(err.message || 'Failed to reject payment');
    } finally {
      setProcessingId(null);
    }
  };

  // View Receipt Modal
  const handleViewReceipt = async (sub: PaymentSubmission) => {
    try {
      setPreviewLoading(true);
      setPreviewFileName(sub.receipt_filename || 'Receipt');
      setPreviewMime(sub.receipt_mime || '');
      const signedUrl = await paymentSubmissionApi.getReceiptUrl(sub.id);
      setPreviewReceiptUrl(signedUrl);
    } catch (err: any) {
      console.error('Failed to get receipt URL:', err);
      toast.error(err.message || 'Failed to load receipt file');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Ledger stats
  const totalCollected = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const filteredPayments = payments.filter(p => {
    const num = p.invoices?.invoice_number?.toLowerCase() || '';
    const clientName = p.invoices?.clients?.company_name?.toLowerCase() || p.invoices?.clients?.name?.toLowerCase() || '';
    const ref = p.transaction_reference?.toLowerCase() || '';
    const s = ledgerSearch.toLowerCase();
    return num.includes(s) || clientName.includes(s) || ref.includes(s);
  });

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'PENDING VERIFICATION', value: pendingCount < 10 ? `0${pendingCount}` : String(pendingCount), isOrange: pendingCount > 0 },
    { label: 'SETTLED REVENUE', value: formatCurrency(totalCollected, defaultCurrency) },
    { label: 'SETTLEMENT TRANSACTIONS', value: payments.length < 10 ? `0${payments.length}` : payments.length },
    { label: 'RECONCILIATION', value: '100% Immutable Ledger', indicator: 'Audited' },
  ], [pendingCount, totalCollected, payments, defaultCurrency]);

  return (
    <div className="flex-1 space-y-6 pb-16 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Settlements & Financial Transactions"
        description="Payment verification queue, client remittance reviews, and immutable reconciliation ledger."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchPayments();
                fetchSubmissions();
              }}
              className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors"
              title="Sync settlements"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Tabs Navigation: Verification Queue vs Settlement Ledger ── */}
      <div className="flex items-center justify-between border-b border-divider gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('verification')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'verification'
                ? 'border-[#FF6B4A] text-main'
                : 'border-transparent text-muted hover:text-zinc-200'
            }`}
          >
            <Clock size={13} className={pendingCount > 0 ? 'text-[#FF6B4A]' : ''} />
            <span>Verification Queue</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'ledger'
                ? 'border-[#FF6B4A] text-main'
                : 'border-transparent text-muted hover:text-zinc-200'
            }`}
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Settlement Ledger</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-app text-muted border border-divider">
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 1: VERIFICATION QUEUE (PHASE 3)                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          
          {/* Submissions Filter & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg border border-divider rounded-lg p-2.5">
            <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-sm">
              <div className="relative w-full">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search invoice #, client, reference, or notes..."
                  value={submissionSearch}
                  onChange={e => setSubmissionSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-app border border-divider focus:border-[#FF6B4A]/40 rounded text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
                {submissionSearch && (
                  <button onClick={() => setSubmissionSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex bg-app border border-divider rounded p-0.5">
              {[
                { key: 'pending', label: 'Pending Review', count: pendingCount },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'rejected', label: 'Rejected' },
                { key: 'all', label: 'All Submissions' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setSubmissionFilter(f.key as any)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                    submissionFilter === f.key
                      ? 'bg-hover text-main font-semibold'
                      : 'text-muted hover:text-zinc-200'
                  }`}
                >
                  <span>{f.label}</span>
                  {f.count !== undefined && f.count > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Submissions List */}
          {loadingSubmissions ? (
            <SkeletonRow count={4} />
          ) : filteredSubmissions.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={submissionFilter === 'pending' ? 'Verification Queue is Clear' : 'No submissions found'}
              description={
                submissionSearch
                  ? 'No submissions match your search query.'
                  : submissionFilter === 'pending'
                  ? 'All client payment proofs have been reviewed and reconciled. Incoming manual payments will appear here.'
                  : 'No payment submissions recorded for this filter.'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((sub, idx) => {
                const isPending = sub.status === 'pending';
                const isConfirmed = sub.status === 'confirmed';
                const isRejected = sub.status === 'rejected';
                const isProcessing = processingId === sub.id;

                return (
                  <div
                    key={sub.id}
                    className={`bg-card-bg border border-divider rounded-xl p-4 sm:p-5 space-y-4 hover:border-white/10 transition-colors animate-fade-up stagger-${Math.min(idx + 1, 8)}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-divider">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          isPending ? 'bg-amber-400 animate-pulse' : isConfirmed ? 'bg-emerald-400' : 'bg-red-400'
                        }`} />
                        <Link
                          to={`/invoices/${sub.invoice_id}`}
                          className="font-mono font-bold text-main hover:text-[#FF6B4A] transition-colors flex items-center gap-1 text-sm"
                        >
                          <span>{sub.invoices?.invoice_number || 'Invoice'}</span>
                          <ArrowUpRight size={13} className="text-muted" />
                        </Link>
                        <span className="text-muted text-xs">&bull;</span>
                        <span className="text-main font-semibold text-xs">
                          {sub.clients?.company_name || sub.clients?.name || 'Client'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase ${
                          isPending
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                            : isConfirmed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                            : 'bg-red-500/10 text-red-400 border border-red-500/25'
                        }`}>
                          {sub.status}
                        </span>
                        <span className="text-[11px] font-mono text-muted">
                          Submitted {new Date(sub.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Submission Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono bg-app/50 p-3.5 rounded-lg border border-divider">
                      <div>
                        <span className="text-[10px] text-muted block uppercase">Claimed Amount</span>
                        <span className="text-sm font-bold text-main text-emerald-400 tabular-nums">
                          {formatCurrency(sub.amount, sub.currency || defaultCurrency)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted block uppercase">Channel</span>
                        <span className="text-main font-medium capitalize font-sans">
                          {sub.payment_method?.replace(/_/g, ' ') || 'Direct'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted block uppercase">Payment Date</span>
                        <span className="text-main font-medium">
                          {new Date(sub.payment_date).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted block uppercase">Reference / UTR</span>
                        <span className="text-main font-bold truncate block">
                          {sub.transaction_reference || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Remarks & Rejection Reason */}
                    {sub.notes && (
                      <div className="text-xs text-muted font-sans bg-app/30 p-2.5 rounded border border-divider">
                        <span className="font-mono text-[10px] text-zinc-400 uppercase font-bold block mb-0.5">Submitter Remarks:</span>
                        <p className="text-zinc-300">{sub.notes}</p>
                      </div>
                    )}

                    {isRejected && sub.rejection_reason && (
                      <div className="text-xs bg-red-500/10 border border-red-500/30 rounded p-2.5 text-red-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                          <AlertTriangle size={13} />
                          <span>Rejection Reason Given:</span>
                        </div>
                        <p className="text-xs pl-4">{sub.rejection_reason}</p>
                      </div>
                    )}

                    {/* Actions Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(sub)}
                        disabled={previewLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-zinc-200 border border-divider text-xs font-medium transition-colors"
                      >
                        <Eye size={13} className="text-[#FF6B4A]" />
                        <span>View Settlement Receipt</span>
                      </button>

                      {isPending && canVerify && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => openRejectModal(sub.id)}
                            className="px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition-colors"
                          >
                            Reject Proof
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleConfirm(sub)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-40"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Reconciling...</span>
                              </>
                            ) : (
                              <>
                                <Check size={13} />
                                <span>Confirm Settlement</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {isConfirmed && sub.verified_at && (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>Reconciled into immutable ledger</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SETTLEMENT LEDGER (EXISTING RECONCILED PAYMENTS)       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          
          {/* Signature Animation: Settlement Rail Telemetry */}
          <div className="bg-card-bg border border-divider rounded-lg p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono text-muted font-semibold uppercase tracking-wider">
                Settlement Rail: Automated Clearing House (ACH) / Direct Wire / UPI Ledger
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-muted">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Authorized</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Cleared</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Reconciled</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-3 bg-card-bg border border-divider rounded-lg p-2.5 max-w-md">
            <div className="relative w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search invoice number, client, or reference ID..."
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-app border border-divider focus:border-[#FF6B4A]/40 rounded text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
              />
              {ledgerSearch && (
                <button onClick={() => setLedgerSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Financial Ledger Table */}
          {loadingPayments ? (
            <SkeletonRow count={5} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No settlement records found"
              description={ledgerSearch ? "No settlements match this query." : "Payment settlements will appear here as incoming receivables are cleared and verified."}
            />
          ) : (
            <div className="bg-card-bg border border-divider rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-app">
                <div className="col-span-4">Invoice / Client</div>
                <div className="col-span-2">Payment Method</div>
                <div className="col-span-3">Transaction Reference</div>
                <div className="col-span-1">Settled Date</div>
                <div className="col-span-2 text-right">Cleared Amount</div>
              </div>

              <div className="divide-y divide-white/[0.03]">
                {filteredPayments.map((p, idx) => (
                  <div key={p.id} className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors items-center text-xs font-mono animate-fade-up stagger-${Math.min(idx + 1, 8)}`}>
                    <div className="col-span-4 min-w-0 pr-2">
                      <Link
                        to={`/invoices/${p.invoices?.id}`}
                        className="font-mono font-bold text-main hover:text-[#FF6B4A] transition-colors flex items-center gap-1.5"
                      >
                        <span>{p.invoices?.invoice_number || 'Unknown Invoice'}</span>
                        <ArrowUpRight size={12} className="text-muted" />
                      </Link>
                      <div className="text-[11px] text-muted truncate mt-0.5 font-sans">
                        {p.invoices?.clients?.company_name || p.invoices?.clients?.name || 'General Client'}
                      </div>
                    </div>

                    <div className="col-span-2 text-muted capitalize text-[11px] font-sans">
                      {p.payment_method?.replace(/_/g, ' ') || 'Direct Transfer'}
                    </div>

                    <div className="col-span-3 font-mono text-[11px] text-muted truncate">
                      {p.transaction_reference ? (
                        <span className="bg-app px-2 py-0.5 rounded border border-divider text-[11px]">
                          {p.transaction_reference}
                        </span>
                      ) : (
                        '—'
                      )}
                    </div>

                    <div className="col-span-1 text-[11px] font-mono text-muted">
                      {new Date(p.payment_date || p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>

                    <div className="col-span-2 text-right font-mono text-xs font-bold text-emerald-400 tabular-nums">
                      +{formatCurrency(p.amount, p.currency || p.invoices?.currency || defaultCurrency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Receipt Preview Modal ── */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card-bg border border-divider rounded-xl p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-main flex items-center gap-2">
                <FileText size={14} className="text-[#FF6B4A]" />
                <span>{previewFileName}</span>
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded hover:bg-hover text-muted hover:text-main"
                  title="Open in new window"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => setPreviewReceiptUrl(null)}
                  className="p-1.5 rounded hover:bg-hover text-muted hover:text-main"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/40 rounded-lg p-2 min-h-[300px]">
              {previewMime === 'application/pdf' ? (
                <iframe
                  src={previewReceiptUrl}
                  title="PDF Receipt"
                  className="w-full h-[500px] rounded border border-divider"
                />
              ) : (
                <img
                  src={previewReceiptUrl}
                  alt="Receipt Document"
                  className="max-h-[600px] w-auto object-contain rounded"
                />
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-divider">
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-4 py-1.5 bg-hover hover:bg-hover text-main text-xs rounded border border-divider"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Modal ── */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>Reject Payment Proof</span>
              </h3>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-muted hover:text-main">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleRejectConfirm} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Reason for Rejection <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Transaction ID was not found in our bank statement, or receipt is unreadable."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-red-500/50 rounded p-2.5 text-xs text-main placeholder-zinc-500 focus:outline-none"
                />
                <span className="text-[10px] text-muted block mt-1">
                  This note will be displayed directly to the client on their invoice screen.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-3.5 py-1.5 bg-hover hover:bg-hover text-muted text-xs rounded border border-divider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rejectReason.trim()}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded transition-colors disabled:opacity-40"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
