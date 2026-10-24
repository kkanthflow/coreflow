import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { WorkspaceProvider } from './hooks/useWorkspace';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { trpc } from './lib/trpc';
import { supabase } from './lib/supabase';
import AppShell from './components/AppShell';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Eagerly loaded
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';

// Lazy loaded pages with auto-recovery on new deployment chunk changes
const RegisterSetup   = lazyWithRetry(() => import('./pages/RegisterSetup'));
const AcceptInvite    = lazyWithRetry(() => import('./pages/AcceptInvite'));
const Dashboard       = lazyWithRetry(() => import('./pages/Dashboard'));
const WorkflowDashboard = lazyWithRetry(() => import('./pages/workflows/WorkflowDashboard'));
const WorkflowBuilder   = lazyWithRetry(() => import('./pages/workflows/WorkflowBuilder'));
const WorkflowTemplates = lazyWithRetry(() => import('./pages/workflows/WorkflowTemplates'));
const WorkflowHistory   = lazyWithRetry(() => import('./pages/workflows/WorkflowHistory'));
const WorkflowApprovals = lazyWithRetry(() => import('./pages/workflows/WorkflowApprovals'));
const Projects        = lazyWithRetry(() => import('./pages/Projects'));
const NewProject      = lazyWithRetry(() => import('./pages/NewProject'));
const ProjectDetails  = lazyWithRetry(() => import('./pages/ProjectDetails'));
const ClientProjectRoom = lazyWithRetry(() => import('./pages/ClientProjectRoom'));
const Tasks           = lazyWithRetry(() => import('./pages/Tasks'));
const Calendar        = lazyWithRetry(() => import('./pages/Calendar'));
const Meetings        = lazyWithRetry(() => import('./pages/Meetings'));
const NewMeeting      = lazyWithRetry(() => import('./pages/NewMeeting'));
const Chat            = lazyWithRetry(() => import('./pages/Chat'));
const ChatRoom        = lazyWithRetry(() => import('./pages/ChatRoom'));
const Employees       = lazyWithRetry(() => import('./pages/Employees'));
const EmployeeProfile = lazyWithRetry(() => import('./pages/EmployeeProfile'));
const Departments     = lazyWithRetry(() => import('./pages/Departments'));
const Clients         = lazyWithRetry(() => import('./pages/Clients'));
const Invoices        = lazyWithRetry(() => import('./pages/Invoices'));
const NewInvoice      = lazyWithRetry(() => import('./pages/NewInvoice'));
const InvoiceDetail   = lazyWithRetry(() => import('./pages/InvoiceDetail'));
const Payments        = lazyWithRetry(() => import('./pages/Payments'));
const Analytics       = lazyWithRetry(() => import('./pages/Analytics'));
const Settings        = lazyWithRetry(() => import('./pages/Settings'));
const PreJoin         = lazyWithRetry(() => import('./pages/PreJoin'));
const MeetingRoom     = lazyWithRetry(() => import('./pages/MeetingRoom'));
const AuditLogs       = lazyWithRetry(() => import('./pages/AuditLogs'));
const Privacy         = lazyWithRetry(() => import('./pages/Privacy'));
const Terms           = lazyWithRetry(() => import('./pages/Terms'));
const Contact         = lazyWithRetry(() => import('./pages/Contact'));
const Pricing         = lazyWithRetry(() => import('./pages/Pricing'));
const Notifications   = lazyWithRetry(() => import('./pages/Notifications'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center text-main">
      <div className="w-10 h-10 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs font-mono text-muted tracking-wider">LOADING MODULE...</span>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, onboardingStatus } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center text-main">
        <div className="w-10 h-10 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted text-sm">Authenticating session...</p>
      </div>
    );
  }
    if (!session?.user?.id) return <Navigate to="/" replace />;
    if (onboardingStatus === 'setup_required') {
      return <Navigate to="/register/setup" replace />;
    }
    return <>{children}</>;
  }

  // Smart root: redirect authenticated users to dashboard, client portal, or setup, else show landing
  function RootRoute() {
    const { session, loading, onboardingStatus, role } = useAuth();
    if (loading) {
      return (
        <div className="min-h-screen bg-app flex flex-col items-center justify-center text-main">
          <div className="w-10 h-10 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted text-sm">Loading...</p>
        </div>
      );
    }
    const pendingToken = getStoredInviteToken();
    if (pendingToken) {
      return <Navigate to={`/invite/client?token=${encodeURIComponent(pendingToken)}`} replace />;
    }
    if (session?.user?.id) {
      if (role === 'client') {
        return <Navigate to="/projects" replace />;
      }
      if (onboardingStatus === 'setup_required') {
        return <Navigate to="/register/setup" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
    return <Landing />;
  }

  // Redirect already-logged-in users away from auth pages
  function GuestRoute({ children }: { children: React.ReactNode }) {
    const { session, loading, onboardingStatus } = useAuth();
    if (loading) {
      return (
        <div className="min-h-screen bg-app flex flex-col items-center justify-center text-main">
          <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    const pendingToken = getStoredInviteToken();
    if (session?.user?.id) {
      if (pendingToken) {
        return <Navigate to={`/invite/client?token=${encodeURIComponent(pendingToken)}`} replace />;
      }
      if (onboardingStatus === 'setup_required') {
        return <Navigate to="/register/setup" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { getStoredInviteToken } from './lib/inviteTokenStorage';

function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
          transformer: superjson as any,
          async headers() {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ThemeProvider>
              <div className="min-h-screen bg-bg text-text antialiased">
                <AuthProvider>
                  <WorkspaceProvider>
                    <SettingsProvider>
                      <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<RootRoute />} />
                    <Route path="/landing" element={<Landing />} />
                    <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                    <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
                    <Route path="/privacy-policy" element={<Suspense fallback={<PageLoader />}><Privacy /></Suspense>} />
                    <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><Privacy /></Suspense>} />
                    <Route path="/terms" element={<Suspense fallback={<PageLoader />}><Terms /></Suspense>} />
                    <Route path="/terms-and-conditions" element={<Suspense fallback={<PageLoader />}><Terms /></Suspense>} />
                    <Route path="/terms-of-service" element={<Suspense fallback={<PageLoader />}><Terms /></Suspense>} />
                    <Route path="/contact" element={<Suspense fallback={<PageLoader />}><Contact /></Suspense>} />
                    <Route path="/pricing" element={<Suspense fallback={<PageLoader />}><Pricing /></Suspense>} />

                    <Route path="/register/setup" element={<Suspense fallback={<PageLoader />}><RegisterSetup /></Suspense>} />
                    <Route path="/onboarding" element={<Navigate to="/register/setup" replace />} />
                    <Route path="/invite/client" element={<Suspense fallback={<PageLoader />}><AcceptInvite /></Suspense>} />
                    <Route path="/accept-invite" element={<Suspense fallback={<PageLoader />}><AcceptInvite /></Suspense>} />

                    {/* ── All shell-wrapped protected routes ── */}
                    <Route element={<AuthGuard><AppShell /></AuthGuard>}>
                      <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                      
                      {/* Workflows */}
                      <Route path="/workflows" element={<Suspense fallback={<PageLoader />}><WorkflowDashboard /></Suspense>} />
                      <Route path="/workflows/new" element={<Suspense fallback={<PageLoader />}><WorkflowBuilder /></Suspense>} />
                      <Route path="/workflows/:id/edit" element={<Suspense fallback={<PageLoader />}><WorkflowBuilder /></Suspense>} />
                      <Route path="/workflows/templates" element={<Suspense fallback={<PageLoader />}><WorkflowTemplates /></Suspense>} />
                      <Route path="/workflows/history" element={<Suspense fallback={<PageLoader />}><WorkflowHistory /></Suspense>} />
                      <Route path="/workflows/:id/history" element={<Suspense fallback={<PageLoader />}><WorkflowHistory /></Suspense>} />
                      <Route path="/workflows/approvals" element={<Suspense fallback={<PageLoader />}><WorkflowApprovals /></Suspense>} />

                      {/* Projects */}
                      <Route path="/projects"  element={<Suspense fallback={<PageLoader />}><Projects /></Suspense>} />
                      <Route path="/projects/new" element={<Suspense fallback={<PageLoader />}><NewProject /></Suspense>} />
                      <Route path="/projects/:id" element={<Suspense fallback={<PageLoader />}><ProjectDetails /></Suspense>} />
                      <Route path="/projects/:id/client-room" element={<Suspense fallback={<PageLoader />}><ClientProjectRoom /></Suspense>} />
                      
                      {/* Tasks */}
                      <Route path="/tasks"     element={<Suspense fallback={<PageLoader />}><Tasks /></Suspense>} />
                      <Route path="/tasks/:id" element={<Suspense fallback={<PageLoader />}><Tasks /></Suspense>} />
                      
                      {/* Calendar */}
                      <Route path="/calendar"  element={<Suspense fallback={<PageLoader />}><Calendar /></Suspense>} />
                      
                      {/* Meetings */}
                      <Route path="/meetings"  element={<Suspense fallback={<PageLoader />}><Meetings /></Suspense>} />
                      <Route path="/meetings/new" element={<Suspense fallback={<PageLoader />}><NewMeeting /></Suspense>} />
                      <Route path="/meetings/instant" element={<Suspense fallback={<PageLoader />}><NewMeeting /></Suspense>} />
                      
                      {/* Chat */}
                      <Route path="/chat"      element={<Suspense fallback={<PageLoader />}><Chat /></Suspense>} />
                      <Route path="/chat/:channelId" element={<Suspense fallback={<PageLoader />}><ChatRoom /></Suspense>} />
                      
                      {/* Employees */}
                      <Route path="/employees" element={<Suspense fallback={<PageLoader />}><Employees /></Suspense>} />
                      <Route path="/employees/:id" element={<Suspense fallback={<PageLoader />}><EmployeeProfile /></Suspense>} />
                      
                      {/* Departments & Clients */}
                      <Route path="/departments" element={<Suspense fallback={<PageLoader />}><Departments /></Suspense>} />
                      <Route path="/clients"   element={<Suspense fallback={<PageLoader />}><Clients /></Suspense>} />
                      
                      {/* Invoices & Payments */}
                      <Route path="/invoices"  element={<Suspense fallback={<PageLoader />}><Invoices /></Suspense>} />
                      <Route path="/invoices/new" element={<Suspense fallback={<PageLoader />}><NewInvoice /></Suspense>} />
                      <Route path="/invoices/:id" element={<Suspense fallback={<PageLoader />}><InvoiceDetail /></Suspense>} />
                      <Route path="/invoices/:id/edit" element={<Suspense fallback={<PageLoader />}><NewInvoice /></Suspense>} />
                      <Route path="/payments"  element={<Suspense fallback={<PageLoader />}><Payments /></Suspense>} />
                      
                      {/* Analytics & Settings & Audit Logs & Billing */}
                      <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
                      <Route path="/settings"  element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                      <Route path="/billing"   element={<Navigate to="/settings?tab=billing" replace />} />
                      <Route path="/subscription" element={<Navigate to="/settings?tab=billing" replace />} />
                      <Route path="/audit-logs" element={<Suspense fallback={<PageLoader />}><AuditLogs /></Suspense>} />
                      <Route path="/notifications" element={<Suspense fallback={<PageLoader />}><Notifications /></Suspense>} />
                    </Route>

                    {/* ── Standalone meeting routes (no shell, full-screen) ── */}
                    <Route path="/meetings/:id"      element={<AuthGuard><Suspense fallback={<PageLoader />}><PreJoin /></Suspense></AuthGuard>} />
                    <Route path="/meetings/:id/room" element={<AuthGuard><Suspense fallback={<PageLoader />}><MeetingRoom /></Suspense></AuthGuard>} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  </BrowserRouter>
                    </SettingsProvider>
                </WorkspaceProvider>
              </AuthProvider>
            </div>
          </ThemeProvider>
        </ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
    </ErrorBoundary>
  );
}

export default App;
