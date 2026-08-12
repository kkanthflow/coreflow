import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MeetingRoom from './pages/MeetingRoom';
import PreJoin from './pages/PreJoin';
// @ts-ignore - IDE caching issue, tsc passes
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import { AuthProvider, useAuth } from './hooks/useAuth';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070B] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Authenticating session...</p>
      </div>
    );
  }

  if (!session?.user?.id) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session?.user?.id ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
            <Route path="/meetings/:id" element={<AuthGuard><PreJoin /></AuthGuard>} />
            <Route path="/meetings/:id/room" element={<AuthGuard><MeetingRoom /></AuthGuard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
