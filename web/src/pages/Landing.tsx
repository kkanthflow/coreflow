import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  Lock,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Video,
  DollarSign,
  TrendingUp,
  Mic,
  Monitor,
  LayoutDashboard
} from 'lucide-react';
import AuvrynLogo from '../components/AuvrynLogo';

gsap.registerPlugin(ScrollTrigger);

export default function Landing() {
  const { session, user } = useAuth();
  const isAuthenticated = Boolean(session?.user?.id || user?.id);
  const shouldReduceMotion = useReducedMotion();

  // Root container refs
  const landingRef = useRef<HTMLDivElement>(null);
  const heroUiRef = useRef<HTMLDivElement>(null);
  const projectsPinRef = useRef<HTMLDivElement>(null);
  const tasksPinRef = useRef<HTMLDivElement>(null);
  const chatMeetingPinRef = useRef<HTMLDivElement>(null);
  const financePinRef = useRef<HTMLDivElement>(null);
  const analyticsPinRef = useRef<HTMLDivElement>(null);
  const finalRevealRef = useRef<HTMLDivElement>(null);

  // Dynamic interactive states
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [analyticsHoverIndex, setAnalyticsHoverIndex] = useState<number | null>(4);

  // Projects live state during scroll
  const [projectProgress, setProjectProgress] = useState(14);
  const [activeMilestone, setActiveMilestone] = useState(0);

  // Task column positions
  const [taskACol, setTaskACol] = useState<'todo' | 'inprogress' | 'review' | 'done'>('todo');
  const [taskBCol, setTaskBCol] = useState<'todo' | 'inprogress' | 'review' | 'done'>('inprogress');
  const [taskCCol, setTaskCCol] = useState<'todo' | 'inprogress' | 'review' | 'done'>('review');

  // Chat message & meeting transformation
  const [chatStep, setChatStep] = useState(0); // 0: typed, 1: sent/encrypt, 2: received, 3: expand meeting, 4: screen share
  
  // Finance invoice state
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [invoiceState, setInvoiceState] = useState<'Draft' | 'Sent' | 'Paid'>('Draft');

  // Interactive mouse tracking
  const handlePointerMove = (e: React.PointerEvent) => {
    const x = Math.round((e.clientX / window.innerWidth) * 100);
    const y = Math.round((e.clientY / window.innerHeight) * 100);
    setMousePos({ x, y });
  };

  useEffect(() => {
    if (shouldReduceMotion) return;

    const ctx = gsap.context(() => {
      // ── 1. HERO ENTRANCE SEQUENCE (Immediate 0–1500ms) ──
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroTl
        .fromTo('.hero-core-node', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45 })
        .fromTo('.hero-flow-line', { scaleX: 0 }, { scaleX: 1, duration: 0.6, transformOrigin: 'center' }, '-=0.2')
        .fromTo('.hero-badge', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, '-=0.3')
        .fromTo('.hero-headline-word-1', { x: -35, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55 }, '-=0.2')
        .fromTo('.hero-headline-word-2', { x: 35, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55 }, '-=0.45')
        .fromTo('.hero-subtext', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.3')
        .fromTo('.hero-cta-group', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, '-=0.3')
        .fromTo('.hero-ui-sidebar', { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6 }, '-=0.2')
        .fromTo('.hero-ui-header', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.5')
        .fromTo('.hero-ui-pulse', { scaleX: 0 }, { scaleX: 1, duration: 0.7, transformOrigin: 'left' }, '-=0.4')
        .fromTo('.hero-ui-cards', { y: 30, opacity: 0, stagger: 0.08 }, { y: 0, opacity: 1, duration: 0.6 }, '-=0.5');

      // ── 2. PROJECTS SCROLLTRIGGER PIN & TRAJECTORY ACCELERATION ──
      if (projectsPinRef.current) {
        ScrollTrigger.create({
          trigger: projectsPinRef.current,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
          onUpdate: (self) => {
            const p = Math.round(self.progress * 100);
            setProjectProgress(Math.max(14, p));
            if (p < 30) setActiveMilestone(0);
            else if (p < 60) setActiveMilestone(1);
            else if (p < 85) setActiveMilestone(2);
            else setActiveMilestone(3);
          }
        });
      }

      // ── 3. TASKS KANBAN PHYSICAL CARD MIGRATION ──
      if (tasksPinRef.current) {
        ScrollTrigger.create({
          trigger: tasksPinRef.current,
          start: 'top top',
          end: '+=140%',
          pin: true,
          scrub: 0.5,
          onUpdate: (self) => {
            const p = self.progress;
            if (p < 0.33) {
              setTaskACol('todo');
              setTaskBCol('inprogress');
              setTaskCCol('review');
            } else if (p < 0.66) {
              setTaskACol('inprogress');
              setTaskBCol('review');
              setTaskCCol('done');
            } else {
              setTaskACol('done');
              setTaskBCol('done');
              setTaskCCol('done');
            }
          }
        });
      }

      // ── 4. CHAT → ENCRYPTED STREAM → WEBRTC MEETING CONVERSION ──
      if (chatMeetingPinRef.current) {
        ScrollTrigger.create({
          trigger: chatMeetingPinRef.current,
          start: 'top top',
          end: '+=160%',
          pin: true,
          scrub: 0.6,
          onUpdate: (self) => {
            const p = self.progress;
            if (p < 0.25) setChatStep(0);
            else if (p < 0.5) setChatStep(1);
            else if (p < 0.75) setChatStep(2);
            else if (p < 0.9) setChatStep(3);
            else setChatStep(4);
          }
        });
      }

      // ── 5. FINANCE INVOICE REVENUE & LEDGER CONSTRUCTION ──
      if (financePinRef.current) {
        ScrollTrigger.create({
          trigger: financePinRef.current,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.5,
          onUpdate: (self) => {
            const p = self.progress;
            const targetAmt = Math.round(p * 48300);
            setInvoiceAmount(targetAmt);
            if (p < 0.35) setInvoiceState('Draft');
            else if (p < 0.75) setInvoiceState('Sent');
            else setInvoiceState('Paid');
          }
        });
      }

      // ── 6. ANALYTICS MORPHING VELOCITY GRAPH ──
      if (analyticsPinRef.current) {
        ScrollTrigger.create({
          trigger: analyticsPinRef.current,
          start: 'top top',
          end: '+=120%',
          pin: true,
          scrub: 0.6,
        });
      }

      // ── 7. FINAL ECOSYSTEM CONVERGENCE ──
      if (finalRevealRef.current) {
        gsap.fromTo(
          '.ecosystem-node',
          { scale: 0.7, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: finalRevealRef.current,
              start: 'top 80%',
              end: 'bottom bottom',
              scrub: 1,
            }
          }
        );
      }

    }, landingRef);

    return () => ctx.revert();
  }, [shouldReduceMotion]);

  const analyticsPoints = [
    { label: 'Jan', val: 12000, h: '25%' },
    { label: 'Feb', val: 19500, h: '40%' },
    { label: 'Mar', val: 28400, h: '58%' },
    { label: 'Apr', val: 36200, h: '72%' },
    { label: 'May', val: 48300, h: '94%' },
  ];

  return (
    <div
      ref={landingRef}
      onPointerMove={handlePointerMove}
      className="min-h-screen w-full bg-[#060709] text-white selection:bg-[#FF6B4A]/30 selection:text-white font-sans antialiased overflow-x-hidden relative"
    >
      {/* ── LIVING AMBIENT ATMOSPHERIC BACKGROUND ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: `radial-gradient(850px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 107, 74, 0.08), transparent 75%)`,
          }}
        />
        <div className="absolute -top-[15%] left-[20%] w-[700px] h-[700px] rounded-full bg-gradient-to-br from-[#FF6B4A]/[0.08] to-transparent blur-[140px] animate-pulse-glow" />
        <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-blue-600/[0.05] to-transparent blur-[120px]" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* ── FLOATING TOPBAR NAVIGATION ── */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-4 sm:px-6">
        <nav className="bg-[#0C0D12]/95 backdrop-blur-xl border border-white/[0.08] rounded-full px-5 sm:px-7 py-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-7 h-7 rounded-lg bg-[#141622] border border-[#FF6B4A]/40 flex items-center justify-center text-[#FF6B4A] shadow-[0_0_10px_rgba(255,107,74,0.3)]">
              <AuvrynLogo size={15} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-xs tracking-wider uppercase font-mono text-white">AUVRYN</span>
              <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">OS</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-7 text-xs font-mono text-zinc-400">
            <a href="#projects" className="hover:text-white transition-colors">Projects</a>
            <a href="#tasks" className="hover:text-white transition-colors">Tasks</a>
            <a href="#chat" className="hover:text-white transition-colors">Conferencing</a>
            <a href="#finance" className="hover:text-white transition-colors">Ledger & Billing</a>
            <a href="#analytics" className="hover:text-white transition-colors">Telemetry</a>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="text-xs font-semibold px-4 py-1.5 rounded-full bg-[#FF6B4A] hover:bg-[#FF552B] text-white transition-all shadow-[0_0_14px_rgba(255,107,74,0.35)] flex items-center gap-1.5"
              >
                <LayoutDashboard size={13} />
                <span>Go to Dashboard</span>
                <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/[0.05] transition-all font-mono"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-xs font-semibold px-4 py-1.5 rounded-full bg-[#FF6B4A] hover:bg-[#FF552B] text-white transition-all shadow-[0_0_14px_rgba(255,107,74,0.35)] flex items-center gap-1.5"
                >
                  <span>Get Started</span>
                  <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 1: HERO ASSEMBLY & AUVRYN ACTIVATION ────────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 min-h-screen pt-32 pb-20 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col items-center justify-center text-center">
        
        {/* Core Signal & Drawing Beam */}
        <div className="relative mb-6 flex flex-col items-center">
          <div className="hero-core-node w-3 h-3 rounded-full bg-white shadow-[0_0_12px_#ffffff,0_0_24px_#FF6B4A]" />
          <div className="hero-flow-line w-48 h-[2px] bg-gradient-to-r from-transparent via-[#FF6B4A] to-transparent mt-2 shadow-[0_0_10px_rgba(255,107,74,0.8)]" />
        </div>

        {/* Operating System Badge */}
        <div className="hero-badge inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0C0D12] border border-white/[0.08] text-[11px] font-mono text-zinc-400 mb-6 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A] animate-pulse" />
          <span className="text-white font-bold tracking-wider uppercase">Executive Command</span>
          <span className="text-zinc-600">/</span>
          <span>Delivery Governance</span>
        </div>

        {/* Physical Headline Assembly */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] max-w-4xl text-white mb-6">
          <span className="hero-headline-word-1 inline-block mr-3">One system.</span>
          <span className="hero-headline-word-2 inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B4A] via-[#FF8E75] to-white">
            Unbroken flow.
          </span>
        </h1>

        <p className="hero-subtext text-xs sm:text-sm md:text-base text-zinc-400 max-w-2xl leading-relaxed mb-8">
          A unified operating workbench for projects, real-time messaging, WebRTC video conferences, CRM accounts, and financial receivables.
        </p>

        {/* Primary Action Group */}
        <div className="hero-cta-group flex flex-col sm:flex-row items-center gap-4 mb-16">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(255,107,74,0.4)] flex items-center justify-center gap-2 group"
              >
                <LayoutDashboard size={15} />
                <span>Go to Dashboard</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/projects"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#0C0D12] hover:bg-[#12141C] border border-white/[0.08] text-zinc-300 hover:text-white font-mono text-xs transition-colors flex items-center justify-center gap-2"
              >
                <FolderKanban size={14} className="text-[#FF6B4A]" />
                <span>View Projects</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(255,107,74,0.4)] flex items-center justify-center gap-2 group"
              >
                <span>Enter Workspace</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#0C0D12] hover:bg-[#12141C] border border-white/[0.08] text-zinc-300 hover:text-white font-mono text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Lock size={14} className="text-[#FF6B4A]" />
                <span>Interactive Demo Console</span>
              </Link>
            </>
          )}
        </div>

        {/* ── HERO PRODUCT INTERFACE ASSEMBLY (Layers Self-Constructing) ── */}
        <div ref={heroUiRef} className="w-full max-w-5xl bg-[#0C0D12]/95 border border-white/[0.09] rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden text-left">
          
          {/* Top Shell Bar */}
          <div className="hero-ui-header flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06] text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 text-zinc-500">auvryn.os // workbench</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-emerald-400 font-bold text-[11px]">OPERATIONAL</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Sidebar Mock */}
            <div className="hero-ui-sidebar hidden md:flex col-span-3 flex-col space-y-2 p-3 bg-[#08090D] border border-white/[0.04] rounded-xl text-xs font-mono">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Workspaces</div>
              <div className="px-2.5 py-1.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20 flex items-center justify-between">
                <span>Skavelon Global</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
              </div>
              <div className="px-2.5 py-1.5 text-zinc-400 hover:text-white flex items-center gap-2">
                <FolderKanban size={13} /> <span>Projects (12)</span>
              </div>
              <div className="px-2.5 py-1.5 text-zinc-400 hover:text-white flex items-center gap-2">
                <CheckSquare size={13} /> <span>Tasks (34)</span>
              </div>
              <div className="px-2.5 py-1.5 text-zinc-400 hover:text-white flex items-center gap-2">
                <Video size={13} /> <span>LiveKit SFU</span>
              </div>
              <div className="px-2.5 py-1.5 text-zinc-400 hover:text-white flex items-center gap-2">
                <DollarSign size={13} /> <span>Invoices (₹)</span>
              </div>
            </div>

            {/* Main Command Canvas */}
            <div className="col-span-12 md:col-span-9 space-y-4">
              
              {/* Workspace Pulse Wave */}
              <div className="p-3 bg-[#08090D] border border-white/[0.04] rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5 text-[#FF6B4A] font-bold">
                    <Activity size={12} className="animate-pulse" /> WORKSPACE PULSE WAVE
                  </span>
                  <span className="text-white font-bold">92% · Stable</span>
                </div>
                <div className="hero-ui-pulse w-full h-1.5 bg-[#141620] rounded-full overflow-hidden flex">
                  <div className="w-[68%] bg-[#FF6B4A] h-full shadow-[0_0_8px_#FF6B4A]" />
                  <div className="w-[24%] bg-emerald-400 h-full" />
                  <div className="w-[8%] bg-zinc-600 h-full" />
                </div>
              </div>

              {/* Modular Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="hero-ui-cards p-3 bg-[#08090D] border border-white/[0.04] rounded-xl space-y-1">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">ACTIVE WORKSTREAMS</div>
                  <div className="text-base font-bold text-white">12 Projects</div>
                  <div className="text-[10px] text-emerald-400 font-mono">+3 on track</div>
                </div>
                <div className="hero-ui-cards p-3 bg-[#08090D] border border-white/[0.04] rounded-xl space-y-1">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">SFU CONFERENCING</div>
                  <div className="text-base font-bold text-white">Sub-second</div>
                  <div className="text-[10px] text-[#FF6B4A] font-mono">E2EE NIST P-256</div>
                </div>
                <div className="hero-ui-cards p-3 bg-[#08090D] border border-white/[0.04] rounded-xl space-y-1">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">SETTLED INVOICES</div>
                  <div className="text-base font-bold text-white">₹48,300.00</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Active Currency (₹)</div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 2: PROJECTS VELOCITY & PROGRESS ACCELERATION ──── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="projects"
        ref={projectsPinRef}
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-white/[0.06]"
      >
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#FF6B4A] uppercase font-bold">
              <FolderKanban size={13} />
              <span>Project Delivery Engine</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Work flows toward completion.
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              Watch milestones advance and project trajectories accelerate as your distributed team pushes tasks across delivery boundaries.
            </p>

            <div className="space-y-2 pt-2 text-xs font-mono text-zinc-400">
              <div className={`p-2.5 rounded border transition-colors ${activeMilestone >= 0 ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]/30 text-white' : 'border-white/[0.04]'}`}>
                Phase 1: Architecture Inception (100%)
              </div>
              <div className={`p-2.5 rounded border transition-colors ${activeMilestone >= 1 ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]/30 text-white' : 'border-white/[0.04]'}`}>
                Phase 2: Full-Stack Microservices (100%)
              </div>
              <div className={`p-2.5 rounded border transition-colors ${activeMilestone >= 2 ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]/30 text-white' : 'border-white/[0.04]'}`}>
                Phase 3: LiveKit WebRTC Grid Integration (100%)
              </div>
              <div className={`p-2.5 rounded border transition-colors ${activeMilestone >= 3 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'border-white/[0.04]'}`}>
                Phase 4: Production Release & Telemetry
              </div>
            </div>
          </div>

          {/* Interactive Trajectory Console */}
          <div className="lg:col-span-7 bg-[#0C0D12] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
              <div>
                <span className="text-xs font-mono text-zinc-500 uppercase block">PROJECT REPOSITORY</span>
                <span className="text-base font-bold text-white">AUVRYN Enterprise 2.0</span>
              </div>
              <span className="text-xl font-mono font-extrabold text-[#FF6B4A]">{projectProgress}%</span>
            </div>

            {/* Moving AUVRYN Flow Line Trajectory */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>Trajectory Velocity</span>
                <span>{projectProgress === 100 ? 'Released to Production' : 'Active Flow'}</span>
              </div>
              <div className="w-full h-3 bg-[#151722] rounded-full overflow-visible relative flex items-center">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B4A] to-[#FF8E75] rounded-full relative transition-all duration-75 shadow-[0_0_12px_rgba(255,107,74,0.7)]"
                  style={{ width: `${projectProgress}%` }}
                >
                  {/* Flow Node at trajectory tip */}
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg"
                    style={{ transform: 'translate(50%, -50%)', boxShadow: '0 0 10px #ffffff, 0 0 16px #FF6B4A' }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 text-center">
              <div className="p-3 rounded bg-[#08090D] border border-white/[0.04]">
                <div className="text-[10px] font-mono text-zinc-500">TASKS DONE</div>
                <div className="text-base font-bold text-white mt-1">{Math.round((projectProgress / 100) * 42)} / 42</div>
              </div>
              <div className="p-3 rounded bg-[#08090D] border border-white/[0.04]">
                <div className="text-[10px] font-mono text-zinc-500">VELOCITY</div>
                <div className="text-base font-bold text-emerald-400 mt-1">4.8x avg</div>
              </div>
              <div className="p-3 rounded bg-[#08090D] border border-white/[0.04]">
                <div className="text-[10px] font-mono text-zinc-500">STATUS</div>
                <div className="text-base font-bold text-[#FF6B4A] mt-1">{projectProgress > 80 ? 'Finalizing' : 'Executing'}</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 3: PHYSICAL KANBAN CARDS MIGRATION ────────────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="tasks"
        ref={tasksPinRef}
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-white/[0.05]"
      >
        <div className="max-w-5xl w-full space-y-8 text-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider mb-2 px-2.5 py-1 rounded bg-[#0C0D12] border border-white/[0.06]">
              <CheckSquare size={12} />
              <span>Physical Execution Pipeline</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Tasks don't sit still.
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto mt-1 font-normal">
              Scroll-driven physics smoothly transport deliverables across state boundaries with zero latency.
            </p>
          </div>

          {/* Interactive 3-Column Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            
            {/* Column 1: To Do */}
            <div className="bg-[#0C0D12] border border-white/[0.06] rounded-xl p-4 min-h-[300px] flex flex-col shadow-lg">
              <div className="text-[10px] font-mono text-zinc-400 font-bold uppercase pb-3 mb-3 border-b border-white/[0.04] flex items-center justify-between">
                <span>To Do</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              </div>
              <div className="space-y-3 flex-1">
                {taskACol === 'todo' && (
                  <motion.div layoutId="task-a" className="p-3.5 bg-[#12141E] border border-white/[0.08] rounded-lg shadow-xl space-y-2">
                    <span className="text-[9px] font-mono font-bold text-[#FF6B4A] uppercase block">#TASK-101</span>
                    <div className="text-xs font-semibold text-white">NIST P-256 Key Exchange</div>
                    <div className="text-[10px] text-zinc-500 font-mono">Assigned: Alex Mercer</div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Column 2: In Progress */}
            <div className="bg-[#0C0D12] border border-white/[0.06] rounded-xl p-4 min-h-[300px] flex flex-col shadow-lg">
              <div className="text-[10px] font-mono text-[#FF6B4A] font-bold uppercase pb-3 mb-3 border-b border-white/[0.04] flex items-center justify-between">
                <span>In Progress</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A] animate-pulse" />
              </div>
              <div className="space-y-3 flex-1">
                {taskACol === 'inprogress' && (
                  <motion.div layoutId="task-a" className="p-3.5 bg-[#12141E] border border-[#FF6B4A]/50 rounded-lg shadow-xl space-y-2 ring-1 ring-[#FF6B4A]/30">
                    <span className="text-[9px] font-mono font-bold text-[#FF6B4A] uppercase block">#TASK-101</span>
                    <div className="text-xs font-semibold text-white">NIST P-256 Key Exchange</div>
                    <div className="text-[10px] text-zinc-400 font-mono">Review in progress...</div>
                  </motion.div>
                )}
                {taskBCol === 'inprogress' && (
                  <motion.div layoutId="task-b" className="p-3.5 bg-[#12141E] border border-white/[0.08] rounded-lg shadow-xl space-y-2">
                    <span className="text-[9px] font-mono font-bold text-blue-400 uppercase block">#TASK-102</span>
                    <div className="text-xs font-semibold text-white">WebRTC Selective Forwarding</div>
                    <div className="text-[10px] text-zinc-500 font-mono">Assigned: Elena Rostova</div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Column 3: Completed */}
            <div className="bg-[#0C0D12] border border-white/[0.06] rounded-xl p-4 min-h-[300px] flex flex-col shadow-lg">
              <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase pb-3 mb-3 border-b border-white/[0.04] flex items-center justify-between">
                <span>Completed</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="space-y-3 flex-1">
                {taskACol === 'done' && (
                  <motion.div layoutId="task-a" className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg shadow-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">#TASK-101</span>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-xs font-semibold text-white line-through opacity-80">NIST P-256 Key Exchange</div>
                    <div className="text-[10px] text-emerald-500 font-mono">Verified in Production</div>
                  </motion.div>
                )}
                {taskBCol === 'done' && (
                  <motion.div layoutId="task-b" className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg shadow-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">#TASK-102</span>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-xs font-semibold text-white line-through opacity-80">WebRTC Selective Forwarding</div>
                    <div className="text-[10px] text-emerald-500 font-mono">Merged to Main</div>
                  </motion.div>
                )}
                {taskCCol === 'done' && (
                  <motion.div layoutId="task-c" className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg shadow-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">#TASK-103</span>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-xs font-semibold text-white line-through opacity-80">Ledger Auto-Settlement</div>
                    <div className="text-[10px] text-emerald-500 font-mono">Settled (₹)</div>
                  </motion.div>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 4: CHAT → WEBRTC MEETING MORPH ───────────────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="chat"
        ref={chatMeetingPinRef}
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-white/[0.05]"
      >
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-[#0C0D12] border border-white/[0.06]">
              <MessageSquare size={12} />
              <span>Fluid Communication Pipeline</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Conversation becomes collaboration.
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-normal">
              Real-time messaging instantly converts into multi-party WebRTC video conferences with sub-second latency and zero context loss.
            </p>

            <div className="p-3.5 bg-[#0C0D12] border border-white/[0.05] rounded-xl text-xs font-mono text-zinc-400 space-y-1.5">
              <div className="text-[10px] text-[#FF6B4A] font-bold uppercase tracking-wider">ROUTING & PROTOCOL</div>
              <div className="text-zinc-300 font-medium">{chatStep < 3 ? 'Signal Protocol E2EE Active' : 'SFU 1080p WebRTC Multi-Peer Grid'}</div>
            </div>
          </div>

          {/* Morphing Stage: Chat to Live Meeting */}
          <div className="lg:col-span-7 bg-[#0C0D12] border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-2xl relative min-h-[380px] flex flex-col justify-between overflow-hidden">
            
            {chatStep < 3 ? (
              /* Chat View */
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-center pb-3 border-b border-white/[0.06] text-xs font-mono text-zinc-400">
                  <span className="text-white font-bold">#dev-architecture</span>
                  <span className="text-emerald-400 font-semibold">🔒 TLS 1.3 · E2EE</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04] max-w-sm text-xs">
                    <span className="text-[10px] font-mono text-[#FF6B4A] block font-bold mb-0.5">Lead Architect</span>
                    <span>Architecture review ready. Should we jump into a call?</span>
                  </div>

                  {chatStep >= 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 max-w-sm ml-auto text-xs text-white"
                    >
                      <span className="text-[10px] font-mono text-zinc-400 block font-bold mb-0.5">You</span>
                      <span>Launching instant conference room now.</span>
                    </motion.div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#08090D] border border-[#FF6B4A]/30 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-mono">Join Architecture Review</span>
                  <button className="px-3.5 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors">
                    <Video size={13} /> <span>Join Room</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Morphing LiveKit Meeting Stage */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4 flex-1 flex flex-col justify-between"
              >
                <div className="flex justify-between items-center pb-2 border-b border-white/[0.06] text-xs font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE ROOM // 4 PEERS
                  </span>
                  <span className="text-zinc-500">1080p 60fps</span>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  <div className="bg-[#141622] rounded-xl border border-white/[0.06] p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="text-[10px] font-mono text-zinc-400">Speaker: Sarah Taylor</div>
                    <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/20 border border-[#FF6B4A] mx-auto my-auto flex items-center justify-center text-[#FF6B4A] font-bold text-xs">ST</div>
                    <div className="text-[10px] font-mono text-emerald-400">🎙️ Active Speaker</div>
                  </div>
                  <div className="bg-[#141622] rounded-xl border border-white/[0.06] p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="text-[10px] font-mono text-zinc-400">Screen Share: Architecture.svg</div>
                    <Monitor size={22} className="mx-auto my-auto text-blue-400" />
                    <div className="text-[10px] font-mono text-zinc-400">1920x1080 · 60fps</div>
                  </div>
                </div>

                <div className="flex justify-center gap-2.5 pt-2">
                  <button className="p-2 rounded-lg bg-[#1A1D28] text-white hover:bg-[#202434] transition-colors"><Mic size={14} /></button>
                  <button className="p-2 rounded-lg bg-[#1A1D28] text-white hover:bg-[#202434] transition-colors"><Video size={14} /></button>
                  <button className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors">Leave Call</button>
                </div>
              </motion.div>
            )}

          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 5: FINANCE INVOICE & REAL-TIME LEDGER ─────────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="finance"
        ref={financePinRef}
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-white/[0.05]"
      >
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-[#0C0D12] border border-white/[0.06]">
              <DollarSign size={12} />
              <span>Receivables & Settlement</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Invoices flow toward settlement.
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-normal">
              Real-time line items assemble into professional tax-compliant receivables with automated Indian Rupee (₹) ledger synchronization.
            </p>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={`px-2.5 py-1 rounded border transition-all ${invoiceState === 'Draft' ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-[#FF6B4A] font-bold' : 'border-white/[0.06] text-zinc-500'}`}>Draft</span>
              <span className="text-zinc-600">→</span>
              <span className={`px-2.5 py-1 rounded border transition-all ${invoiceState === 'Sent' ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-[#FF6B4A] font-bold' : 'border-white/[0.06] text-zinc-500'}`}>Sent</span>
              <span className="text-zinc-600">→</span>
              <span className={`px-2.5 py-1 rounded border transition-all ${invoiceState === 'Paid' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold' : 'border-white/[0.06] text-zinc-500'}`}>Paid</span>
            </div>
          </div>

          {/* Interactive Invoice Console (Obsidian Invoice Aesthetic) */}
          <div className="lg:col-span-7 bg-[#0C0D12] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-left">
            <div className="flex justify-between items-start pb-4 border-b border-white/[0.06]">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">INVOICE #INV-2026-884</span>
                <span className="text-sm font-bold text-white">Acme Corp Global Ltd</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                invoiceState === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/30'
              }`}>
                {invoiceState}
              </span>
            </div>

            {/* Line Items */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400 py-1.5 border-b border-white/[0.04]">
                <span>Cloud Native Microservices Architecture</span>
                <span className="font-mono text-white font-semibold">₹32,000.00</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1.5 border-b border-white/[0.04]">
                <span>LiveKit SFU Infrastructure Integration</span>
                <span className="font-mono text-white font-semibold">₹16,300.00</span>
              </div>
            </div>

            {/* Dynamic Total Interpolation */}
            <div className="pt-2 flex justify-between items-baseline">
              <span className="text-xs font-mono text-zinc-400 uppercase">Settled Total:</span>
              <span className="text-2xl font-mono font-extrabold text-[#FF6B4A]">₹{invoiceAmount.toLocaleString()}</span>
            </div>
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 6: VELOCITY ANALYTICS & INTERACTIVE CURVE ─────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="analytics"
        ref={analyticsPinRef}
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-white/[0.05]"
      >
        <div className="max-w-5xl w-full space-y-8 text-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider mb-2 px-2.5 py-1 rounded bg-[#0C0D12] border border-white/[0.06]">
              <TrendingUp size={12} />
              <span>Executive Telemetry & Velocity</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Operational clarity at a glance.
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto mt-1 font-normal">
              Hover over velocity milestones to inspect real-time throughput metrics.
            </p>
          </div>

          {/* Interactive Bar/Trajectory Chart */}
          <div className="bg-[#0C0D12] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl max-w-3xl mx-auto">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-white/[0.06] text-xs font-mono">
              <span className="text-zinc-400">Monthly Revenue Velocity Curve</span>
              <span className="text-[#FF6B4A] font-bold">
                {analyticsHoverIndex !== null ? `₹${analyticsPoints[analyticsHoverIndex].val.toLocaleString()} in ${analyticsPoints[analyticsHoverIndex].label}` : 'Hover Points'}
              </span>
            </div>

            <div className="h-48 flex items-end justify-between gap-4 pt-8 px-4 relative">
              {analyticsPoints.map((pt, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setAnalyticsHoverIndex(idx)}
                  className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-full bg-[#151824] group-hover:bg-[#FF6B4A]/30 rounded-t-lg transition-all relative flex flex-col justify-end" style={{ height: pt.h }}>
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        analyticsHoverIndex === idx ? 'bg-[#FF6B4A] shadow-[0_0_12px_#FF6B4A]' : 'bg-[#FF6B4A]/60'
                      }`}
                      style={{ height: '100%' }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono transition-colors ${analyticsHoverIndex === idx ? 'text-white font-bold' : 'text-zinc-500'}`}>
                    {pt.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 7: FINAL ECOSYSTEM CONVERGENCE & CALL TO ACTION ─ */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        ref={finalRevealRef}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-6 py-24 border-t border-white/[0.05]"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#141622] border border-[#FF6B4A]/40 flex items-center justify-center text-[#FF6B4A] shadow-[0_0_24px_rgba(255,107,74,0.4)] mb-6">
          <AuvrynLogo size={24} />
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0C0D12] border border-white/[0.08] text-[11px] font-mono text-zinc-400 mb-4 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
          <span>AUVRYN Operating Architecture</span>
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-3xl mb-6">
          One system. One operation. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B4A] to-white">
            One continuous flow.
          </span>
        </h2>

        <p className="text-zinc-400 text-xs sm:text-sm md:text-base max-w-xl mb-10 leading-relaxed font-normal">
          Step inside the next-generation operating workbench engineered for velocity, absolute security, and effortless collaboration.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="px-8 py-3.5 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold text-xs transition-all shadow-[0_0_24px_rgba(255,107,74,0.5)] flex items-center gap-2 group"
              >
                <LayoutDashboard size={15} />
                <span>Go to Dashboard</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/projects"
                className="px-8 py-3.5 rounded-xl bg-[#0C0D12] hover:bg-[#12141C] border border-white/[0.08] text-zinc-300 hover:text-white font-mono text-xs transition-colors"
              >
                Explore Projects
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="px-8 py-3.5 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold text-xs transition-all shadow-[0_0_24px_rgba(255,107,74,0.5)] flex items-center gap-2 group"
              >
                <span>Start Free Workspace</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 rounded-xl bg-[#0C0D12] hover:bg-[#12141C] border border-white/[0.08] text-zinc-300 hover:text-white font-mono text-xs transition-colors"
              >
                Access Existing Account
              </Link>
            </>
          )}
        </div>

        <div className="mt-20 pt-8 border-t border-white/[0.04] w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>© 2026 AUVRYN by Skavelon Technologies.</span>
          <span>NIST P-256 · TLS 1.3 · LiveKit SFU</span>
        </div>
      </section>

    </div>
  );
}
