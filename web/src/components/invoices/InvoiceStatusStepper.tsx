import { Check } from 'lucide-react';

export type InvoiceLifecycleStatus =
  | 'draft'
  | 'unpaid'
  | 'partially_paid'
  | 'overdue'
  | 'paid'
  | 'cancelled'
  | string;

export interface InvoiceStatusStepperProps {
  status: InvoiceLifecycleStatus;
  pendingSubmission?: boolean;
  className?: string;
}

interface StepItem {
  key: string;
  title: string;
  subtitle: string;
  state: 'completed' | 'current' | 'upcoming';
  variant: 'default' | 'success' | 'danger' | 'warning' | 'muted';
}

export default function InvoiceStatusStepper({
  status,
  pendingSubmission = false,
  className = '',
}: InvoiceStatusStepperProps) {
  const isPaid = status === 'paid';
  const isDraft = status === 'draft';
  const isCancelled = status === 'cancelled';
  const isOverdue = status === 'overdue';
  const isPartiallyPaid = status === 'partially_paid';

  // ── Step 0: Draft ──
  const step0State: StepItem['state'] = isDraft ? 'current' : 'completed';
  const step0Subtitle = isDraft ? 'Drafting' : 'Prepared';
  const step0Variant: StepItem['variant'] = isCancelled
    ? 'muted'
    : isDraft
    ? 'default'
    : 'success';

  // ── Step 1: Issued & Active ──
  let step1State: StepItem['state'] = 'upcoming';
  let step1Title = 'Issued & Active';
  let step1Subtitle = 'Pending';
  let step1Variant: StepItem['variant'] = 'default';

  if (isCancelled) {
    step1State = 'current';
    step1Title = 'Issued & Active';
    step1Subtitle = 'Cancelled';
    step1Variant = 'muted';
  } else if (isDraft) {
    step1State = 'upcoming';
    step1Title = 'Issued & Active';
    step1Subtitle = 'Pending';
    step1Variant = 'muted';
  } else if (isPaid) {
    step1State = 'completed';
    step1Title = 'Issued & Active';
    step1Subtitle = 'Issued';
    step1Variant = 'success';
  } else {
    // Current active step (unpaid / sent / overdue / partially_paid)
    step1State = 'current';
    step1Title = 'Issued & Active';
    if (pendingSubmission) {
      step1Subtitle = 'Payment Under Review';
      step1Variant = 'warning';
    } else if (isOverdue) {
      step1Subtitle = 'Payment Overdue';
      step1Variant = 'danger';
    } else if (isPartiallyPaid) {
      step1Subtitle = 'Partially Paid';
      step1Variant = 'default';
    } else {
      step1Subtitle = 'Awaiting Payment';
      step1Variant = 'default';
    }
  }

  // ── Step 2: Settled & Paid ──
  let step2State: StepItem['state'] = 'upcoming';
  let step2Subtitle = 'Pending';
  let step2Variant: StepItem['variant'] = 'muted';

  if (isPaid) {
    step2State = 'current'; // Current terminal reached state
    step2Subtitle = 'Reconciled';
    step2Variant = 'success';
  } else if (isCancelled) {
    step2State = 'upcoming';
    step2Subtitle = 'Void';
    step2Variant = 'muted';
  } else {
    step2State = 'upcoming';
    step2Subtitle = 'Pending';
    step2Variant = 'muted';
  }

  const steps: StepItem[] = [
    {
      key: 'draft',
      title: 'Draft',
      subtitle: step0Subtitle,
      state: step0State,
      variant: step0Variant,
    },
    {
      key: 'issued',
      title: step1Title,
      subtitle: step1Subtitle,
      state: step1State,
      variant: step1Variant,
    },
    {
      key: 'settled',
      title: 'Settled & Paid',
      subtitle: step2Subtitle,
      state: step2State,
      variant: step2Variant,
    },
  ];

  // Connector between step 0 and 1: completed if draft is done and not cancelled
  const connector0Completed = !isDraft && !isCancelled;
  // Connector between step 1 and 2: completed if paid
  const connector1Completed = isPaid;

  return (
    <nav aria-label="Invoice Status" className={`w-full ${className}`}>
      <ol className="flex items-start w-full relative">
        {steps.map((step, idx) => {
          const isCompleted = step.state === 'completed' || (isPaid && idx === 2);
          const isCurrent = step.state === 'current';
          const isUpcoming = step.state === 'upcoming';
          const connectorCompleted = idx === 0 ? connector0Completed : connector1Completed;

          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex-1 min-w-0 relative flex flex-col items-center text-center px-1"
            >
              {/* Screen reader state announcement */}
              <span className="sr-only">
                {isCompleted ? 'Completed' : isCurrent ? 'Current step' : 'Upcoming'}: {step.title} — {step.subtitle}
              </span>

              {/* Inter-step Connector Line (ONLY between steps, never after the last step) */}
              {idx < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`absolute top-3.5 left-1/2 w-full h-[2px] -translate-y-1/2 z-0 pointer-events-none transition-colors duration-200 ${
                    connectorCompleted ? 'bg-emerald-500' : 'bg-divider'
                  }`}
                />
              )}

              {/* Step Node Circle (28px x 28px, 14px center aligns with top-3.5 line) */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center bg-card-bg select-none transition-all duration-200 ${
                  isCompleted
                    ? 'ring-2 ring-emerald-500 text-emerald-500 shadow-none'
                    : isCurrent
                    ? step.variant === 'success'
                      ? 'ring-2 ring-emerald-500 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                      : step.variant === 'danger'
                      ? 'ring-2 ring-red-500 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                      : step.variant === 'warning'
                      ? 'ring-2 ring-amber-500 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                      : step.variant === 'muted'
                      ? 'ring-2 ring-zinc-500 text-zinc-500 shadow-none'
                      : 'ring-2 ring-accent text-accent shadow-[0_0_8px_var(--accent-soft)]'
                    : 'ring-[1.5px] ring-divider text-muted shadow-none'
                }`}
              >
                {isCompleted ? (
                  <Check size={13} className="stroke-[2.5]" />
                ) : isCurrent ? (
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      step.variant === 'success'
                        ? 'bg-emerald-500'
                        : step.variant === 'danger'
                        ? 'bg-red-500'
                        : step.variant === 'warning'
                        ? 'bg-amber-500'
                        : step.variant === 'muted'
                        ? 'bg-zinc-500'
                        : 'bg-accent'
                    }`}
                  />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-divider" />
                )}
              </div>

              {/* Step Title: 11-12px, uppercase, monospace, letter-spacing 0.06em, full-contrast */}
              <span
                className={`text-[11px] sm:text-[12px] font-mono font-bold uppercase tracking-[0.06em] mt-2.5 text-center leading-tight transition-colors break-words max-w-full px-1 ${
                  isUpcoming ? 'text-muted' : 'text-main'
                }`}
              >
                {step.title}
              </span>

              {/* Step Subtitle: 11px font-mono, WCAG AA compliant contrast */}
              <span
                className={`text-[11px] font-mono mt-1 text-center leading-tight transition-colors break-words max-w-full px-0.5 ${
                  step.variant === 'danger' && isCurrent
                    ? 'text-red-600 dark:text-red-400 font-semibold'
                    : step.variant === 'warning' && isCurrent
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : step.variant === 'success' && isCurrent
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : isCurrent && step.variant === 'default'
                    ? 'text-accent font-medium'
                    : 'text-zinc-600 dark:text-zinc-400 font-normal'
                }`}
              >
                {step.subtitle}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
