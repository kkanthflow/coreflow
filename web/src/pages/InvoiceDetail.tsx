import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import {
  ArrowLeft, Download, DollarSign, Trash2, Edit3, Printer, Copy, Check,
  Building, CreditCard, FileText, CheckCircle2, Clock, UploadCloud, AlertTriangle
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from '../components/ui/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, StatusSignal, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import { FlowStepper } from '../components/ui/FlowMotion';
import { deriveInvoiceStatus } from './Invoices';
import { paymentSubmissionApi, type PaymentSubmission } from '../lib/paymentSubmissionApi';
import SubmitPaymentProofModal from '../components/invoices/SubmitPaymentProofModal';

function fmt(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isClient = role === 'client';
  const canRecord = !isClient && hasPermission(role, 'record_payments');
  const canManageInvoices = !isClient && (hasPermission(role, 'create_invoices') || hasPermission(role, 'edit_invoices') || role === 'owner' || role === 'administrator');

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Payment Submissions State (Phase 3)
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [isSubmitProofOpen, setIsSubmitProofOpen] = useState(false);


  // Payment Modal (Staff only)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [txRef, setTxRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [recording, setRecording] = useState(false);

  // Delete Modal (Staff only)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteInvoice = async () => {
    if (!invoice?.id) return;
    try {
      setDeleting(true);
      await supabase.from('invoice_payments').delete().eq('invoice_id', invoice.id);
      await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;
      toast.success('Invoice deleted from database');
      navigate('/invoices');
    } catch (e: any) {
      console.error('Failed to delete invoice:', e);
      toast.error(e.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const fetchSubmissions = useCallback(async () => {
    if (!id) return;
    try {
      const list = await paymentSubmissionApi.listSubmissions({ invoice_id: id });
      setSubmissions(list);
    } catch (e) {
      console.error('Error fetching payment submissions:', e);
    }
  }, [id]);

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients:client_id(name, company_name, email, phone, gst_number, address),
          organizations:organization_id(id, name, logo_url, gst_number, address, website),
          owner:owner_id(id, full_name, email),
          invoice_items(*),
          invoice_payments(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setInvoice(data);
      if (data?.balance_due != null) {
        setPayAmount(String(data.balance_due));
      }
      fetchSubmissions();
    } catch (e) {
      console.error('Error fetching invoice:', e);
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [id, fetchSubmissions]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);


  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${key} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    try {
      toast.info('Generating PDF document...');
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: '#0E1015',
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${invoice.invoice_number || 'invoice'}.pdf`);
      toast.success('Invoice PDF downloaded');
    } catch (e) {
      console.error('Failed to generate PDF:', e);
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !user) return;
    const amountNum = parseFloat(payAmount);
    if (!amountNum || amountNum <= 0) return;

    setRecording(true);
    try {
      const { data: pmt, error: pmtErr } = await supabase
        .from('invoice_payments')
        .insert({
          invoice_id: invoice.id,
          amount: amountNum,
          payment_method: payMethod,
          transaction_reference: txRef.trim() || null,
          notes: payNotes.trim() || null,
          received_by: user.id
        })
        .select()
        .single();

      if (pmtErr) throw pmtErr;

      const newPaid = Number(invoice.paid_amount || 0) + amountNum;
      const newBal = Math.max(0, Number(invoice.total_amount || 0) - newPaid);
      const newStatus = newBal <= 0 ? 'paid' : 'partially_paid';

      await supabase
        .from('invoices')
        .update({
          paid_amount: newPaid,
          balance_due: newBal,
          status: newStatus,
        })
        .eq('id', invoice.id);

      setInvoice((prev: any) => ({
        ...prev,
        paid_amount: newPaid,
        balance_due: newBal,
        status: newStatus,
        invoice_payments: [...(prev.invoice_payments || []), pmt],
      }));

      setIsPayModalOpen(false);
      setTxRef('');
      setPayNotes('');
      toast.success('Payment recorded successfully');
    } catch (e: any) {
      console.error('Payment record failed:', e);
      toast.error(e.message || 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20 font-sans select-none px-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3">
          <FileText size={24} />
        </div>
        <h2 className="text-main font-bold text-base mb-1">Invoice Not Found</h2>
        <p className="text-muted text-xs max-w-md mx-auto mb-4">
          This invoice does not exist or you do not have permission to view it. Invoices in draft status are not visible to clients.
        </p>
        <button
          onClick={() => navigate('/invoices')}
          className="px-4 py-2 bg-[#FF6B4A] hover:bg-[#FF552B] text-main rounded text-xs font-semibold transition-colors"
        >
          {isClient ? 'Return to My Invoices' : 'Return to Invoices'}
        </button>
      </div>
    );
  }

  // Derive status
  const derivedStatus = deriveInvoiceStatus(invoice);
  const isPaid = derivedStatus === 'paid';

  // Submissions State
  const pendingSubmission = submissions.find(s => s.status === 'pending');
  const latestRejectedSubmission = submissions.find(s => s.status === 'rejected');

  // Issuing Business Identity
  const issuerName = invoice.organizations?.name || invoice.owner?.full_name || 'Issuing Business';
  const issuerLogo = invoice.visual_recreation?.properties?.logoUrl || invoice.visual_recreation?.logoUrl || invoice.organizations?.logo_url;
  const issuerGst = invoice.organizations?.gst_number;
  const issuerAddress = invoice.organizations?.address;
  const issuerWebsite = invoice.organizations?.website;
  const issuerEmail = invoice.owner?.email;

  // Remittance Properties (real values only)
  const props = invoice.visual_recreation?.properties || invoice.visual_recreation || {};
  const bankName = typeof props.bankName === 'string' ? props.bankName.trim() : '';
  const accountNumber = typeof props.accountNumber === 'string' ? props.accountNumber.trim() : '';
  const ifscCode = typeof props.ifscCode === 'string' ? props.ifscCode.trim() : '';
  const upiId = typeof props.upiId === 'string' ? props.upiId.trim() : '';
  const paymentTerms = typeof props.paymentTerms === 'string' ? props.paymentTerms.trim() : '';
  const customNotes = typeof props.customNotes === 'string' ? props.customNotes.trim() : '';

  const hasBank = Boolean(bankName || accountNumber || ifscCode);
  const hasUpi = Boolean(upiId);
  const hasRemittance = hasBank || hasUpi || Boolean(paymentTerms) || Boolean(customNotes);

  // Client Details
  const clientObj = invoice.clients;
  const clientDisplay = clientObj?.company_name || clientObj?.name || 'Client';

  // Metrics
  const metrics: MetricItem[] = [
    { label: 'TOTAL BILLED', value: fmt(invoice.total_amount, invoice.currency) },
    { label: 'COLLECTED', value: fmt(invoice.paid_amount || 0, invoice.currency), indicator: isPaid ? 'Settled' : undefined },
    { label: 'BALANCE DUE', value: fmt(invoice.balance_due, invoice.currency), isOrange: invoice.balance_due > 0 },
    { label: 'STATUS', value: pendingSubmission ? 'UNDER REVIEW' : derivedStatus.replace('_', ' ').toUpperCase() },
    { label: 'DUE DATE', value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Immediate' },
    { label: 'PAYMENTS', value: `${invoice.invoice_payments?.length || 0} Recorded` },
  ];

  // Payments list sorted newest first
  const paymentsList = [...(invoice.invoice_payments || [])].sort((a, b) => {
    const timeA = new Date(a.payment_date || a.created_at || 0).getTime();
    const timeB = new Date(b.payment_date || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return (
    <div className="flex-1 space-y-6 pb-16 font-sans select-none text-muted">
      
      {/* ── Page Header ── */}
      <div className="print:hidden">
        <PageHeader
          title={invoice.invoice_number}
          breadcrumbs={[
            { label: isClient ? 'My Invoices' : 'Invoices', href: '/invoices' },
            { label: invoice.invoice_number }
          ]}
          description={isClient ? `Issued by ${issuerName}` : `Issued to ${clientDisplay}`}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/invoices')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs transition-colors"
              >
                <ArrowLeft size={13} />
                <span>{isClient ? 'My Invoices' : 'Invoices'}</span>
              </button>

              {!isClient && canManageInvoices && (
                <button
                  onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-zinc-200 border border-divider text-xs font-medium transition-colors"
                  title="Open in Canva-style Invoice Studio"
                >
                  <Edit3 size={13} className="text-[#FF6B4A]" />
                  <span>Studio Editor</span>
                </button>
              )}

              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-zinc-200 border border-divider text-xs font-medium transition-colors"
              >
                <Download size={13} />
                <span>PDF Export</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-zinc-200 border border-divider text-xs font-medium transition-colors"
                title="Print invoice"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>


              {/* Client Action: Submit Payment Proof (Phase 3) */}
              {isClient && !isPaid && (
                pendingSubmission ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-medium">
                    <Clock size={13} />
                    <span>Payment Under Review</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsSubmitProofOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
                  >
                    <UploadCloud size={13} />
                    <span>Submit Payment Proof</span>
                  </button>
                )
              )}

              {canRecord && !isPaid && (
                <button
                  onClick={() => setIsPayModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
                >
                  <DollarSign size={13} />
                  <span>Record Payment</span>
                </button>
              )}

              {!isClient && canManageInvoices && (
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-medium transition-colors"
                  title="Delete invoice from database"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* ── Metric Strip ── */}
      <div className="print:hidden">
        <MetricStrip metrics={metrics} />
      </div>

      {/* ── Pending Verification Banner (Phase 3) ── */}
      {pendingSubmission && (
        <div className="print:hidden bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock size={16} />
            </div>
            <div>
              <span className="font-bold text-amber-300 font-mono text-sm block">Payment Proof Under Review</span>
              <p className="text-zinc-300 text-[11px] mt-0.5">
                Proof of <strong className="text-main">{fmt(pendingSubmission.amount, pendingSubmission.currency)}</strong> was submitted on {new Date(pendingSubmission.payment_date).toLocaleDateString()} via <span className="capitalize">{pendingSubmission.payment_method.replace('_', ' ')}</span> (Ref: <span className="font-mono text-main">{pendingSubmission.transaction_reference || 'N/A'}</span>). Our finance team is reviewing your settlement slip.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-semibold">
            Pending Staff Clearance
          </span>
        </div>
      )}

      {/* ── Rejection Banner (Phase 3) ── */}
      {!pendingSubmission && latestRejectedSubmission && invoice.balance_due > 0 && (
        <div className="print:hidden bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div>
              <span className="font-bold text-red-300 font-mono text-sm block">Previous Payment Proof Rejected</span>
              <p className="text-zinc-300 text-[11px] mt-0.5">
                Reason: <strong className="text-main">{latestRejectedSubmission.rejection_reason || 'Transaction could not be verified'}</strong>. Please verify your reference or re-upload a valid settlement slip.
              </p>
            </div>
          </div>
          {isClient && (
            <button
              onClick={() => setIsSubmitProofOpen(true)}
              className="px-3.5 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-colors shrink-0"
            >
              Re-submit Proof
            </button>
          )}
        </div>
      )}

      {/* ── Flow Motion Progress Strip ── */}
      <div className="print:hidden bg-card-bg border border-divider rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full max-w-xl">
          <FlowStepper
            steps={[
              { key: 'draft', label: 'Draft', subtitle: 'Prepared' },
              {
                key: 'sent',
                label: 'Issued & Active',
                subtitle: pendingSubmission
                  ? 'Payment Under Review'
                  : derivedStatus === 'overdue'
                  ? 'Payment Overdue'
                  : derivedStatus === 'partially_paid'
                  ? 'Partially Paid'
                  : 'Awaiting Payment'
              },
              { key: 'paid', label: 'Settled & Paid', subtitle: 'Reconciled' }
            ]}
            activeStepKey={isPaid ? 'paid' : 'sent'}
          />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted uppercase">Status:</span>
          {pendingSubmission ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
              <Clock size={11} />
              <span>UNDER REVIEW</span>
            </span>
          ) : (
            <StatusSignal status={derivedStatus} />
          )}
        </div>
      </div>

      {/* ── Printable / Visual Invoice Document Surface ── */}
      <div
        className="max-w-4xl mx-auto bg-card-bg border border-divider rounded-xl p-6 sm:p-10 space-y-8 text-xs print:border-none print:p-0 print:bg-white print:text-black shadow-lg"
        ref={invoiceRef}
      >
        
        {/* Top Invoice Header: Real Issuing Business */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-divider">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {issuerLogo ? (
                <img
                  src={issuerLogo}
                  alt={issuerName}
                  className="h-10 w-auto max-w-[140px] object-contain rounded"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
                  <Building size={18} />
                </div>
              )}
              <div>
                <h1 className="font-bold text-main text-base tracking-tight leading-tight">{issuerName}</h1>
                {issuerWebsite && (
                  <a
                    href={issuerWebsite.startsWith('http') ? issuerWebsite : `https://${issuerWebsite}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted text-[11px] hover:underline"
                  >
                    {issuerWebsite}
                  </a>
                )}
              </div>
            </div>
            
            <div className="text-muted text-[11px] leading-relaxed max-w-sm">
              {issuerAddress && <p>{issuerAddress}</p>}
              {issuerGst && <p className="font-mono text-[10px] text-zinc-400">GSTIN: {issuerGst}</p>}
              {issuerEmail && <p>{issuerEmail}</p>}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-2 shrink-0">
            <div>
              <span className="text-[10px] font-mono uppercase text-muted tracking-widest block">Tax Invoice</span>
              <span className="font-mono text-lg font-bold text-main tracking-tight block">{invoice.invoice_number}</span>
            </div>
            <div className="flex sm:justify-end">
              <StatusSignal status={derivedStatus} />
            </div>
          </div>
        </div>

        {/* Client & Billing Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-app/60 p-5 rounded-lg border border-divider">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
              Billed To
            </span>
            <span className="text-main font-bold text-sm block">
              {clientObj?.company_name || clientObj?.name || 'Client'}
            </span>
            {clientObj?.company_name && clientObj?.name && (
              <span className="text-muted text-xs block mt-0.5">{clientObj.name}</span>
            )}
            {clientObj?.email && <span className="text-muted text-[11px] block mt-0.5">{clientObj.email}</span>}
            {clientObj?.phone && <span className="text-muted text-[11px] block">{clientObj.phone}</span>}
            {clientObj?.address && (
              <span className="text-muted text-[11px] block mt-1 leading-relaxed">{clientObj.address}</span>
            )}
            {clientObj?.gst_number && (
              <span className="text-zinc-400 font-mono text-[10px] block mt-1">GSTIN: {clientObj.gst_number}</span>
            )}
          </div>

          <div className="sm:text-right space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between sm:justify-end gap-3">
              <span className="text-muted">Issue Date:</span>
              <span className="text-main font-semibold">
                {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="flex justify-between sm:justify-end gap-3">
              <span className="text-muted">Due Date:</span>
              <span className="text-main font-semibold">
                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Immediate'}
              </span>
            </div>
            <div className="flex justify-between sm:justify-end gap-3">
              <span className="text-muted">Currency:</span>
              <span className="text-main font-semibold">{invoice.currency}</span>
            </div>
            {invoice.bill_reference_id && (
              <div className="flex justify-between sm:justify-end gap-3">
                <span className="text-muted">Reference:</span>
                <span className="text-zinc-300 font-mono text-[10px]">{invoice.bill_reference_id}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-divider rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-app">
            <div className="col-span-6">Item & Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Rate</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {(invoice.invoice_items || []).length === 0 ? (
              <div className="py-6 text-center text-muted font-mono text-xs">No items listed on this invoice.</div>
            ) : (
              (invoice.invoice_items || []).map((it: any) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center font-mono tabular-nums text-xs hover:bg-white/[0.01]">
                  <div className="col-span-6 font-sans">
                    <span className="text-zinc-200 font-medium block">{it.description || 'Service item'}</span>
                    {it.hsn_code && <span className="text-[10px] font-mono text-muted">HSN: {it.hsn_code}</span>}
                  </div>
                  <div className="col-span-2 text-right text-muted">{it.quantity}</div>
                  <div className="col-span-2 text-right text-muted">{fmt(it.rate, invoice.currency)}</div>
                  <div className="col-span-2 text-right text-main font-semibold">
                    {fmt(it.amount || (it.quantity * it.rate), invoice.currency)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end pt-1">
          <div className="w-full sm:w-72 space-y-2 font-mono text-xs tabular-nums bg-app/70 p-4 rounded-lg border border-divider">
            <div className="flex justify-between text-muted">
              <span>Subtotal:</span>
              <span className="text-main">{fmt(invoice.subtotal, invoice.currency)}</span>
            </div>

            {Number(invoice.discount_amount || 0) > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount:</span>
                <span>-{fmt(invoice.discount_amount, invoice.currency)}</span>
              </div>
            )}

            {Number(invoice.cgst || 0) > 0 && (
              <div className="flex justify-between text-muted">
                <span>CGST:</span>
                <span className="text-main">{fmt(invoice.cgst, invoice.currency)}</span>
              </div>
            )}

            {Number(invoice.sgst || 0) > 0 && (
              <div className="flex justify-between text-muted">
                <span>SGST:</span>
                <span className="text-main">{fmt(invoice.sgst, invoice.currency)}</span>
              </div>
            )}

            {Number(invoice.igst || 0) > 0 && (
              <div className="flex justify-between text-muted">
                <span>IGST:</span>
                <span className="text-main">{fmt(invoice.igst, invoice.currency)}</span>
              </div>
            )}

            {!invoice.cgst && !invoice.sgst && !invoice.igst && Number(invoice.tax_amount || 0) > 0 && (
              <div className="flex justify-between text-muted">
                <span>Tax:</span>
                <span className="text-main">{fmt(invoice.tax_amount, invoice.currency)}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-divider text-sm font-bold text-main">
              <span>Total:</span>
              <span>{fmt(invoice.total_amount, invoice.currency)}</span>
            </div>

            <div className="flex justify-between text-xs font-bold text-emerald-400">
              <span>Paid to Date:</span>
              <span>{fmt(invoice.paid_amount || 0, invoice.currency)}</span>
            </div>

            <div className="flex justify-between pt-1 border-t border-divider text-xs font-bold text-[#FF6B4A]">
              <span>Balance Due:</span>
              <span>{fmt(invoice.balance_due, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* ── Saved Payment Instructions (Real Data Only - Zero Placeholders) ── */}
        {hasRemittance && (
          <div className="pt-4 border-t border-divider space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-main flex items-center gap-2">
              <CreditCard size={14} className="text-[#FF6B4A]" />
              <span>Remittance & Payment Instructions</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bank Details */}
              {hasBank && (
                <div className="bg-app/50 p-4 rounded-lg border border-divider space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-muted tracking-wider block">
                    Bank Transfer Details
                  </span>
                  {bankName && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Bank Name:</span>
                      <span className="text-main font-medium">{bankName}</span>
                    </div>
                  )}
                  {accountNumber && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Account Number:</span>
                      <div className="flex items-center gap-1.5 font-mono text-main font-semibold">
                        <span>{accountNumber}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(accountNumber, 'Account Number')}
                          className="text-muted hover:text-[#FF6B4A] transition-colors p-0.5"
                          title="Copy account number"
                        >
                          {copiedKey === 'Account Number' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {ifscCode && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">IFSC / SWIFT:</span>
                      <div className="flex items-center gap-1.5 font-mono text-main font-semibold">
                        <span>{ifscCode}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(ifscCode, 'IFSC Code')}
                          className="text-muted hover:text-[#FF6B4A] transition-colors p-0.5"
                          title="Copy IFSC"
                        >
                          {copiedKey === 'IFSC Code' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* UPI ID */}
              {hasUpi && (
                <div className="bg-app/50 p-4 rounded-lg border border-divider space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-muted tracking-wider block">
                    Instant UPI Clearance
                  </span>
                  <div className="flex items-center justify-between gap-2 p-2 rounded bg-card-bg border border-divider">
                    <span className="font-mono text-xs text-main font-semibold break-all">{upiId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(upiId, 'UPI ID')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FF6B4A]/10 hover:bg-[#FF6B4A]/20 text-[#FF6B4A] text-[11px] font-mono transition-colors shrink-0"
                    >
                      {copiedKey === 'UPI ID' ? (
                        <>
                          <Check size={11} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted">Use any UPI app (GPay, PhonePe, Paytm, BHIM) to settle.</p>
                </div>
              )}
            </div>

            {/* Notes & Payment Terms */}
            {(paymentTerms || customNotes) && (
              <div className="bg-app/30 p-3.5 rounded-lg border border-divider space-y-2 text-[11px]">
                {paymentTerms && (
                  <div>
                    <span className="font-mono font-bold text-[10px] uppercase text-muted block">Payment Terms</span>
                    <p className="text-zinc-300 leading-relaxed mt-0.5">{paymentTerms}</p>
                  </div>
                )}
                {customNotes && (
                  <div>
                    <span className="font-mono font-bold text-[10px] uppercase text-muted block">Notes</span>
                    <p className="text-muted leading-relaxed mt-0.5">{customNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Payment History Ledger (Read-Only Table) ── */}
      <div className="max-w-4xl mx-auto space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Payment History & Settlement Ledger</span>
          </h2>
          <span className="text-[10px] font-mono text-muted">
            {paymentsList.length} {paymentsList.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="bg-card-bg border border-divider rounded-lg overflow-hidden">
          {paymentsList.length === 0 ? (
            <div className="py-8 text-center text-muted font-mono text-xs">
              No payments have been recorded for this invoice yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-divider text-[10px] font-bold text-muted uppercase tracking-wider bg-app">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Method</th>
                    <th className="px-4 py-2.5">Reference ID</th>
                    <th className="px-4 py-2.5">Notes</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {paymentsList.map((pmt: any) => (
                    <tr key={pmt.id} className="hover:bg-hover transition-colors">
                      <td className="px-4 py-3 text-muted">
                        {pmt.payment_date || pmt.created_at
                          ? new Date(pmt.payment_date || pmt.created_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-200 capitalize font-sans">
                        {pmt.payment_method?.replace(/_/g, ' ') || 'Direct'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {pmt.transaction_reference ? (
                          <span className="bg-app px-2 py-0.5 rounded border border-divider text-[11px]">
                            {pmt.transaction_reference}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted font-sans text-[11px] max-w-xs truncate">
                        {pmt.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold tabular-nums">
                        {fmt(pmt.amount, pmt.currency || invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Check size={10} />
                          <span>Cleared</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal (Staff Only) */}
      {!isClient && isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h2 className="text-sm font-bold text-main uppercase tracking-wider font-mono flex items-center gap-2">
                <DollarSign size={15} className="text-[#FF6B4A]" />
                <span>Record Client Payment</span>
              </h2>
              <button onClick={() => setIsPayModalOpen(false)} className="text-muted hover:text-main">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Settlement Amount ({invoice.currency}) <span className="text-[#FF6B4A]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full bg-app border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                >
                  <option value="bank_transfer">Bank Wire / Transfer</option>
                  <option value="upi">UPI / Instant Clearing</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="stripe">Stripe</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Transaction / Reference ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-9982310"
                  value={txRef}
                  onChange={e => setTxRef(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional internal notes"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-3.5 py-1.5 bg-hover hover:bg-hover text-muted text-xs rounded border border-divider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recording || !payAmount}
                  className="px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm"
                >
                  {recording ? 'Recording...' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Invoice Modal (Staff Only) */}
      {!isClient && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          title="Delete Invoice"
          message={`Are you sure you want to permanently delete invoice ${invoice.invoice_number}? All line items and recorded payment logs will be deleted from the database.`}
          confirmText={deleting ? 'Deleting...' : 'Delete Invoice'}
          isDestructive={true}
          onConfirm={confirmDeleteInvoice}
          onCancel={() => setIsDeleteModalOpen(false)}
        />
      )}

      {/* Submit Payment Proof Modal (Client Only - Phase 3) */}
      {isClient && (
        <SubmitPaymentProofModal
          isOpen={isSubmitProofOpen}
          onClose={() => setIsSubmitProofOpen(false)}
          invoice={invoice}
          onSuccess={() => {
            fetchInvoice();
            fetchSubmissions();
          }}
        />
      )}

    </div>
  );
}
