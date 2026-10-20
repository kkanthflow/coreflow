import { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { initiateStandardCheckoutAndVerify, type RazorpayVerifyResult } from '../lib/razorpay';
import { useAuth } from '../hooks/useAuth';

export interface RazorpayStandardCheckoutButtonProps {
  amountInRupees?: number; // e.g. 500 for ₹500.00
  amountInPaise?: number;  // or direct paise: 50000
  receiptId?: string;
  description?: string;
  buttonText?: string;
  className?: string;
  onSuccess?: (verifyResult: RazorpayVerifyResult) => void;
  onError?: (error: any) => void;
}

export default function RazorpayStandardCheckoutButton({
  amountInRupees = 500,
  amountInPaise,
  receiptId,
  description = 'Standard Web Checkout Payment',
  buttonText,
  className = '',
  onSuccess,
  onError,
}: RazorpayStandardCheckoutButtonProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Compute amount in paise (minimum 100 paise = ₹1.00)
  const paise = amountInPaise ?? Math.max(100, Math.round(amountInRupees * 100));
  const displayRupees = Math.round(paise / 100);

  const handleCheckout = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      await initiateStandardCheckoutAndVerify({
        amountInPaise: paise,
        currency: 'INR',
        receipt: receiptId || `rcpt_${Date.now()}`,
        name: 'Auvryn',
        description,
        userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Auvryn Customer',
        userEmail: user?.email || '',
        onSuccess: (verifyResult: RazorpayVerifyResult) => {
          setLoading(false);
          setStatusMessage({
            type: 'success',
            text: `Payment of ₹${displayRupees} verified successfully! (ID: ${verifyResult.payment_id})`,
          });
          if (onSuccess) onSuccess(verifyResult);
        },
        onDismiss: () => {
          setLoading(false);
        },
        onError: (err: any) => {
          setLoading(false);
          const msg = err?.message || err?.description || 'Payment was unsuccessful or dismissed.';
          setStatusMessage({ type: 'error', text: msg });
          if (onError) onError(err);
        },
      });
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || 'Failed to initialize payment.';
      setStatusMessage({ type: 'error', text: msg });
      if (onError) onError(err);
    }
  };

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={handleCheckout}
        className={`px-5 py-2.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(255,107,74,0.3)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${className}`}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <CreditCard size={15} />
            <span>{buttonText || `Proceed with Payment (₹${displayRupees}) →`}</span>
          </>
        )}
      </button>

      {statusMessage && (
        <div
          className={`p-2.5 rounded-lg text-[11px] font-mono flex items-center gap-2 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={13} className="shrink-0" />
          ) : (
            <AlertCircle size={13} className="shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
