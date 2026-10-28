import { useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface SignatureRibbonProps {
  onRibbonReachedMascot?: () => void;
  onFlourishComplete?: () => void;
  className?: string;
}

/**
 * Auvryn Signature Ribbon — The Auvryn Reveal
 *
 * 1. Draws a vibrant coral-orange line along an elegant architectural curve
 *    leading smoothly from the hero stage toward the Welcome Fox mascot.
 * 2. Ends neatly near the mascot's grounded foundation without crossing face,
 *    chest logo, headline, or buttons.
 * 3. Culminates in a warm highlight beacon glow at the endpoint.
 * 4. Settles completely static without looping.
 * 5. Runs once per page load and preserves state across re-renders.
 */
export default function AuvrynSignatureRibbon({
  onRibbonReachedMascot,
  onFlourishComplete,
  className = '',
}: SignatureRibbonProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    hasAnimatedRef.current = true;
  }, []);

  const skipAnimation = shouldReduceMotion || hasAnimatedRef.current;

  // Desktop Path (viewBox 0 0 1440 820):
  // Sweeps across the hero stage cleanly below trust badges and CTA buttons,
  // terminating neatly at the enlarged mascot's grounded pedestal (x: 1055, y: 735).
  // Strictly preserves character safety: never crosses the fox's face or body.
  const desktopLinePath = 'M 260 705 C 460 725, 680 690, 850 675 C 930 665, 995 680, 1055 735';
  const desktopGuidePath = 'M 300 725 C 495 745, 710 710, 875 695 C 950 685, 1010 700, 1070 755';

  // Mobile / Tablet Path (viewBox 0 0 390 720):
  // Sweeps beneath trust badges and terminates neatly at the enlarged mascot's pedestal,
  // strictly clear of text badges, fox face, and body.
  const mobileLinePath = 'M 25 520 C 95 535, 170 515, 230 525 C 255 530, 275 540, 290 555';
  const mobileGuidePath = 'M 40 538 C 105 552, 180 532, 240 542 C 265 547, 285 557, 300 570';

  return (
    <div
      className={`auvryn-signature-reveal-wrapper absolute top-0 left-0 right-0 h-[820px] pointer-events-none z-[15] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* ── DESKTOP SIGNATURE LINE (lg screens: >= 1024px) ── */}
      <svg
        className="hidden lg:block w-full h-full select-none"
        viewBox="0 0 1440 820"
        fill="none"
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          {/* Luminous coral-orange signature gradient */}
          <linearGradient id="auvryn-signature-coral" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF7A59" stopOpacity="0.25" />
            <stop offset="30%" stopColor="#FF5A36" stopOpacity="0.9" />
            <stop offset="75%" stopColor="#FF5A36" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFA07A" stopOpacity="1" />
          </linearGradient>

          {/* Warm endpoint ambient glow */}
          <radialGradient id="auvryn-endpoint-glow-desktop" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF5A36" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#FF7A59" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF5A36" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Secondary subtle architectural guide line */}
        <motion.path
          d={desktopGuidePath}
          stroke="#FFA07A"
          strokeWidth="1.2"
          strokeDasharray="4 4"
          fill="none"
          opacity="0.25"
          initial={skipAnimation ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.25, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Soft atmospheric glow underlay for primary signature line */}
        <motion.path
          d={desktopLinePath}
          stroke="#FF5A36"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          opacity="0.25"
          style={{ filter: 'blur(3.5px)' }}
          initial={skipAnimation ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.15, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Primary Coral-Orange Signature Line */}
        <motion.path
          d={desktopLinePath}
          stroke="url(#auvryn-signature-coral)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          initial={skipAnimation ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: 1.15,
            delay: 0.15,
            ease: [0.22, 1, 0.36, 1],
          }}
          onAnimationComplete={() => {
            onRibbonReachedMascot?.();
          }}
        />

        {/* ── DESKTOP SIGNATURE FOX (1.8x Enlarged) & GREETING AT LINE ENDPOINT (x: 1055, y: 715) ── */}
        <motion.g
          initial={skipAnimation ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            duration: 0.65,
            delay: 1.05,
            ease: [0.16, 1, 0.3, 1],
          }}
          onAnimationComplete={() => {
            onFlourishComplete?.();
          }}
        >
          {/* Subtle warm ambient backdrop behind mascot */}
          <radialGradient id="auvryn-mascot-ambient-desktop" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF5A36" stopOpacity="0.22" />
            <stop offset="60%" stopColor="#FF7A59" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#FF5A36" stopOpacity="0" />
          </radialGradient>
          <circle cx={1095} cy={640} r={130} fill="url(#auvryn-mascot-ambient-desktop)" />

          {/* Signature Welcome Fox Mascot (1.8x size: 250x265px) */}
          <image
            href="/cheerful-fox-mascot-presenter.png"
            x={970}
            y={510}
            width={250}
            height={265}
            preserveAspectRatio="xMidYMid meet"
            className="select-none pointer-events-none drop-shadow-[0_16px_36px_rgba(255,90,54,0.24)]"
          />

          {/* Welcoming Greeting Pill */}
          <foreignObject x={825} y={590} width={175} height={44}>
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-[#12121a]/95 border border-[#FF5A36]/40 shadow-xl text-xs font-bold text-slate-800 dark:text-slate-100 backdrop-blur-md whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Welcome to Auvryn!</span>
            </div>
          </foreignObject>
        </motion.g>
      </svg>

      {/* ── MOBILE / TABLET SIGNATURE LINE (< lg screens) ── */}
      <svg
        className="block lg:hidden w-full h-full select-none"
        viewBox="0 0 390 720"
        fill="none"
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <radialGradient id="auvryn-endpoint-glow-mobile" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF5A36" stopOpacity="0.22" />
            <stop offset="60%" stopColor="#FF7A59" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#FF5A36" stopOpacity="0" />
          </radialGradient>
        </defs>

        <motion.path
          d={mobileGuidePath}
          stroke="#FFA07A"
          strokeWidth="1.2"
          strokeDasharray="4 4"
          fill="none"
          opacity="0.22"
          initial={skipAnimation ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.15, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />

        <motion.path
          d={mobileLinePath}
          stroke="#FF5A36"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.2"
          style={{ filter: 'blur(3px)' }}
          initial={skipAnimation ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />

        <motion.path
          d={mobileLinePath}
          stroke="#FF5A36"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          initial={skipAnimation ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* ── MOBILE SIGNATURE FOX & GREETING AT LINE ENDPOINT (x: 290, y: 555) ── */}
        <motion.g
          initial={skipAnimation ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <circle cx={305} cy={500} r={55} fill="url(#auvryn-endpoint-glow-mobile)" />

          <image
            href="/cheerful-fox-mascot-presenter.png"
            x={255}
            y={445}
            width={110}
            height={117}
            preserveAspectRatio="xMidYMid meet"
            className="select-none pointer-events-none drop-shadow-[0_10px_24px_rgba(255,90,54,0.22)]"
          />

          <foreignObject x={110} y={465} width={140} height={36}>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 dark:bg-[#12121a]/95 border border-[#FF5A36]/40 shadow-md text-[10px] font-bold text-slate-800 dark:text-slate-100 backdrop-blur-sm whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Welcome to Auvryn!</span>
            </div>
          </foreignObject>
        </motion.g>
      </svg>
    </div>
  );
}
