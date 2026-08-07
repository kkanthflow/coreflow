import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MeetingRoom from './pages/MeetingRoom';
import PreJoin from './pages/PreJoin';
// @ts-ignore - IDE caching issue, tsc passes
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/meetings/:id" element={<PreJoin />} />
            <Route path="/meetings/:id/room" element={<MeetingRoom />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
