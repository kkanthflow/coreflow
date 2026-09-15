import React, { useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASINGS } from '../../lib/motionSystem';

// ── 1. Flow Line & Flow Node (AUVRYN Signature) ──────────────────────────
export interface FlowLineProps {
  progress: number; // 0 to 100
  color?: string;
  height?: number;
  showNode?: boolean;
  nodeSize?: number; // 4 - 7px
  className?: string;
  glow?: boolean;
}

export function FlowLine({
  progress,
  color = '#FF6B4A',
  height = 2.5,
  showNode = true,
  nodeSize = 6,
  className = '',
  glow = true,
}: FlowLineProps) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      className={`w-full bg-white/[0.1] rounded-full overflow-visible relative flex items-center ${className}`}
      style={{ height: `${height}px` }}
    >
      {/* Active Trajectory Fill */}
      <motion.div
        initial={shouldReduceMotion ? { width: `${clamped}%` } : { width: '0%' }}
        animate={{ width: `${clamped}%` }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.5,
          ease: EASINGS.precision,
        }}
        className="h-full rounded-full relative"
        style={{
          backgroundColor: color,
          boxShadow: glow ? `0 0 10px ${color}, 0 0 18px ${color}88` : 'none',
        }}
      >
        {/* Flow Node at trajectory tip */}
        {showNode && clamped > 0 && (
          <motion.div
            initial={shouldReduceMotion ? { scale: 1 } : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{
              width: `${nodeSize}px`,
              height: `${nodeSize}px`,
              transform: 'translate(50%, -50%)',
              boxShadow: `0 0 8px #ffffff, 0 0 14px ${color}, 0 0 22px ${color}`,
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ── 2. Flow Stepper (Stage-based Process Workflow) ──────────────────────────
export interface StepItem {
  key: string;
  label: string;
  subtitle?: string;
}

export interface FlowStepperProps {
  steps: StepItem[];
  activeStepKey: string;
  color?: string;
  className?: string;
  onStepClick?: (stepKey: string) => void;
}

export function FlowStepper({
  steps,
  activeStepKey,
  color = '#FF6B4A',
  className = '',
  onStepClick,
}: FlowStepperProps) {
  const shouldReduceMotion = useReducedMotion();
  const activeIdx = steps.findIndex((s) => s.key === activeStepKey);
  const safeIdx = activeIdx >= 0 ? activeIdx : 0;
  const progressPercent = steps.length > 1 ? (safeIdx / (steps.length - 1)) * 100 : 0;

  return (
    <div className={`w-full py-2 relative ${className}`}>
      {/* Background Track */}
      <div className="absolute top-[17px] left-3 right-3 h-[2px] bg-white/[0.08] -translate-y-1/2" />

      {/* Dynamic Traveling Flow Line */}
      <div className="absolute top-[17px] left-3 right-3 h-[2px] -translate-y-1/2 overflow-visible pointer-events-none">
        <motion.div
          className="h-full relative rounded-full"
          style={{ backgroundColor: color }}
          initial={shouldReduceMotion ? { width: `${progressPercent}%` } : { width: '0%' }}
          animate={{ width: `${progressPercent}%` }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.45,
            ease: EASINGS.precision,
          }}
        >
          {/* Active Flow Node traveling */}
          <div
            className="absolute right-0 top-1/2 rounded-full bg-white shadow-sm"
            style={{
              width: '7px',
              height: '7px',
              transform: 'translate(50%, -50%)',
              boxShadow: `0 0 8px ${color}, 0 0 14px ${color}99`,
            }}
          />
        </motion.div>
      </div>

      {/* Nodes & Labels */}
      <div className="relative z-10 flex items-start justify-between">
        {steps.map((step, idx) => {
          const isPassed = idx <= safeIdx;
          const isCurrent = idx === safeIdx;

          return (
            <div
              key={step.key}
              onClick={() => onStepClick && onStepClick(step.key)}
              className={`flex flex-col items-center group ${
                onStepClick ? 'cursor-pointer' : ''
              }`}
            >
              {/* Step Node Dot */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isCurrent
                    ? 'bg-[#08090D] border-2 border-[#FF6B4A] text-[#FF6B4A] shadow-[0_0_12px_rgba(255,107,74,0.35)] scale-105'
                    : isPassed
                    ? 'bg-[#0E1016] border border-[#FF6B4A]/60 text-white'
                    : 'bg-[#08090D] border border-white/[0.1] text-zinc-600'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isCurrent
                      ? 'bg-[#FF6B4A]'
                      : isPassed
                      ? 'bg-[#FF6B4A]/80'
                      : 'bg-zinc-600'
                  }`}
                />
              </div>

              {/* Step Label */}
              <span
                className={`text-[10px] font-mono font-semibold tracking-wider uppercase mt-1.5 transition-colors ${
                  isCurrent
                    ? 'text-white'
                    : isPassed
                    ? 'text-zinc-300'
                    : 'text-zinc-600'
                }`}
              >
                {step.label}
              </span>
              {step.subtitle && (
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">
                  {step.subtitle}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 3. Animated Number (Tabular Digital Morphing) ───────────────────────────
export function AnimatedNumber({
  value,
  formatter,
  className = '',
}: {
  value: number | string;
  formatter?: (val: number | string) => string;
  className?: string;
}) {
  const displayVal = formatter ? formatter(value) : String(value);

  return (
    <motion.span
      key={String(value)}
      initial={{ opacity: 0.85, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASINGS.precision }}
      className={`inline-block tabular-nums ${className}`}
    >
      {displayVal}
    </motion.span>
  );
}

// ── 4. Magnetic Surface (Reserved for Primary Actions) ──────────────────────
export function MagneticSurface({
  children,
  className = '',
  strength = 3,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const shouldReduceMotion = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = ((e.clientX - (left + width / 2)) / (width / 2)) * strength;
    const y = ((e.clientY - (top + height / 2)) / (height / 2)) * strength;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      animate={shouldReduceMotion ? {} : { x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ── 5. Realtime Highlight (Restrained 700ms Glow) ───────────────────────────
export function RealtimeHighlight({
  children,
  triggerKey,
  accentColor = '#FF6B4A',
  className = '',
}: {
  children: React.ReactNode;
  triggerKey: any;
  accentColor?: string;
  className?: string;
}) {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setIsHighlighted(true);
    const timer = setTimeout(() => setIsHighlighted(false), 750);
    return () => clearTimeout(timer);
  }, [triggerKey]);

  return (
    <div
      className={`transition-colors duration-700 rounded-lg ${
        isHighlighted
          ? `ring-1 ring-[${accentColor}]/40 bg-[${accentColor}]/[0.04]`
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ── 6. LIVE Pulse Indicator ────────────────────────────────────────────────
export function LiveIndicator({
  label = 'LIVE',
  color = '#FF6B4A',
  className = '',
}: {
  label?: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#FF6B4A]/10 border border-[#FF6B4A]/25 text-[#FF6B4A] select-none ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: color }}
        />
      </span>
      <span>{label}</span>
    </span>
  );
}

// ── 7. Task Completion Signature (Line Sweep & Morph) ──────────────────────
export function TaskCompletionSweep({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0.9 }}
      animate={{ scaleX: 1, opacity: [0.9, 1, 0] }}
      transition={{
        duration: shouldReduceMotion ? 0.1 : 0.45,
        ease: EASINGS.precision,
      }}
      onAnimationComplete={onComplete}
      className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF6B4A] to-emerald-400 origin-left pointer-events-none z-20"
      style={{
        boxShadow: '0 0 10px rgba(255,107,74,0.6)',
      }}
    />
  );
}
