import { useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface AuvrynFoxMascotProps {
  variant?: 'hero' | 'guide' | 'badge' | 'compact';
  isAwakened?: boolean;
  className?: string;
  speechText?: string;
  onClick?: () => void;
}

/**
 * Auvryn Fox Mascot Component
 * Uses the exact uploaded image Cheerful Fox Mascot Presenter.png (/cheerful-fox-mascot-presenter.png).
 * Preserves character proportions, colors, cape, and chest logo.
 * Implements "The Auvryn Reveal":
 * - Soft reveal upward entrance on initial landing-page load
 * - Settles into permanent stillness without continuous movement, breathing, or bouncing
 * - Runs once per page load and preserves state across re-renders
 */
export default function AuvrynFoxMascot({
  variant = 'hero',
  isAwakened = true,
  className = '',
  speechText,
  onClick,
}: AuvrynFoxMascotProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasRevealedRef = useRef(false);

  const skipAnimation = shouldReduceMotion || hasRevealedRef.current;

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={`relative inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#FF5A36]/20 to-[#FFA07A]/10 border border-[#FF5A36]/30 ${className}`}
      >
        <img
          src="/cheerful-fox-mascot-presenter.png"
          alt="Auvryn Fox Mascot"
          className="w-full h-full object-cover object-top select-none pointer-events-none"
        />
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Auvryn Fox Guide"
        className={`group relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF5A36]/15 via-surface to-surface-2 border border-[#FF5A36]/30 hover:border-[#FF5A36] shadow-md hover:shadow-[0_0_16px_rgba(255,90,54,0.35)] transition-all cursor-pointer ${className}`}
      >
        <img
          src="/cheerful-fox-mascot-presenter.png"
          alt="Auvryn Fox Guide"
          className="w-8 h-8 object-contain select-none group-hover:scale-105 transition-transform"
        />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-bg animate-pulse" />
      </button>
    );
  }

  if (variant === 'guide') {
    return (
      <div className={`relative flex items-center gap-3 select-none ${className}`}>
        {/* Soft radiant companion glow */}
        <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-[#FF5A36]/20 to-transparent blur-xl pointer-events-none" />

        {/* Mascot Avatar */}
        <div className="relative w-28 sm:w-36 aspect-[1218/1292] shrink-0 flex items-center justify-center">
          <motion.img
            src="/cheerful-fox-mascot-presenter.png"
            alt="Auvryn Fox Guide"
            initial={shouldReduceMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full h-full object-contain drop-shadow-md pointer-events-none"
          />
        </div>

        {/* Contextual Speech Bubble */}
        {speechText && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, x: -8, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative flex-1 p-3.5 sm:p-4 rounded-2xl bg-surface border border-[#FF5A36]/30 shadow-xl text-left"
          >
            {/* Pointer notch pointing to fox */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-surface border-l border-b border-[#FF5A36]/30 transform rotate-45" />

            <div className="relative z-10 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider text-[#FF5A36] uppercase">
                  Auvryn Companion
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-xs sm:text-sm text-text font-medium leading-relaxed">
                {speechText}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // Default: Hero Variant (Full landing page signature appearance)
  return (
    <div className={`relative flex items-center justify-center lg:justify-end select-none ${className}`}>
      {/* Subtle radiant warmth behind companion */}
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#FF5A36]/12 via-[#FFA07A]/10 to-transparent blur-3xl pointer-events-none" />

      {/* Mascot Canvas with Soft Upward Reveal */}
      <motion.div
        initial={skipAnimation ? false : { opacity: 0, y: 20 }}
        animate={isAwakened ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        onAnimationComplete={() => {
          hasRevealedRef.current = true;
        }}
        className="hero-mascot-visual relative w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[500px] select-none"
      >
        <img
          src="/cheerful-fox-mascot-presenter.png"
          alt="Auvryn Cheerful Fox Mascot Presenter welcoming users to the productivity platform"
          className="w-full h-auto object-contain pointer-events-none drop-shadow-[0_12px_32px_rgba(255,90,54,0.18)]"
          width={1218}
          height={1292}
          loading="eager"
          fetchPriority="high"
        />
      </motion.div>
    </div>
  );
}
