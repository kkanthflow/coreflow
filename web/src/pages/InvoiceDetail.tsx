import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import {
  ArrowLeft, Download, DollarSign, X, Trash2, Edit3
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from '../components/ui/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, StatusSignal, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import { FlowStepper } from '../components/ui/FlowMotion';

function fmt(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const canRecord = hasPermission(role, 'record_payments');
  const canManageInvoices = hasPermission(role, 'create_invoices') || hasPermission(role, 'edit_invoices') || role === 'owner' || role === 'administrator';

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [txRef, setTxRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [recording, setRecording] = useState(false);

  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteInvoice = async () => {
    if (!invoice?.id) return;
    try {
      setDeleting(true);
      // Hard delete dependent records and invoice from database
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

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients:client_id(name, company_name, email, phone, gst_number, address),
          invoice_items(*),
          invoice_payments(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setInvoice(data);
      if (data?.balance_due) {
        setPayAmount(String(data.balance_due));
      }
    } catch (e) {
      console.error('Error fetching invoice:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#07080B' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${invoice.invoice_number || 'invoice'}.pdf`);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
    }
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
          recorded_by: user.id,
          amount: amountNum,
          payment_method: payMethod,
          transaction_reference: txRef.trim() || null,
          notes: payNotes.trim() || null,
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
    } catch (e) {
      console.error('Payment record failed:', e);
    } finally {
      setRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20 font-sans select-none">
        <p className="text-muted text-xs">Invoice record not found.</p>
        <button onClick={() => navigate('/invoices')} className="mt-4 px-3.5 py-1.5 bg-[#FF6B4A] text-main rounded text-xs font-semibold">
          Return to Invoices
        </button>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';

  const metrics: MetricItem[] = [
    { label: 'TOTAL BILLED', value: fmt(invoice.total_amount, invoice.currency) },
    { label: 'COLLECTED', value: fmt(invoice.paid_amount || 0, invoice.currency), indicator: isPaid ? 'Settled' : undefined },
    { label: 'BALANCE DUE', value: fmt(invoice.balance_due, invoice.currency), isOrange: invoice.balance_due > 0 },
    { label: 'STATUS', value: invoice.status?.toUpperCase() || 'DRAFT' },
    { label: 'DUE DATE', value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Immediate' },
    { label: 'PAYMENTS', value: `${invoice.invoice_payments?.length || 0} Recorded` },
  ];

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title={invoice.invoice_number}
        breadcrumbs={[
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number }
        ]}
        description={`Issued to ${invoice.clients?.company_name || invoice.clients?.name || 'Client'}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/invoices')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Invoices</span>
            </button>
            <button
              onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-zinc-200 border border-divider text-xs font-medium transition-colors"
              title="Open in Canva-style Invoice Studio"
            >
              <Edit3 size={13} className="text-[#FF6B4A]" />
              <span>Studio Editor</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-zinc-200 border border-divider text-xs font-medium transition-colors"
            >
              <Download size={13} />
              <span>PDF Export</span>
            </button>
            {canRecord && !isPaid && (
              <button
                onClick={() => setIsPayModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
              >
                <DollarSign size={13} />
                <span>Record Payment</span>
              </button>
            )}
            {canManageInvoices && (
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

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Signature Animation: Invoice Flow Line Workflow ── */}
      <div className="bg-card-bg border border-divider rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full max-w-xl">
          <FlowStepper
            steps={[
              { key: 'draft', label: 'Draft', subtitle: 'Created' },
              { key: 'sent', label: 'Issued & Sent', subtitle: 'In Transit' },
              { key: 'paid', label: 'Settled & Paid', subtitle: 'Completed' }
            ]}
            activeStepKey={invoice.status === 'paid' ? 'paid' : invoice.status === 'draft' ? 'draft' : 'sent'}
          />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted">Status:</span>
          <StatusSignal status={invoice.status} />
        </div>
      </div>

      {/* ── Printable / Visual Invoice Document Surface ── */}
      <div className="max-w-4xl bg-card-bg border border-divider rounded-lg p-6 sm:p-8 space-y-6 text-xs" ref={invoiceRef}>
        
        {/* Top Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-divider">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-[2px] bg-[#FF6B4A]" />
              <span className="font-bold text-main text-sm">AUVRYN Operations</span>
            </div>
            <p className="text-muted font-mono text-[11px]">Enterprise Operating System</p>
          </div>

          <div className="text-right sm:text-right">
            <span className="font-mono text-base font-bold text-main block">{invoice.invoice_number}</span>
            <div className="mt-1">
              <StatusSignal status={invoice.status} />
            </div>
          </div>
        </div>

        {/* Client & Billing Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-app p-4 rounded border border-divider">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">Billed Client</span>
            <span className="text-main font-bold text-sm block">{invoice.clients?.company_name || invoice.clients?.name}</span>
            {invoice.clients?.company_name && invoice.clients?.name && (
              <span className="text-muted text-xs block">{invoice.clients.name}</span>
            )}
            {invoice.clients?.email && <span className="text-muted text-[11px] block">{invoice.clients.email}</span>}
            {invoice.clients?.gst_number && <span className="text-muted font-mono text-[10px] block">GST: {invoice.clients.gst_number}</span>}
          </div>

          <div className="sm:text-right space-y-1 font-mono text-[11px]">
            <div><span className="text-muted">Issue Date: </span><span className="text-main">{new Date(invoice.issue_date).toLocaleDateString()}</span></div>
            <div><span className="text-muted">Due Date: </span><span className="text-main">{new Date(invoice.due_date).toLocaleDateString()}</span></div>
            <div><span className="text-muted">Currency: </span><span className="text-main">{invoice.currency}</span></div>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-divider rounded overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-app">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Rate</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {(invoice.invoice_items || []).map((it: any) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center font-mono tabular-nums text-xs">
                <div className="col-span-6 font-sans text-zinc-200 font-medium">{it.description}</div>
                <div className="col-span-2 text-right text-muted">{it.quantity}</div>
                <div className="col-span-2 text-right text-muted">{fmt(it.rate, invoice.currency)}</div>
                <div className="col-span-2 text-right text-main font-semibold">{fmt(it.amount || (it.quantity * it.rate), invoice.currency)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end pt-2">
          <div className="w-64 space-y-1.5 font-mono text-xs tabular-nums bg-app p-3.5 rounded border border-divider">
            <div className="flex justify-between text-muted">
              <span>Subtotal:</span>
              <span className="text-main">{fmt(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Tax:</span>
              <span className="text-main">{fmt(invoice.tax_amount || 0, invoice.currency)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-divider text-xs font-bold text-main">
              <span>Total:</span>
              <span className="text-main">{fmt(invoice.total_amount, invoice.currency)}</span>
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

      </div>

      {/* Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h2 className="text-sm font-bold text-main uppercase tracking-wider font-mono flex items-center gap-2">
                <DollarSign size={15} className="text-[#FF6B4A]" />
                <span>Record Client Payment</span>
              </h2>
              <button onClick={() => setIsPayModalOpen(false)} className="text-muted hover:text-main">
                <X size={15} />
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

      {/* ── Delete Invoice Modal ── */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Invoice"
        message={`Are you sure you want to permanently delete invoice ${invoice.invoice_number}? All line items and recorded payment logs will be deleted from the database.`}
        confirmText={deleting ? 'Deleting...' : 'Delete Invoice'}
        isDestructive={true}
        onConfirm={confirmDeleteInvoice}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

    </div>
  );
}
