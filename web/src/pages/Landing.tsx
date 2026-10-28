import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Video,
  DollarSign,
  TrendingUp,
  Mic,
  Monitor,
  LayoutDashboard,
  Sparkles,
  Check,
  Menu,
  X,
  Users,
  Briefcase,
  Clock,
  Building2,
  User
} from 'lucide-react';
import AuvrynLogo from '../components/AuvrynLogo';
import ThemeToggle from '../components/ThemeToggle';
import AuvrynHeroArtwork from '../components/motion/AuvrynHeroArtwork';
import AuvrynSignatureRibbon from '../components/motion/AuvrynSignatureRibbon';
import { formatCurrency } from '../lib/currency';
import { ORGANIZATION_PLANS, FREELANCER_PLANS } from '../lib/plans';

gsap.registerPlugin(ScrollTrigger);

// Helper for smooth Catmull-Rom to Cubic Bezier curve paths
function getCurvedPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

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
  const velocityCurveRef = useRef<SVGPathElement>(null);
  const finalRevealRef = useRef<HTMLDivElement>(null);
  const pricingSectionRef = useRef<HTMLDivElement>(null);

  // Dynamic interactive states
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [analyticsHoverIndex, setAnalyticsHoverIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [landingBillingInterval, setLandingBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [landingPlanCategory, setLandingPlanCategory] = useState<'organization' | 'freelancer'>('organization');

  // Animation Refs
  const activeTimeoutsRef = useRef<number[]>([]);
  const activeGsapTweensRef = useRef<gsap.core.Tween[]>([]);
  const hasAnimatedRef = useRef({
    projects: false,
    tasks: false,
    chat: false,
    finance: false,
    analytics: false,
  });

  // Projects live state
  const [projectProgress, setProjectProgress] = useState(14);
  const [activeMilestone, setActiveMilestone] = useState(0);

  // Task column positions
  const [taskACol, setTaskACol] = useState<'todo' | 'inprogress' | 'review' | 'done'>('todo');
  const [taskBCol, setTaskBCol] = useState<'todo' | 'inprogress' | 'review' | 'done'>('inprogress');
  const [taskCCol, setTaskCCol] = useState<'todo' | 'inprogress' | 'review' | 'done'>('done');

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

  // ── 1. Projects Trajectory Animation ──
  const playProjectsSequence = useCallback((): Promise<void> => {
    hasAnimatedRef.current.projects = true;
    return new Promise((resolve) => {
      const projObj = { p: 14 };
      const tween = gsap.to(projObj, {
        p: 88,
        duration: 2.0,
        ease: 'power2.out',
        onUpdate: () => {
          const p = Math.round(projObj.p);
          setProjectProgress(p);
          if (p < 30) setActiveMilestone(0);
          else if (p < 60) setActiveMilestone(1);
          else if (p < 85) setActiveMilestone(2);
          else setActiveMilestone(3);
        },
        onComplete: () => resolve()
      });
      activeGsapTweensRef.current.push(tween);
    });
  }, []);

  // ── 2. Tasks Kanban Migration Animation ──
  const playTasksSequence = useCallback((): Promise<void> => {
    hasAnimatedRef.current.tasks = true;
    return new Promise((resolve) => {
      const t1 = window.setTimeout(() => {
        setTaskACol('inprogress');
        setTaskBCol('done');
      }, 500);
      const t2 = window.setTimeout(() => {
        setTaskACol('done');
        resolve();
      }, 1300);
      activeTimeoutsRef.current.push(t1, t2);
    });
  }, []);

  // ── 3. Chat to LiveKit Transformation Animation ──
  const playChatSequence = useCallback((): Promise<void> => {
    hasAnimatedRef.current.chat = true;
    return new Promise((resolve) => {
      const t1 = window.setTimeout(() => setChatStep(1), 600);
      const t2 = window.setTimeout(() => {
        setChatStep(3);
        resolve();
      }, 1800);
      activeTimeoutsRef.current.push(t1, t2);
    });
  }, []);

  // ── 4. Finance Ledger Settlement Animation ──
  const playFinanceSequence = useCallback((): Promise<void> => {
    hasAnimatedRef.current.finance = true;
    return new Promise((resolve) => {
      const finObj = { val: 0 };
      const tween = gsap.to(finObj, {
        val: 48300,
        duration: 2.0,
        ease: 'power2.out',
        onUpdate: () => {
          const val = Math.round(finObj.val);
          setInvoiceAmount(val);
          if (val < 16000) setInvoiceState('Draft');
          else if (val < 38000) setInvoiceState('Sent');
          else setInvoiceState('Paid');
        },
        onComplete: () => resolve()
      });
      activeGsapTweensRef.current.push(tween);
    });
  }, []);

  // ── 5. Analytics Velocity Curve Animation ──
  const playAnalyticsSequence = useCallback((): Promise<void> => {
    hasAnimatedRef.current.analytics = true;
    return new Promise((resolve) => {
      if (velocityCurveRef.current && typeof velocityCurveRef.current.getTotalLength === 'function') {
        const length = velocityCurveRef.current.getTotalLength() || 800;
        const tween = gsap.fromTo(
          velocityCurveRef.current,
          { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', onComplete: () => resolve() }
        );
        activeGsapTweensRef.current.push(tween);
      } else {
        resolve();
      }
    });
  }, []);

  // ── Intersection Observer for Manual Scrolling ──
  useEffect(() => {
    if (shouldReduceMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          if (target.id === 'projects' && !hasAnimatedRef.current.projects) {
            playProjectsSequence();
          } else if (target.id === 'tasks' && !hasAnimatedRef.current.tasks) {
            playTasksSequence();
          } else if (target.id === 'chat' && !hasAnimatedRef.current.chat) {
            playChatSequence();
          } else if (target.id === 'finance' && !hasAnimatedRef.current.finance) {
            playFinanceSequence();
          } else if (target.id === 'analytics' && !hasAnimatedRef.current.analytics) {
            playAnalyticsSequence();
          }
        });
      },
      { threshold: 0.25 }
    );

    const sections = [
      projectsPinRef.current,
      tasksPinRef.current,
      chatMeetingPinRef.current,
      financePinRef.current,
      analyticsPinRef.current,
    ].filter(Boolean) as HTMLElement[];

    sections.forEach((sec) => observer.observe(sec));

    return () => observer.disconnect();
  }, [shouldReduceMotion, playProjectsSequence, playTasksSequence, playChatSequence, playFinanceSequence, playAnalyticsSequence]);

  // ── Page Load Hero Animation (Natural Navigation, Zero Auto-Scroll) ──
  useEffect(() => {
    if (shouldReduceMotion) {
      setProjectProgress(88);
      setActiveMilestone(3);
      setTaskACol('done');
      setTaskBCol('done');
      setTaskCCol('done');
      setChatStep(3);
      setInvoiceAmount(48300);
      setInvoiceState('Paid');
      setAnalyticsHoverIndex(4);
      return;
    }

    const ctx = gsap.context(() => {
      // Hero Entrance Timeline
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroTl
        .fromTo('.nav-logo', { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 })
        .fromTo('.nav-link', { y: -6, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04, duration: 0.35 }, '-=0.3')
        .fromTo('.nav-action', { y: -6, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.35 }, '-=0.25')
        .fromTo('.hero-eyebrow', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, '-=0.2')
        .fromTo('.hero-subtext', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.2')
        .fromTo('.hero-cta-group', { y: 14, scale: 0.98, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45 }, '-=0.3')
        .fromTo('.hero-trust-badge-item', { y: 12, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.4 }, '-=0.25')
        .fromTo('.hero-ui-shell', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65 }, '-=0.2')
        .fromTo('.hero-ui-sidebar', { x: -25, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55 }, '-=0.35')
        .fromTo('.hero-ui-header', { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, '-=0.5')
        .fromTo('.hero-ui-pulse', { scaleX: 0 }, { scaleX: 1, duration: 0.65, transformOrigin: 'left' }, '-=0.35')
        .fromTo('.hero-ui-cards', { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.09, duration: 0.55 }, '-=0.4');

      // Section Entrance Targets
      gsap.fromTo(
        '.section-entrance-target',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, delay: 0.2, ease: 'power2.out' }
      );
    }, landingRef);

    return () => {
      activeTimeoutsRef.current.forEach((t) => clearTimeout(t));
      activeGsapTweensRef.current.forEach((tw) => tw.kill());
      ctx.revert();
    };
  }, [shouldReduceMotion]);

  const analyticsData = [
    { label: 'Jan', val: 12000 },
    { label: 'Feb', val: 19500 },
    { label: 'Mar', val: 28400 },
    { label: 'Apr', val: 36200 },
    { label: 'May', val: 48300 },
  ];

  // Velocity Analytics Curve calculations
  const rawMax = Math.max(...analyticsData.map((d) => d.val), 0);
  const maxVal = rawMax > 0 ? rawMax : 1;
  const svgWidth = 640;
  const svgHeight = 220;
  const pad = { top: 25, bottom: 35, left: 65, right: 35 };
  const plotWidth = svgWidth - pad.left - pad.right;
  const plotHeight = svgHeight - pad.top - pad.bottom;
  const baselineY = pad.top + plotHeight;

  const chartPoints = analyticsData.map((d, i) => {
    const x = pad.left + (analyticsData.length > 1 ? (i / (analyticsData.length - 1)) * plotWidth : plotWidth / 2);
    const ratio = maxVal > 0 ? Math.max(0, Math.min(1, d.val / maxVal)) : 0;
    const y = pad.top + (1 - ratio) * plotHeight;
    return { ...d, x, y, index: i };
  });

  const curvePath = getCurvedPath(chartPoints);
  const areaPath = chartPoints.length > 1
    ? `${curvePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${baselineY} L ${chartPoints[0].x.toFixed(1)} ${baselineY} Z`
    : '';

  const gridLevels = [0, 0.33, 0.66, 1];
  const gridLines = gridLevels.map((lvl) => {
    const y = pad.top + (1 - lvl) * plotHeight;
    const val = Math.round(lvl * rawMax);
    return { y, val };
  });

  const activePoint = analyticsHoverIndex !== null
    ? chartPoints[analyticsHoverIndex] ?? chartPoints[chartPoints.length - 1]
    : chartPoints[chartPoints.length - 1];

  return (
    <div
      ref={landingRef}
      onPointerMove={handlePointerMove}
      className="min-h-screen w-full bg-app text-main selection:bg-[#FF6B4A]/30 selection:text-main font-sans antialiased overflow-x-hidden relative"
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

      {/* ── TOPBAR NAVIGATION MATCHING IMAGE 2 ── */}
      <header className="sticky top-0 z-50 w-full bg-[#FAF7F2]/90 dark:bg-[#07070b]/90 backdrop-blur-md border-b border-orange-100/60 dark:border-white/5 transition-all">
        <nav className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-3.5 sm:py-4 flex items-center justify-between">
          
          {/* Left: Auvryn Logo ("A" emblem + "Auvryn" bold wordmark) */}
          <div
            className="nav-logo flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <AuvrynLogo size={28} color="#FF5A36" />
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white font-sans">
              Auvryn
            </span>
          </div>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="nav-link relative text-[#FF5A36] pb-1 border-b-2 border-[#FF5A36] font-semibold transition-colors"
            >
              Home
            </a>
            <a href="#projects" className="nav-link text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
              Features
            </a>
            <a href="#pricing" className="nav-link text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#tasks" className="nav-link text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
              About
            </a>
            <a href="#chat" className="nav-link text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
              Contact
            </a>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle size="sm" className="nav-action hidden sm:inline-flex" />

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="nav-action text-sm font-semibold px-5 py-2.5 rounded-full bg-[#FF5A36] hover:bg-[#E84E2C] text-white transition-all shadow-md shadow-[#FF5A36]/25 flex items-center gap-1.5"
              >
                <LayoutDashboard size={14} />
                <span>Dashboard</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="nav-action text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white px-5 py-2 rounded-full border border-slate-200/90 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm hidden sm:inline-block"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="nav-action text-sm font-semibold px-5 py-2.5 rounded-full bg-[#FF5A36] hover:bg-[#E84E2C] text-white transition-all shadow-md shadow-[#FF5A36]/25 flex items-center gap-1.5 group"
                >
                  <span>Get Started</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="nav-action md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-orange-100/60 dark:border-white/10 bg-[#FAF7F2]/98 dark:bg-[#07070b]/98 px-6 py-4 shadow-xl space-y-3 text-sm font-medium text-slate-700 dark:text-slate-300 animate-in fade-in slide-in-from-top-2 duration-150">
            <a href="#" onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="block py-1 text-[#FF5A36] font-bold">Home</a>
            <a href="#projects" onClick={() => setMobileMenuOpen(false)} className="block py-1 hover:text-[#FF5A36] transition-colors">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-1 hover:text-[#FF5A36] transition-colors">Pricing</a>
            <a href="#tasks" onClick={() => setMobileMenuOpen(false)} className="block py-1 hover:text-[#FF5A36] transition-colors">About</a>
            <a href="#chat" onClick={() => setMobileMenuOpen(false)} className="block py-1 hover:text-[#FF5A36] transition-colors">Contact</a>
            <div className="pt-2 border-t border-orange-100/80 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-500">Theme</span>
              <ThemeToggle size="sm" />
            </div>
            {!isAuthenticated ? (
              <div className="pt-2 space-y-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block text-center py-2 rounded-full border border-slate-200 dark:border-white/10 text-sm">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block text-center py-2.5 rounded-full bg-[#FF5A36] text-white text-sm font-semibold">
                  Get Started →
                </Link>
              </div>
            ) : (
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block text-center py-2.5 rounded-full bg-[#FF5A36] text-white text-sm font-semibold">
                Go to Dashboard →
              </Link>
            )}
          </div>
        )}
      </header>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 1: HERO SECTION MATCHING IMAGE 2 ─────────────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 w-full overflow-hidden bg-gradient-to-br from-[#FEF5EE] via-[#FAF7F2] to-[#FEEDE0] dark:from-[#0a0a0f] dark:via-[#07070b] dark:to-[#120f0e] pt-8 sm:pt-14 pb-20 sm:pb-28">
        
        {/* Soft peach atmospheric radial ambient glow */}
        <div className="absolute top-0 right-0 w-[800px] h-[550px] bg-gradient-to-bl from-orange-200/35 via-rose-100/20 to-transparent dark:from-[#FF5A36]/10 dark:via-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 left-0 w-[500px] h-[400px] bg-gradient-to-tr from-amber-100/30 via-orange-100/15 to-transparent dark:from-[#FF5A36]/5 dark:via-transparent blur-3xl pointer-events-none" />

        {/* Auvryn Signature Ribbon & The Auvryn Reveal */}
        <AuvrynSignatureRibbon />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          {/* ── Top Hero 2-Column Split: Typography/CTAs (Left) + Approved Mascot Art (Right) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Column: Eyebrow, Big Goals Headline, Subtitle, Pill Buttons, 4 Trust Badges */}
            <div className="lg:col-span-6 text-left space-y-6 sm:space-y-7 z-10">
              
              {/* Eyebrow */}
              <div className="hero-eyebrow">
                <p className="text-xs sm:text-sm font-bold tracking-[0.18em] text-[#FF5A36] uppercase font-sans">
                  YOUR BUSINESS. YOUR MOMENTUM.
                </p>
              </div>

              {/* Physical Headline Assembly with Coordinated Fade-in */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[62px] font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-white font-sans">
                <motion.span
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                  className="hero-headline-word-1 block"
                >
                  Big goals.
                </motion.span>
                <motion.span
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
                  className="hero-headline-word-2 block text-[#FF5A36] mt-1 sm:mt-1.5"
                >
                  Brighter possibilities.
                </motion.span>
              </h1>

              {/* Supporting Text */}
              <p className="hero-subtext text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                Everything your business needs to plan, collaborate, and grow — all in one place.
              </p>

              {/* Primary & Secondary Pill Buttons */}
              <div className="hero-cta-group flex flex-wrap items-center gap-3.5 sm:gap-4 pt-1">
                <Link
                  to={isAuthenticated ? "/dashboard" : "/register"}
                  className="px-7 sm:px-8 py-3.5 sm:py-4 rounded-full bg-[#FF5A36] hover:bg-[#E84E2C] text-white font-semibold text-sm sm:text-base transition-all shadow-[0_4px_18px_rgba(255,90,54,0.35)] hover:shadow-[0_6px_24px_rgba(255,90,54,0.45)] flex items-center gap-2 group"
                >
                  <span>Get Started</span>
                  <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                </Link>

                <a
                  href="#projects"
                  className="px-7 sm:px-8 py-3.5 sm:py-4 rounded-full bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/15 border border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base transition-all shadow-sm hover:shadow"
                >
                  Explore Features
                </a>
              </div>

              {/* 4 Trust Badges matching Image 2 */}
              <div className="hero-trust-badges pt-4 sm:pt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                <div className="hero-trust-badge-item flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FF5A36]/15 text-[#FF5A36] flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>Manage Projects</span>
                </div>
                <div className="hero-trust-badge-item flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FF5A36]/15 text-[#FF5A36] flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>Track Progress</span>
                </div>
                <div className="hero-trust-badge-item flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FF5A36]/15 text-[#FF5A36] flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>Work Together</span>
                </div>
                <div className="hero-trust-badge-item flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FF5A36]/15 text-[#FF5A36] flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>Grow Faster</span>
                </div>
              </div>
            </div>

            {/* Right Column: Main Landing-Page Hero Artwork (Image 1: Auvryn_ Plans to Progress Dashboard) */}
            <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end mt-40 sm:mt-44 lg:mt-0">
              <AuvrynHeroArtwork />
            </div>

          </div>

          {/* ── HERO PRODUCT INTERFACE ASSEMBLY (Layers Self-Constructing) ── */}
          <div ref={heroUiRef} className="hero-ui-shell mt-36 sm:mt-48 w-full max-w-5xl mx-auto bg-card-bg/95 border border-divider rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden text-left">
          
          {/* Top Shell Bar */}
          <div className="hero-ui-header flex items-center justify-between pb-3 mb-4 border-b border-divider text-xs font-mono text-muted">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 text-muted">auvryn.os // workbench</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-emerald-400 font-bold text-[11px]">OPERATIONAL</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Sidebar Mock */}
            <div className="hero-ui-sidebar hidden md:flex col-span-3 flex-col space-y-2 p-3 bg-app border border-divider rounded-xl text-xs font-mono">
              <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Workspaces</div>
              <div className="px-2.5 py-1.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20 flex items-center justify-between">
                <span>Skavelon Global</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
              </div>
              <div className="px-2.5 py-1.5 text-muted hover:text-main flex items-center gap-2">
                <FolderKanban size={13} /> <span>Projects (12)</span>
              </div>
              <div className="px-2.5 py-1.5 text-muted hover:text-main flex items-center gap-2">
                <CheckSquare size={13} /> <span>Tasks (34)</span>
              </div>
              <div className="px-2.5 py-1.5 text-muted hover:text-main flex items-center gap-2">
                <Video size={13} /> <span>LiveKit SFU</span>
              </div>
              <div className="px-2.5 py-1.5 text-muted hover:text-main flex items-center gap-2">
                <DollarSign size={13} /> <span>Invoices (₹)</span>
              </div>
            </div>

            {/* Main Command Canvas */}
            <div className="col-span-12 md:col-span-9 space-y-4">
              
              {/* Workspace Pulse Wave */}
              <div className="p-3 bg-app border border-divider rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono text-muted">
                  <span className="flex items-center gap-1.5 text-[#FF6B4A] font-bold">
                    <Activity size={12} className="animate-pulse" /> WORKSPACE PULSE WAVE
                  </span>
                  <span className="text-main font-bold">92% · Stable</span>
                </div>
                <div className="hero-ui-pulse w-full h-1.5 bg-hover rounded-full overflow-hidden flex">
                  <div className="w-[68%] bg-[#FF6B4A] h-full shadow-[0_0_8px_#FF6B4A]" />
                  <div className="w-[24%] bg-emerald-400 h-full" />
                  <div className="w-[8%] bg-zinc-600 h-full" />
                </div>
              </div>

              {/* Modular Cards (Stable, Restrained Presentation) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="hero-ui-cards p-3 bg-app border border-divider rounded-xl space-y-1 shadow-sm transition-all duration-200 hover:border-[#FF6B4A]/30">
                  <div className="text-[10px] font-mono text-muted uppercase">ACTIVE WORKSTREAMS</div>
                  <div className="text-base font-bold text-main">12 Projects</div>
                  <div className="text-[10px] text-emerald-400 font-mono">+3 on track</div>
                </div>
                <div className="hero-ui-cards p-3 bg-app border border-divider rounded-xl space-y-1 shadow-sm transition-all duration-200 hover:border-[#FF6B4A]/30">
                  <div className="text-[10px] font-mono text-muted uppercase">SFU CONFERENCING</div>
                  <div className="text-base font-bold text-main">Sub-second</div>
                  <div className="text-[10px] text-[#FF6B4A] font-mono">E2EE NIST P-256</div>
                </div>
                <div className="hero-ui-cards p-3 bg-app border border-divider rounded-xl space-y-1 shadow-sm transition-all duration-200 hover:border-[#FF6B4A]/30">
                  <div className="text-[10px] font-mono text-muted uppercase">SETTLED INVOICES</div>
                  <div className="text-base font-bold text-main">₹48,300.00</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Active Currency (₹)</div>
                </div>
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
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-divider"
      >
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#FF6B4A] uppercase font-bold">
              <FolderKanban size={13} />
              <span>Project Delivery Engine</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-main tracking-tight">
              Work flows toward completion.
            </h2>
            <p className="text-muted text-xs sm:text-sm leading-relaxed">
              Watch milestones advance and project trajectories accelerate as your distributed team pushes tasks across delivery boundaries.
            </p>

            <div className="relative pl-6 space-y-2.5 pt-2 text-xs font-mono">
              {/* Continuous vertical timeline connector line */}
              <div className="absolute left-[11px] top-3.5 bottom-3.5 w-[2px] bg-divider" />
              <div
                className="absolute left-[11px] top-3.5 w-[2px] bg-[#FF6B4A] transition-all duration-500 ease-out"
                style={{
                  height: `${(Math.min(activeMilestone, 3) / 3) * 100}%`,
                }}
              />

              {[
                { label: 'Phase 1: Architecture Inception (100%)', step: 0 },
                { label: 'Phase 2: Full-Stack Microservices (100%)', step: 1 },
                { label: 'Phase 3: LiveKit WebRTC Grid Integration (100%)', step: 2 },
                { label: 'Phase 4: Production Release & Telemetry', step: 3 },
              ].map((phase, idx) => {
                const isActive = activeMilestone >= phase.step;
                const isFinal = phase.step === 3 && activeMilestone >= 3;
                return (
                  <div key={idx} className="relative flex items-center">
                    {/* Milestone node anchor point */}
                    <div
                      className={`absolute -left-6 w-3 h-3 rounded-full border-2 transition-colors duration-300 z-10 ${
                        isFinal
                          ? 'bg-emerald-500 border-emerald-300 shadow-sm'
                          : isActive
                          ? 'bg-[#FF6B4A] border-white dark:border-[#0c0d12] shadow-sm'
                          : 'bg-app border-divider'
                      }`}
                    />
                    <div
                      className={`w-full p-2.5 rounded border transition-colors duration-300 ${
                        isFinal
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                          : isActive
                          ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]/30 text-main'
                          : 'border-divider text-muted'
                      }`}
                    >
                      {phase.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Trajectory Console */}
          <div className="lg:col-span-7 bg-card-bg border border-divider rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-divider">
              <div>
                <span className="text-xs font-mono text-muted uppercase block">PROJECT REPOSITORY</span>
                <span className="text-base font-bold text-main">AUVRYN Enterprise 2.0</span>
              </div>
              <span className="text-xl font-mono font-extrabold text-[#FF6B4A]">{projectProgress}%</span>
            </div>

            {/* AUVRYN Flow Line Trajectory (Clean, Single-Pass Progress) */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono text-muted">
                <span>Trajectory Velocity</span>
                <span>{projectProgress === 100 ? 'Released to Production' : 'Active Flow'}</span>
              </div>
              <div className="w-full h-2.5 bg-hover rounded-full overflow-hidden relative flex items-center">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B4A] to-[#FF8E75] rounded-full relative"
                  style={{ width: `${projectProgress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 text-center">
              <div className="p-3 rounded bg-app border border-divider">
                <div className="text-[10px] font-mono text-muted">TASKS DONE</div>
                <div className="text-base font-bold text-main mt-1">{Math.round((projectProgress / 100) * 42)} / 42</div>
              </div>
              <div className="p-3 rounded bg-app border border-divider">
                <div className="text-[10px] font-mono text-muted">VELOCITY</div>
                <div className="text-base font-bold text-emerald-400 mt-1">4.8x avg</div>
              </div>
              <div className="p-3 rounded bg-app border border-divider">
                <div className="text-[10px] font-mono text-muted">STATUS</div>
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
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-divider"
      >
        <div className="max-w-5xl w-full space-y-8 text-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider mb-2 px-2.5 py-1 rounded bg-card-bg border border-divider">
              <CheckSquare size={12} />
              <span>Physical Execution Pipeline</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-main tracking-tight">
              Tasks don't sit still.
            </h2>
            <p className="text-muted text-xs sm:text-sm max-w-xl mx-auto mt-1 font-normal">
              Scroll-driven physics smoothly transport deliverables across state boundaries with zero latency.
            </p>
          </div>

          {/* Interactive 3-Column Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            
            {/* Column 1: To Do */}
            <div className="bg-card-bg border border-divider rounded-xl p-4 min-h-[300px] flex flex-col shadow-lg">
              <div className="text-[10px] font-mono text-muted font-bold uppercase pb-3 mb-3 border-b border-divider flex items-center justify-between">
                <span>To Do</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              </div>
              <div className="space-y-3 flex-1">
                {taskACol === 'todo' && (
                  <motion.div layoutId="task-a" className="p-3.5 bg-hover border border-divider rounded-lg shadow-xl space-y-2">
                    <span className="text-[9px] font-mono font-bold text-[#FF6B4A] uppercase block">#TASK-101</span>
                    <div className="text-xs font-semibold text-main">NIST P-256 Key Exchange</div>
                    <div className="text-[10px] text-muted font-mono">Assigned: Alex Mercer</div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Column 2: In Progress */}
            <div className="bg-card-bg border border-divider rounded-xl p-4 min-h-[300px] flex flex-col shadow-lg">
              <div className="text-[10px] font-mono text-[#FF6B4A] font-bold uppercase pb-3 mb-3 border-b border-divider flex items-center justify-between">
                <span>In Progress</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A] animate-pulse" />
              </div>
              <div className="space-y-3 flex-1">
                {taskACol === 'inprogress' && (
                  <motion.div layoutId="task-a" className="p-3.5 bg-hover border border-[#FF6B4A]/50 rounded-lg shadow-xl space-y-2 ring-1 ring-[#FF6B4A]/30">
                    <span className="text-[9px] font-mono font-bold text-[#FF6B4A] uppercase block">#TASK-101</span>
                    <div className="text-xs font-semibold text-main">NIST P-256 Key Exchange</div>
                    <div className="text-[10px] text-muted font-mono">Review in progress...</div>
                  </motion.div>
                )}
                {taskBCol === 'inprogress' && (
                  <motion.div layoutId="task-b" className="p-3.5 bg-hover border border-divider rounded-lg shadow-xl space-y-2">
                    <span className="text-[9px] font-mono font-bold text-blue-400 uppercase block">#TASK-102</span>
                    <div className="text-xs font-semibold text-main">WebRTC Selective Forwarding</div>
                    <div className="text-[10px] text-muted font-mono">Assigned: Elena Rostova</div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Column 3: Completed */}
            <div className="bg-card-bg border border-divider rounded-xl p-4 min-h-[300px] flex flex-col shadow-lg">
              <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase pb-3 mb-3 border-b border-divider flex items-center justify-between">
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
                    <div className="text-xs font-semibold text-main line-through opacity-80">NIST P-256 Key Exchange</div>
                    <div className="text-[10px] text-emerald-500 font-mono">Verified in Production</div>
                  </motion.div>
                )}
                {taskBCol === 'done' && (
                  <motion.div layoutId="task-b" className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg shadow-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">#TASK-102</span>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-xs font-semibold text-main line-through opacity-80">WebRTC Selective Forwarding</div>
                    <div className="text-[10px] text-emerald-500 font-mono">Merged to Main</div>
                  </motion.div>
                )}
                {taskCCol === 'done' && (
                  <motion.div layoutId="task-c" className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg shadow-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">#TASK-103</span>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-xs font-semibold text-main line-through opacity-80">Ledger Auto-Settlement</div>
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
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-divider"
      >
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-card-bg border border-divider">
              <MessageSquare size={12} />
              <span>Fluid Communication Pipeline</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-main tracking-tight">
              Conversation becomes collaboration.
            </h2>
            <p className="text-muted text-xs sm:text-sm leading-relaxed font-normal">
              Real-time messaging instantly converts into multi-party WebRTC video conferences with sub-second latency and zero context loss.
            </p>

            <div className="p-3.5 bg-card-bg border border-divider rounded-xl text-xs font-mono text-muted space-y-1.5">
              <div className="text-[10px] text-[#FF6B4A] font-bold uppercase tracking-wider">ROUTING & PROTOCOL</div>
              <div className="text-muted font-medium">{chatStep < 3 ? 'Signal Protocol E2EE Active' : 'SFU 1080p WebRTC Multi-Peer Grid'}</div>
            </div>
          </div>

          {/* Morphing Stage: Chat to Live Meeting */}
          <div className="lg:col-span-7 bg-card-bg border border-divider rounded-2xl p-6 sm:p-7 shadow-2xl relative min-h-[380px] flex flex-col justify-between overflow-hidden">
            
            {chatStep < 3 ? (
              /* Chat View */
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-center pb-3 border-b border-divider text-xs font-mono text-muted">
                  <span className="text-main font-bold">#dev-architecture</span>
                  <span className="text-emerald-400 font-semibold">🔒 TLS 1.3 · E2EE</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-divider max-w-sm text-xs">
                    <span className="text-[10px] font-mono text-[#FF6B4A] block font-bold mb-0.5">Lead Architect</span>
                    <span>Architecture review ready. Should we jump into a call?</span>
                  </div>

                  {chatStep >= 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 max-w-sm ml-auto text-xs text-main"
                    >
                      <span className="text-[10px] font-mono text-muted block font-bold mb-0.5">You</span>
                      <span>Launching instant conference room now.</span>
                    </motion.div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-app border border-[#FF6B4A]/30 flex items-center justify-between text-xs">
                  <span className="text-muted font-mono">Join Architecture Review</span>
                  <button className="px-3.5 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-semibold text-[11px] flex items-center gap-1.5 transition-colors">
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
                <div className="flex justify-between items-center pb-2 border-b border-divider text-xs font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE ROOM // 4 PEERS
                  </span>
                  <span className="text-muted">1080p 60fps</span>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  <div className="bg-hover rounded-xl border border-divider p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="text-[10px] font-mono text-muted">Speaker: Sarah Taylor</div>
                    <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/20 border border-[#FF6B4A] mx-auto my-auto flex items-center justify-center text-[#FF6B4A] font-bold text-xs">ST</div>
                    <div className="text-[10px] font-mono text-emerald-400">🎙️ Active Speaker</div>
                  </div>
                  <div className="bg-hover rounded-xl border border-divider p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="text-[10px] font-mono text-muted">Screen Share: Architecture.svg</div>
                    <Monitor size={22} className="mx-auto my-auto text-blue-400" />
                    <div className="text-[10px] font-mono text-muted">1920x1080 · 60fps</div>
                  </div>
                </div>

                <div className="flex justify-center gap-2.5 pt-2">
                  <button className="p-2 rounded-lg bg-hover text-main hover:bg-hover transition-colors"><Mic size={14} /></button>
                  <button className="p-2 rounded-lg bg-hover text-main hover:bg-hover transition-colors"><Video size={14} /></button>
                  <button className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-main text-xs font-semibold transition-colors">Leave Call</button>
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
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-divider"
      >
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-card-bg border border-divider">
              <DollarSign size={12} />
              <span>Receivables & Settlement</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-main tracking-tight">
              Invoices flow toward settlement.
            </h2>
            <p className="text-muted text-xs sm:text-sm leading-relaxed font-normal">
              Real-time line items assemble into professional tax-compliant receivables with automated Indian Rupee (₹) ledger synchronization.
            </p>

            <div className="flex items-center gap-1.5 text-xs font-mono pt-1">
              <span className={`px-2.5 py-1 rounded border transition-colors duration-300 ${invoiceState === 'Draft' ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-[#FF6B4A] font-bold' : 'border-divider text-muted'}`}>Draft</span>
              <div className="w-5 h-[2px] bg-divider relative overflow-hidden shrink-0">
                <div
                  className={`h-full transition-all duration-300 ${invoiceState === 'Sent' || invoiceState === 'Paid' ? 'w-full bg-[#FF6B4A]' : 'w-0'}`}
                />
              </div>
              <span className={`px-2.5 py-1 rounded border transition-colors duration-300 ${invoiceState === 'Sent' ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-[#FF6B4A] font-bold' : invoiceState === 'Paid' ? 'bg-app border-divider text-muted' : 'border-divider text-muted'}`}>Sent</span>
              <div className="w-5 h-[2px] bg-divider relative overflow-hidden shrink-0">
                <div
                  className={`h-full transition-all duration-300 ${invoiceState === 'Paid' ? 'w-full bg-emerald-500' : 'w-0'}`}
                />
              </div>
              <span className={`px-2.5 py-1 rounded border transition-colors duration-300 ${invoiceState === 'Paid' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold' : 'border-divider text-muted'}`}>Paid</span>
            </div>
          </div>

          {/* Interactive Invoice Console (Obsidian Invoice Aesthetic) */}
          <div className="lg:col-span-7 bg-card-bg border border-divider rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-left">
            <div className="flex justify-between items-start pb-4 border-b border-divider">
              <div>
                <span className="text-[10px] font-mono text-muted uppercase block">INVOICE #INV-2026-884</span>
                <span className="text-sm font-bold text-main">Acme Corp Global Ltd</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                invoiceState === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/30'
              }`}>
                {invoiceState}
              </span>
            </div>

            {/* Line Items */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted py-1.5 border-b border-divider">
                <span>Cloud Native Microservices Architecture</span>
                <span className="font-mono text-main font-semibold">₹32,000.00</span>
              </div>
              <div className="flex justify-between text-muted py-1.5 border-b border-divider">
                <span>LiveKit SFU Infrastructure Integration</span>
                <span className="font-mono text-main font-semibold">₹16,300.00</span>
              </div>
            </div>

            {/* Dynamic Total Interpolation */}
            <div className="pt-2 flex justify-between items-baseline">
              <span className="text-xs font-mono text-muted uppercase">Settled Total:</span>
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
        className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 border-t border-divider"
      >
        <div className="max-w-5xl w-full space-y-8 text-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FF6B4A] uppercase font-bold tracking-wider mb-2 px-2.5 py-1 rounded bg-card-bg border border-divider">
              <TrendingUp size={12} />
              <span>Executive Telemetry & Velocity</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-main tracking-tight">
              Operational clarity at a glance.
            </h2>
            <p className="text-muted text-xs sm:text-sm max-w-xl mx-auto mt-1 font-normal">
              Hover over velocity milestones to inspect real-time throughput metrics.
            </p>
          </div>

          {/* Interactive Velocity Revenue Curve Chart */}
          <div
            className="bg-card-bg border border-divider rounded-2xl p-5 sm:p-7 shadow-lg max-w-3xl mx-auto w-full transition-shadow duration-300"
            onMouseLeave={() => setAnalyticsHoverIndex(null)}
          >
            {/* Header: Title and Live Hover/Active Value */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-divider gap-2 text-left sm:text-right">
              <div>
                <span className="text-xs sm:text-sm font-mono text-muted font-medium">
                  Monthly Revenue Velocity Curve
                </span>
              </div>
              <div
                aria-live="polite"
                className="text-[#FF5A36] font-bold font-mono text-xs sm:text-sm tracking-tight"
              >
                {activePoint
                  ? `${formatCurrency(activePoint.val, 'INR')} in ${activePoint.label}`
                  : 'Hover Points'}
              </div>
            </div>

            {/* Empty State Guard */}
            {analyticsData.length === 0 ? (
              <div className="h-56 sm:h-64 flex flex-col items-center justify-center text-muted font-mono text-xs sm:text-sm gap-2">
                <TrendingUp size={20} className="text-muted/60" />
                <span>No revenue data yet</span>
              </div>
            ) : (
              /* Plot Area with Explicit Responsive Aspect Ratio */
              <div className="relative w-full h-[220px] sm:h-[250px] aspect-[16/7] min-h-[200px]">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="w-full h-full overflow-visible select-none"
                  aria-label="Monthly Revenue Velocity chart showing growth from January to May"
                  role="img"
                >
                  <defs>
                    <linearGradient id="revenueVelocityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF5A36" stopOpacity="0.16" />
                      <stop offset="95%" stopColor="#FF5A36" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* 1. Horizontal Gridlines & Y-Axis Value Labels */}
                  {gridLines.map((grid, idx) => (
                    <g key={idx}>
                      <line
                        x1={pad.left}
                        y1={grid.y}
                        x2={pad.left + plotWidth}
                        y2={grid.y}
                        stroke="currentColor"
                        className="text-line/40 dark:text-line/30"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x={pad.left - 10}
                        y={grid.y + 3.5}
                        textAnchor="end"
                        className="text-[10px] sm:text-[11px] font-mono fill-muted select-none"
                      >
                        {formatCurrency(grid.val, 'INR').replace('.00', '')}
                      </text>
                    </g>
                  ))}

                  {/* 2. Soft Gradient Area Underneath the Curve */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#revenueVelocityGradient)"
                      className="transition-opacity duration-300 pointer-events-none"
                    />
                  )}

                  {/* 3. Highlight Vertical Guide Line for Active/Hovered Month */}
                  {activePoint && (
                    <line
                      x1={activePoint.x}
                      y1={pad.top}
                      x2={activePoint.x}
                      y2={baselineY}
                      stroke="#FF5A36"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                      strokeOpacity="0.45"
                      className="pointer-events-none transition-all duration-150"
                    />
                  )}

                  {/* 4. Smooth Catmull-Rom Velocity Curve Line (Restrained, Controlled Transition) */}
                  {curvePath && (
                    <path
                      ref={velocityCurveRef}
                      d={curvePath}
                      fill="none"
                      stroke="#FF5A36"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-sm"
                    />
                  )}

                  {/* 5. Month Labels along X-Axis */}
                  {chartPoints.map((pt) => {
                    const isActive = activePoint?.index === pt.index;
                    return (
                      <text
                        key={`label-${pt.label}`}
                        x={pt.x}
                        y={baselineY + 22}
                        textAnchor="middle"
                        className={`text-[11px] sm:text-xs font-mono transition-colors select-none ${
                          isActive
                            ? 'fill-main font-bold dark:fill-white'
                            : 'fill-muted'
                        }`}
                      >
                        {pt.label}
                      </text>
                    );
                  })}

                  {/* 6. Milestone Dots and Interactive Target Overlays */}
                  {chartPoints.map((pt) => {
                    const isActive = activePoint?.index === pt.index;
                    return (
                      <g
                        key={`point-${pt.label}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${pt.label}: ${formatCurrency(pt.val, 'INR')}`}
                        onMouseEnter={() => setAnalyticsHoverIndex(pt.index)}
                        onFocus={() => setAnalyticsHoverIndex(pt.index)}
                        onBlur={() => setAnalyticsHoverIndex(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowRight' && pt.index < chartPoints.length - 1) {
                            setAnalyticsHoverIndex(pt.index + 1);
                          } else if (e.key === 'ArrowLeft' && pt.index > 0) {
                            setAnalyticsHoverIndex(pt.index - 1);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                      >
                        {/* Generous touch / hit target */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="22"
                          fill="transparent"
                          className="cursor-pointer"
                          onTouchStart={() => setAnalyticsHoverIndex(pt.index)}
                        />

                        {/* Pulsing Aura Halo for Active / Current Month */}
                        {isActive && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="13"
                            fill="#FF5A36"
                            fillOpacity="0.18"
                            className="animate-pulse"
                          />
                        )}

                        {/* Solid Milestone Dot */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 6 : 4}
                          fill="#FF5A36"
                          stroke="#ffffff"
                          strokeWidth={isActive ? 2.5 : 1.5}
                          className="dark:stroke-surface-2 transition-all duration-150 shadow-sm"
                        />
                      </g>
                    );
                  })}

                  {/* 7. Active Month Floating Tooltip */}
                  {activePoint && (
                    <g
                      transform={`translate(${Math.max(pad.left + 50, Math.min(svgWidth - pad.right - 50, activePoint.x))}, ${Math.max(pad.top + 14, activePoint.y - 12)})`}
                      className="pointer-events-none transition-transform duration-150 ease-out"
                    >
                      <rect
                        x="-56"
                        y="-26"
                        width="112"
                        height="26"
                        rx="6"
                        className="fill-surface stroke-line shadow-md dark:fill-surface-2 dark:stroke-line"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="-9"
                        textAnchor="middle"
                        className="text-[11px] font-mono font-bold fill-text select-none"
                      >
                        {activePoint.label}: {formatCurrency(activePoint.val, 'INR').replace('.00', '')}
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 6.5: PLANS & PRICING ARCHITECTURE ─────────────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section id="pricing" ref={pricingSectionRef} className="relative z-10 py-28 px-4 sm:px-6 border-t border-divider max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-card-bg border border-divider text-[11px] font-mono text-muted shadow-sm">
            <Sparkles size={12} className="text-[#FF6B4A]" />
            <span>Transparent Scalable Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-main">
            Transparent Subscriptions. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B4A] to-white">
              Zero Artificial Roadblocks.
            </span>
          </h2>

          <p className="text-muted text-xs sm:text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Monthly and yearly recurring billing with automated seat quotas, instant Razorpay checkout, and unrestricted capabilities.
          </p>

          {/* Account Category Switcher: Organizations vs Freelancers */}
          <div className="pt-2 flex items-center justify-center">
            <div className="inline-flex p-1.5 rounded-2xl bg-card-bg border border-divider shadow-lg gap-1.5">
              <button
                type="button"
                onClick={() => setLandingPlanCategory('organization')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  landingPlanCategory === 'organization'
                    ? 'bg-[#FF6B4A] text-white shadow-[0_0_15px_rgba(255,107,74,0.35)]'
                    : 'text-muted hover:text-main'
                }`}
              >
                <Building2 size={15} />
                <span>Organizations & Teams</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/20 text-white/90">
                  ₹0 – ₹499
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLandingPlanCategory('freelancer')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  landingPlanCategory === 'freelancer'
                    ? 'bg-[#FF6B4A] text-white shadow-[0_0_15px_rgba(255,107,74,0.35)]'
                    : 'text-muted hover:text-main'
                }`}
              >
                <User size={15} />
                <span>Freelancers & Solo</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/20 text-white/90">
                  ₹0 – ₹599
                </span>
              </button>
            </div>
          </div>

          {/* Monthly / Yearly Toggle */}
          <div className="pt-1 flex items-center justify-center gap-3">
            <div className="bg-card-bg border border-divider rounded-xl p-1.5 flex items-center gap-1 shadow-lg">
              <button
                onClick={() => setLandingBillingInterval('monthly')}
                className={`px-5 py-2 rounded-lg text-xs font-mono font-semibold transition-all ${
                  landingBillingInterval === 'monthly'
                    ? 'bg-[#FF6B4A] text-white shadow-[0_0_15px_rgba(255,107,74,0.4)]'
                    : 'text-muted hover:text-main'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setLandingBillingInterval('yearly')}
                className={`px-5 py-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
                  landingBillingInterval === 'yearly'
                    ? 'bg-[#FF6B4A] text-white shadow-[0_0_15px_rgba(255,107,74,0.4)]'
                    : 'text-muted hover:text-main'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Save 2 Months
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Tier Plan Cards Grid (Organizations or Freelancers) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {(landingPlanCategory === 'organization' ? ORGANIZATION_PLANS : FREELANCER_PLANS).map((plan) => {
            const isFree = plan.priceMonthly === 0;
            const yearlyPrice = plan.priceMonthly * 10;
            const effectiveMonthly = Math.round(yearlyPrice / 12);
            const price = landingBillingInterval === 'monthly' ? plan.priceMonthly : yearlyPrice;

            return (
              <div
                key={plan.tier}
                className={`rounded-2xl flex flex-col justify-between p-7 space-y-6 transition-all duration-300 relative ${
                  plan.isPopular
                    ? 'bg-card-bg border-2 border-[#FF6B4A] shadow-[0_0_35px_rgba(255,107,74,0.25)] ring-1 ring-[#FF6B4A]/25'
                    : 'bg-card-bg border border-divider hover:border-black/20 dark:hover:border-white/20 shadow-xl'
                }`}
              >
                {/* Enterprise Power / Most Popular Badge */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-[#FF6B4A] text-white text-[10px] font-mono font-bold tracking-wider rounded-full shadow-[0_0_12px_#FF6B4A] uppercase">
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Title & Tagline */}
                  <div>
                    <h3 className="text-2xl font-bold text-main mt-0.5">{plan.name}</h3>
                    <p className="text-xs text-muted mt-1 leading-relaxed min-h-[32px]">{plan.tagline}</p>
                  </div>

                  {/* Pricing Display */}
                  <div className="pt-2 pb-4 border-b border-divider">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold font-mono text-main">
                        ₹{isFree ? '0' : price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs font-mono text-muted">
                        / {isFree ? 'month' : (landingBillingInterval === 'monthly' ? 'month' : 'year')}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-muted mt-1">
                      {isFree
                        ? 'No credit card required'
                        : landingBillingInterval === 'yearly'
                        ? <span className="text-emerald-400">₹{effectiveMonthly}/mo effective · 2 months free</span>
                        : 'Billed monthly via Razorpay'}
                    </div>
                  </div>

                  {/* Key Quota Limits */}
                  <div className="space-y-2.5 text-xs font-mono text-muted">
                    <div className="flex justify-between items-center py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Users size={13} className="text-[#FF6B4A]" /> Seats:
                      </span>
                      <span className="text-main font-semibold">{plan.limits.seats}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Briefcase size={13} className="text-[#FF6B4A]" /> Projects:
                      </span>
                      <span className="text-main font-semibold">{plan.limits.projects}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Sparkles size={13} className="text-[#FF6B4A]" /> Workflows:
                      </span>
                      <span className="text-main font-semibold">{plan.limits.workflows}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Clock size={13} className="text-[#FF6B4A]" /> History:
                      </span>
                      <span className="text-main font-semibold">{plan.limits.history}</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2 pt-2 text-xs text-muted">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Call To Action Button */}
                <div className="pt-2">
                  {isFree ? (
                    <Link
                      to={`/register?plan=${plan.tier}&accountType=${landingPlanCategory}`}
                      aria-label={`Start with ${plan.name} Plan`}
                      className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-center transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={14} />
                      <span>Start with {plan.name} Free →</span>
                    </Link>
                  ) : plan.isPopular ? (
                    <Link
                      to={`/pricing?plan=${plan.tier}&interval=${landingBillingInterval}&category=${landingPlanCategory}`}
                      aria-label={`Upgrade to ${plan.name} Plan`}
                      className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-[#FF6B4A] hover:bg-[#FF552B] text-white shadow-[0_0_20px_rgba(255,107,74,0.4)] text-center transition-all flex items-center justify-center gap-2"
                    >
                      <span>Upgrade to {plan.name} →</span>
                    </Link>
                  ) : (
                    <Link
                      to={`/pricing?plan=${plan.tier}&interval=${landingBillingInterval}&category=${landingPlanCategory}`}
                      aria-label={`Upgrade to ${plan.name} Plan`}
                      className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-[#FF6B4A]/10 hover:bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30 text-center transition-all flex items-center justify-center gap-2"
                    >
                      <span>Upgrade to {plan.name} →</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Link to Full Pricing & Comparison Matrix */}
        <div className="mt-12 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-xs font-mono text-[#FF6B4A] hover:text-[#FF552B] hover:underline underline-offset-4"
          >
            <span>View Comprehensive 10-Point Quota & Capability Comparison Matrix</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Custom Development CTA Banner */}
        <div className="mt-8 max-w-4xl mx-auto bg-card-bg border border-divider rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-left shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-[#FF6B4A] uppercase tracking-wider font-semibold">Custom Development</span>
            <h4 className="text-lg font-bold text-main">Need Bespoke Architecture or Specialized Integrations?</h4>
            <p className="text-xs text-muted">Tailored ERP connectors, dedicated private cloud deployments, and custom modules.</p>
          </div>
          <Link
            to="/pricing?inquiry=true"
            aria-label="Contact Our Team for Custom Development"
            className="px-6 py-3 bg-white text-zinc-900 hover:bg-zinc-200 font-bold text-xs rounded-xl transition-all shadow-md shrink-0 flex items-center gap-2"
          >
            <span>Contact Our Team →</span>
          </Link>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── SECTION 7: FINAL ECOSYSTEM CONVERGENCE & CALL TO ACTION ─ */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        ref={finalRevealRef}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-6 py-24 border-t border-divider"
      >
        <div className="w-12 h-12 rounded-2xl bg-hover border border-[#FF6B4A]/40 flex items-center justify-center text-[#FF6B4A] shadow-[0_0_24px_rgba(255,107,74,0.4)] mb-6">
          <AuvrynLogo size={24} />
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-card-bg border border-divider text-[11px] font-mono text-muted mb-4 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
          <span>AUVRYN Operating Architecture</span>
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-main tracking-tight leading-tight max-w-3xl mb-6">
          One system. One operation. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B4A] to-white">
            One continuous flow.
          </span>
        </h2>

        <p className="text-muted text-xs sm:text-sm md:text-base max-w-xl mb-10 leading-relaxed font-normal">
          Step inside the next-generation operating workbench engineered for velocity, absolute security, and effortless collaboration.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="px-8 py-3.5 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-semibold text-xs transition-all shadow-[0_0_24px_rgba(255,107,74,0.5)] flex items-center gap-2 group"
              >
                <LayoutDashboard size={15} />
                <span>Go to Dashboard</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/projects"
                className="px-8 py-3.5 rounded-xl bg-card-bg hover:bg-hover border border-divider text-muted hover:text-main font-mono text-xs transition-colors"
              >
                Explore Projects
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="px-8 py-3.5 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-semibold text-xs transition-all shadow-[0_0_24px_rgba(255,107,74,0.5)] flex items-center gap-2 group"
              >
                <span>Start Free Workspace</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 rounded-xl bg-card-bg hover:bg-hover border border-divider text-muted hover:text-main font-mono text-xs transition-colors"
              >
                Access Existing Account
              </Link>
            </>
          )}
        </div>

        <div className="mt-20 pt-8 border-t border-divider w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-muted gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span>© 2026 AUVRYN by Skavelon Technologies.</span>
            <Link to="/pricing" className="text-[#FF6B4A] hover:underline font-semibold">Pricing</Link>
            <Link to="/privacy-policy" className="hover:text-main">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-main">Terms of Service</Link>
            <Link to="/contact" className="hover:text-main">Contact</Link>
          </div>
          <span>NIST P-256 · TLS 1.3 · LiveKit SFU</span>
        </div>
      </section>

    </div>
  );
}
