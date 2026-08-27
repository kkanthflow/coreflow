/**
 * Shared Motion Foundation Constants
 * High-performance, accessible, 60fps targeted easing curves.
 */
export const EASINGS = {
  // Snappy, authoritative precision (Finance, Invoices, Settings)
  precision: [0.16, 1, 0.3, 1] as const,
  // Natural physical spring (Tasks, Modals)
  tactileSpring: { type: 'spring', stiffness: 420, damping: 28 } as const,
  // Deep cinematic & spatial transitions (Meetings, Expansion)
  spatial: [0.22, 1, 0.36, 1] as const,
  // Smooth data & organic conversational curve (Analytics, Chat, CRM)
  organic: [0.25, 0.1, 0.25, 1] as const,
  // Calmer direct response (Settings, System Toggles)
  calm: [0.4, 0, 0.2, 1] as const,
};

export type MotionModuleType =
  | 'dashboard'
  | 'projects'
  | 'tasks'
  | 'meetings'
  | 'chat'
  | 'employees'
  | 'departments'
  | 'clients'
  | 'invoices'
  | 'payments'
  | 'analytics'
  | 'settings'
  | 'default';

/**
 * Detect module personality by path
 */
export function getModuleType(pathname: string): MotionModuleType {
  if (pathname === '/' || pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/meetings') || pathname.startsWith('/pre-join') || pathname.startsWith('/meeting/')) return 'meetings';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/employees')) return 'employees';
  if (pathname.startsWith('/departments')) return 'departments';
  if (pathname.startsWith('/clients')) return 'clients';
  if (pathname.startsWith('/invoices')) return 'invoices';
  if (pathname.startsWith('/payments')) return 'payments';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'default';
}

/**
 * Route level module-specific transition signatures
 */
export const MODULE_PAGE_VARIANTS: Record<MotionModuleType, any> = {
  // 1. Dashboard: "Pulse & Orchestration" - Synchronized pulse reveal
  dashboard: {
    initial: { opacity: 0, scale: 0.985, y: 12 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.36, ease: EASINGS.spatial }
    },
    exit: {
      opacity: 0,
      scale: 0.99,
      transition: { duration: 0.18, ease: 'easeOut' }
    }
  },

  // 2. Projects: "Progress & Expansion" - Forward spatial workspace expansion
  projects: {
    initial: { opacity: 0, scale: 0.97, x: 16 },
    animate: {
      opacity: 1,
      scale: 1,
      x: 0,
      transition: { duration: 0.32, ease: EASINGS.precision }
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      x: -12,
      transition: { duration: 0.16, ease: 'easeOut' }
    }
  },

  // 3. Tasks: "Physical Workflow" - High tactile lateral snap and lift
  tasks: {
    initial: { opacity: 0, y: 16, rotateX: 2 },
    animate: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: { duration: 0.28, ease: EASINGS.precision }
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: { duration: 0.15, ease: 'easeIn' }
    }
  },

  // 4. Meetings: "Spatial Transformation" - Deep immersive spatial zoom
  meetings: {
    initial: { opacity: 0, scale: 1.04, filter: 'blur(6px)' },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.42, ease: EASINGS.spatial }
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      filter: 'blur(4px)',
      transition: { duration: 0.2, ease: 'easeIn' }
    }
  },

  // 5. Chat: "Conversation Continuity" - Quick soft conversational slide
  chat: {
    initial: { opacity: 0, x: -8 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.22, ease: EASINGS.organic }
    },
    exit: {
      opacity: 0,
      x: 8,
      transition: { duration: 0.14, ease: 'easeIn' }
    }
  },

  // 6. Employees: "Identity & Focus" - Centered focus reveal
  employees: {
    initial: { opacity: 0, y: 10, scale: 0.99 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.3, ease: EASINGS.precision }
    },
    exit: {
      opacity: 0,
      y: -6,
      transition: { duration: 0.15 }
    }
  },

  // 7. Departments: "Structure & Branching" - Structural cascading reveal
  departments: {
    initial: { opacity: 0, scaleY: 0.98, y: 14 },
    animate: {
      opacity: 1,
      scaleY: 1,
      y: 0,
      transition: { duration: 0.34, ease: EASINGS.spatial }
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: 0.15 }
    }
  },

  // 8. Clients CRM: "Relationship Timeline" - Chronological progressive reveal
  clients: {
    initial: { opacity: 0, x: 14 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: EASINGS.precision }
    },
    exit: {
      opacity: 0,
      x: -10,
      transition: { duration: 0.15 }
    }
  },

  // 9. Invoices: "Precision & State" - High-speed numeric razor sharp reveal
  invoices: {
    initial: { opacity: 0, y: 6 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.18, ease: EASINGS.precision }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.1 }
    }
  },

  // 10. Settlements / Payments: "Linear Transaction Movement" - Direct unidirectional slide
  payments: {
    initial: { opacity: 0, x: -16 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.2, ease: EASINGS.precision }
    },
    exit: {
      opacity: 0,
      x: 12,
      transition: { duration: 0.12 }
    }
  },

  // 11. Analytics: "Data Morphing & Trace" - Technical grid tracing
  analytics: {
    initial: { opacity: 0, scale: 0.98, filter: 'blur(2px)' },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.35, ease: EASINGS.organic }
    },
    exit: {
      opacity: 0,
      scale: 0.99,
      transition: { duration: 0.15 }
    }
  },

  // 12. Settings: "Controlled System Response" - Stable, instant, calm crossfade
  settings: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.14, ease: EASINGS.calm }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.08 }
    }
  },

  default: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.22 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.14 } }
  }
};
