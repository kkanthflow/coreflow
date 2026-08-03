import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

export default function MeetingRoom() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name');
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [disconnected, setDisconnected] = useState(false);

  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const defaultNotesTemplate = `# Meeting Notes\n\n**Agenda:**\n- \n\n**Decisions:**\n- \n\n**Action Items:**\n- `;
  const [notesText, setNotesText] = useState(() => {
    const saved = localStorage.getItem(`meeting_notes_${id}`);
    return saved || defaultNotesTemplate;
  });

  const videoEnabled = searchParams.get('video') === 'true';
  const audioEnabled = searchParams.get('audio') === 'true';

  // Use a ref to track mount state, preventing navigate from causing re-runs
  const fetchedRef = useRef(false);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotesText(val);
    localStorage.setItem(`meeting_notes_${id}`, val);
  };

  useEffect(() => {
    if (!name) {
      navigate(`/meetings/${id}`, { replace: true });
      return;
    }

    // Prevent double-fetching in StrictMode
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchToken = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-one.vercel.app';
        const res = await fetch(`${apiUrl}/api/meetings/${id}/join-guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Server error ${res.status}: ${body}`);
        }

        const data = await res.json();
        if (!data.token || !data.roomUrl) {
          throw new Error('Invalid response from server — missing token or room URL');
        }
        setToken(data.token);
        setServerUrl(data.roomUrl);
      } catch (err: any) {
        setError(err.message || 'Failed to join meeting');
      }
    };

    fetchToken();
  }, [id, name]); // removed navigate from deps intentionally

  // ── Error State ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-[#09090b]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold">Couldn't join the meeting</h2>
        <p className="text-gray-400 text-sm text-center max-w-sm">{error}</p>
        <button
          onClick={() => navigate(`/meetings/${id}`, { replace: true })}
          className="mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Disconnected State (after leaving meeting normally) ───────────────────────
  if (disconnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-[#09090b]">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold">You've left the meeting</h2>
        <p className="text-gray-400 text-sm">The meeting has ended or you disconnected.</p>
        <button
          onClick={() => navigate(`/meetings/${id}`, { replace: true })}
          className="mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
        >
          Rejoin Meeting
        </button>
      </div>
    );
  }

  // ── Loading State ─────────────────────────────────────────────────────────────
  if (!token || !serverUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#09090b]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
        <p className="text-gray-400 text-sm">Joining meeting...</p>
      </div>
    );
  }

  const handleShare = async () => {
    const url = window.location.origin + `/meetings/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my CoreFlow Meeting', url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      alert('Meeting link copied to clipboard!');
    }
  };

  // ── Room ──────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-[#09090b] flex flex-col relative" data-lk-theme="default">
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setIsNotesOpen(!isNotesOpen)}
          className="flex items-center gap-2 bg-slate-800/80 backdrop-blur hover:bg-slate-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-lg border border-white/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
          Notes
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 bg-blue-600/80 backdrop-blur hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-lg border border-white/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share
        </button>
      </div>

      <div className="flex-1 flex w-full h-full">
        <LiveKitRoom
          video={videoEnabled}
          audio={audioEnabled}
          token={token}
          serverUrl={serverUrl}
          connect={true}
          onDisconnected={() => setDisconnected(true)}
          onError={(err) => setError(err?.message || 'Connection failed. Please try again.')}
          className={`flex-1 transition-all ${isNotesOpen ? 'w-2/3' : 'w-full'}`}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>

        {isNotesOpen && (
          <div className="w-1/3 h-full bg-[#09090b] border-l border-white/10 flex flex-col absolute right-0 top-0 bottom-0 z-40">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#09090b]">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                My Notes
              </h3>
              <button onClick={() => setIsNotesOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <textarea
              className="flex-1 p-4 bg-transparent text-gray-200 outline-none resize-none font-mono text-sm"
              placeholder="Type your notes here..."
              value={notesText}
              onChange={handleNotesChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
