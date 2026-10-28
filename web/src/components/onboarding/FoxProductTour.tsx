import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowLeft, X, Sparkles, CheckCircle2 } from 'lucide-react';
import AuvrynFoxMascot from '../motion/AuvrynFoxMascot';

export const FOX_TOUR_STORAGE_KEY = 'auvryn_fox_tour_v1_completed';

export function openFoxTour() {
  window.dispatchEvent(new CustomEvent('auvryn:open-fox-tour'));
}

interface TourStep {
  id: string;
  title: string;
  message: string;
  targetSelector?: string;
  badge?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Dashboard!',
    message: "Hello and welcome to Auvryn! I'm your productivity companion, here to help turn your ideas into continuous progress. Let me give you a quick orientation of your new command center.",
    badge: 'Dashboard Welcome',
  },
  {
    id: 'projects',
    targetSelector: 'a[href="/projects"]',
    title: 'Project Delivery Engine',
    message: 'Organize high-velocity initiatives, define delivery milestones, and track execution velocity across your projects from a unified command view.',
    badge: 'Workstreams',
  },
  {
    id: 'tasks',
    targetSelector: 'a[href="/tasks"]',
    title: 'Physical Tasks Pipeline',
    message: 'Move deliverables across state boundaries with our interactive Kanban board. Tasks don\'t sit still—they flow seamlessly from To Do to Verified in Production.',
    badge: 'Execution',
  },
  {
    id: 'meetings',
    targetSelector: 'a[href="/meetings"]',
    title: 'WebRTC Conferencing & Chat',
    message: 'Jump into encrypted 1080p multi-peer video meetings and team channels with sub-second latency and zero context loss.',
    badge: 'Collaboration',
  },
  {
    id: 'invoices',
    targetSelector: 'a[href="/invoices"]',
    title: 'Receivables & Rupee (₹) Ledger',
    message: 'Create tax-compliant line item invoices and monitor real-time settlement states from Draft to Sent to Paid with automatic ledger syncing.',
    badge: 'Finance',
  },
  {
    id: 'search',
    targetSelector: 'button[data-tour="search-trigger"]',
    title: 'Global Command Palette',
    message: 'Press Ctrl+K (or Cmd+K) from anywhere to instantly jump to initiatives, switch workspaces, or execute actions with zero friction.',
    badge: 'Navigation',
  },
  {
    id: 'complete',
    title: "You're All Set to Build Momentum!",
    message: 'Your workbench is ready. You can summon me anytime by clicking my avatar in the top navigation bar. Let’s make great things happen!',
    badge: 'Ready',
  },
];

export default function FoxProductTour() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // Automatic Trigger: strictly on the dashboard after sign up
  useEffect(() => {
    // Only ever trigger automatically when the user is on the dashboard
    if (location.pathname !== '/dashboard') {
      return;
    }

    try {
      const hasCompleted = localStorage.getItem(FOX_TOUR_STORAGE_KEY);
      if (hasCompleted) return;

      const justSignedUp =
        sessionStorage.getItem('auvryn_just_signed_up') === 'true' ||
        (location.state as any)?.fromSignUp ||
        !hasCompleted;

      // Automatically launch tour on dashboard for new sign-ups after short settling buffer
      if (justSignedUp && !shouldReduceMotion) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          sessionStorage.removeItem('auvryn_just_signed_up');
        }, 900);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors
    }
  }, [location.pathname, location.state, shouldReduceMotion]);

  // Listen for manual trigger (e.g. from Topbar help button)
  useEffect(() => {
    const handleOpen = () => {
      setCurrentStepIdx(0);
      setIsOpen(true);
    };
    window.addEventListener('auvryn:open-fox-tour', handleOpen);
    return () => window.removeEventListener('auvryn:open-fox-tour', handleOpen);
  }, []);

  const currentStep = TOUR_STEPS[currentStepIdx] || TOUR_STEPS[0];
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === TOUR_STEPS.length - 1;

  // Track target element position for spotlight
  const updateSpotlight = useCallback(() => {
    if (!currentStep.targetSelector) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      // Smoothly bring element into view if not visible
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep.targetSelector]);

  useEffect(() => {
    if (isOpen) {
      updateSpotlight();
      window.addEventListener('resize', updateSpotlight);
      return () => window.removeEventListener('resize', updateSpotlight);
    }
  }, [isOpen, updateSpotlight]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIdx((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(FOX_TOUR_STORAGE_KEY, 'true');
    } catch {
      // Fallback
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <aside aria-label="Auvryn Fox Onboarding Tour" className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
        {/* Backdrop Tint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleComplete}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Dynamic Element Spotlight Cutout */}
        {spotlightRect && (
          <motion.div
            layoutId="tour-spotlight"
            initial={false}
            animate={{
              top: spotlightRect.top - 6,
              left: spotlightRect.left - 6,
              width: spotlightRect.width + 12,
              height: spotlightRect.height + 12,
            }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute rounded-xl border-2 border-[#FF5A36] shadow-[0_0_24px_rgba(255,90,54,0.6)] pointer-events-none z-10"
          />
        )}

        {/* Tour Modal Card Featuring The Fox Guide */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 w-full max-w-lg mx-4 bg-surface border border-[#FF5A36]/40 rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_30px_rgba(255,90,54,0.2)] text-text overflow-hidden"
        >
          {/* Subtle warm orange top border highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF5A36] to-transparent" />

          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF5A36] animate-ping" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#FF5A36]">
                {currentStep.badge || 'Product Tour'}
              </span>
              <span className="text-xs text-muted font-mono">
                · {currentStepIdx + 1} of {TOUR_STEPS.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleComplete}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
              title="Close Tour"
            >
              <X size={16} />
            </button>
          </div>

          {/* Fox Companion & Contextual Speech */}
          <div className="py-2">
            <AuvrynFoxMascot
              variant="guide"
              speechText={currentStep.message}
            />
          </div>

          {/* Step Title & Progress Track */}
          <div className="mt-4 pt-3 border-t border-line space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                <span>{currentStep.title}</span>
                {isLastStep && <Sparkles size={16} className="text-[#FF5A36]" />}
              </h3>
            </div>

            {/* Progress Dots */}
            <div className="flex items-center gap-1.5 pt-1">
              {TOUR_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStepIdx
                      ? 'w-6 bg-[#FF5A36] shadow-[0_0_8px_#FF5A36]'
                      : idx < currentStepIdx
                      ? 'w-2 bg-[#FF5A36]/60'
                      : 'w-2 bg-line'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-between gap-3 pt-2">
            {/* Skip Option */}
            <button
              type="button"
              onClick={handleComplete}
              className="text-xs text-muted hover:text-text font-mono transition-colors cursor-pointer"
            >
              Skip Orientation
            </button>

            {/* Back & Next Navigation */}
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-line text-xs font-semibold text-text transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-[#FF5A36] hover:bg-[#E84E2C] text-xs font-bold text-white shadow-[0_0_18px_rgba(255,90,54,0.4)] hover:shadow-[0_0_24px_rgba(255,90,54,0.6)] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isLastStep ? 'Finish & Explore' : 'Next'}</span>
                {isLastStep ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        </motion.div>
      </aside>
    </AnimatePresence>
  );
}
