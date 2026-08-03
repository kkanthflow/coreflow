import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MeetingRoom from './pages/MeetingRoom';
import Home from './pages/Home';

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <BrowserRouter>
        <Routes>
          {/* Single-screen meeting: handles both pre-join and room */}
          <Route path="/meetings/:id" element={<MeetingRoom />} />
          <Route path="/meetings/:id/room" element={<Navigate to="../" replace />} />
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
