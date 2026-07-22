import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PreJoin from './pages/PreJoin';
import MeetingRoom from './pages/MeetingRoom';

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <BrowserRouter>
        <Routes>
          <Route path="/meetings/:id" element={<PreJoin />} />
          <Route path="/meetings/:id/room" element={<MeetingRoom />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
