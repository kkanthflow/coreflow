import { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from '../ui/Toast';
import { paymentSubmissionApi } from '../../lib/paymentSubmissionApi';

interface SubmitPaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoice_number: string;
    balance_due: number;
    currency: string;
    total_amount: number;
  };
  onSuccess: () => void;
}

export default function SubmitPaymentProofModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}: SubmitPaymentProofModalProps) {
  const balanceDue = Number(invoice.balance_due || 0);

  const [amount, setAmount] = useState<string>(String(balanceDue));
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // Validate size (5MB max)
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFileError('File size exceeds the 5 MB limit. Please select a smaller file.');
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setFileError('Invalid file type. Only JPG, PNG, WEBP, or PDF receipts are accepted.');
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid payment amount greater than zero');
      return;
    }

    if (amountNum > balanceDue + 0.01) {
      toast.error(`Amount cannot exceed the balance due of ${invoice.currency} ${balanceDue.toFixed(2)}`);
      return;
    }

    if (['bank_transfer', 'upi'].includes(paymentMethod) && !transactionReference.trim()) {
      toast.error(`Transaction Reference / UTR is required for ${paymentMethod === 'upi' ? 'UPI' : 'Bank Transfer'}`);
      return;
    }

    if (!selectedFile) {
      setFileError('Please upload your receipt or proof of payment document (image or PDF)');
      return;
    }

    setSubmitting(true);
    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await paymentSubmissionApi.submitProof({
        invoice_id: invoice.id,
        amount: amountNum,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        transaction_reference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
        receipt_base64: base64Data,
        filename: selectedFile.name,
        mime_type: selectedFile.type,
      });

      toast.success('Payment proof submitted for review');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Submission failed:', err);
      toast.error(err.message || 'Failed to submit payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-card-bg border border-divider rounded-xl p-5 sm:p-6 shadow-2xl space-y-5 text-xs text-muted font-sans my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-divider">
          <div>
            <h2 className="text-sm font-bold text-main font-mono uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#FF6B4A]" />
              <span>Submit Payment Proof</span>
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              Invoice #{invoice.invoice_number} &bull; Outstanding Balance: <span className="text-main font-semibold font-mono">{invoice.currency} {balanceDue.toFixed(2)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded hover:bg-hover text-muted hover:text-main transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Amount & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                Settled Amount ({invoice.currency}) <span className="text-[#FF6B4A]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balanceDue}
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main font-mono focus:outline-none"
              />
              <span className="text-[10px] text-muted block mt-1">
                Max: {invoice.currency} {balanceDue.toFixed(2)}
              </span>
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                Payment Channel <span className="text-[#FF6B4A]">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-2.5 py-2 text-xs text-main focus:outline-none capitalize"
              >
                <option value="bank_transfer">Bank Wire / Transfer (NEFT/IMPS/RTGS)</option>
                <option value="upi">UPI / Instant Clearance</option>
                <option value="cash_cheque">Cash / Cheque</option>
                <option value="other">Other Manual Settlement</option>
              </select>
            </div>
          </div>

          {/* Date & Ref Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                Payment Date <span className="text-[#FF6B4A]">*</span>
              </label>
              <input
                type="date"
                required
                max={todayStr}
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                Transaction Ref / UTR / Receipt #{' '}
                {['bank_transfer', 'upi'].includes(paymentMethod) && (
                  <span className="text-[#FF6B4A]">*</span>
                )}
              </label>
              <input
                type="text"
                placeholder={paymentMethod === 'upi' ? 'e.g. UPI Ref / 12-digit UTR' : 'e.g. Bank Ref / TXN-99823'}
                value={transactionReference}
                onChange={e => setTransactionReference(e.target.value)}
                required={['bank_transfer', 'upi'].includes(paymentMethod)}
                className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
              Remarks / Submitter Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Paid via HDFC netbanking to corporate account"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none"
            />
          </div>

          {/* Receipt Upload Dropzone */}
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
              Receipt / Settlement Slip <span className="text-[#FF6B4A]">*</span>
            </label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] || null)}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-divider hover:border-[#FF6B4A]/40 bg-app/50'
              }`}
            >
              {selectedFile ? (
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-10 h-10 object-cover rounded border border-divider" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center shrink-0">
                        <FileText size={20} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-main font-semibold text-xs block truncate">{selectedFile.name}</span>
                      <span className="text-muted text-[10px] font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB &bull; {selectedFile.type || 'Document'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileChange(null);
                    }}
                    className="p-1 rounded hover:bg-hover text-muted hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 py-2">
                  <Upload size={22} className="mx-auto text-muted group-hover:text-main" />
                  <p className="text-xs text-main font-medium">Click to select receipt or drop file here</p>
                  <p className="text-[10px] text-muted">Supports JPG, PNG, WEBP, or PDF up to 5 MB</p>
                </div>
              )}
            </div>

            {fileError && (
              <div className="flex items-center gap-1.5 text-red-400 text-[11px] mt-1.5">
                <AlertCircle size={12} />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-divider">
            <span className="text-[10px] text-muted">
              Non-destructive: Invoice will enter "Under Review" status upon submission.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="px-3.5 py-1.5 bg-hover hover:bg-hover text-muted text-xs rounded border border-divider transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedFile}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit for Verification</span>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
