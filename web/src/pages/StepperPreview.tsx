import { useState } from 'react';
import InvoiceStatusStepper from '../components/invoices/InvoiceStatusStepper';
import { StatusSignal } from '../components/ui/ObsidianPrimitives';

const STATUSES = ['draft', 'unpaid', 'overdue', 'paid', 'cancelled'] as const;

export default function StepperPreview() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  };

  return (
    <div className={`min-h-screen p-4 sm:p-8 bg-app text-main ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-mono">Invoice Status Stepper Preview</h1>
          <button
            onClick={toggleTheme}
            id="toggle-theme-btn"
            className="px-3 py-1.5 rounded-lg border border-divider text-xs font-mono bg-card-bg hover:bg-hover transition-colors"
          >
            Mode: {theme.toUpperCase()}
          </button>
        </div>

        <div className="space-y-6">
          {STATUSES.map((st) => (
            <div key={st} className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
                Status: {st}
              </div>
              <div
                id={`stepper-card-${st}`}
                className="bg-card-bg border border-divider rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 md:gap-6 shadow-sm"
              >
                <div className="flex-1 w-full min-w-0">
                  <InvoiceStatusStepper status={st} />
                </div>
                <div className="shrink-0 flex items-center gap-3 pt-3.5 md:pt-0 border-t md:border-t-0 md:border-l border-divider md:pl-6 w-full md:w-auto justify-between md:justify-start">
                  <span className="text-[10px] font-mono text-muted uppercase tracking-wider font-semibold">
                    Status:
                  </span>
                  <StatusSignal status={st} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
