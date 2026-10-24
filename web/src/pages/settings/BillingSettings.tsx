import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Sparkles } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

export default function BillingSettings() {
  const navigate = useNavigate();
  const { canEditWorkspace } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-text">Customer Subscription & Quota Limits</h2>
          {!canEditWorkspace && (
            <span className="text-[10px] font-mono text-muted bg-surface-2 border border-line px-2 py-0.5 rounded">
              Read-only (Admin Required)
            </span>
          )}
        </div>
        <p className="text-xs text-muted mb-4">View your active workspace subscription, seats, and project limits.</p>

        <div className="p-5 rounded-2xl border border-line bg-surface-2/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shrink-0">
              <CreditCard size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-text flex items-center gap-2">
                <span>Free Tier</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent/15 text-accent border border-accent/25">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">Baseline plan quota active. Upgrade for custom limits.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/pricing')}
            className="w-full md:w-auto px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} />
            <span>Plans & Pricing →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
