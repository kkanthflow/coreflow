import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { MeetingLayout } from '../components/MeetingLayout';
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

  const videoEnabled = searchParams.get('video') === 'true';
  const audioEnabled = searchParams.get('audio') === 'true';

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!name) {
      navigate(`/meetings/${id}`, { replace: true });
      return;
    }

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
  }, [id, name]);

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

  // ── Disconnected State (after leaving meeting) ───────────────────────────────
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

  // ── Active Room ──────────────────────────────────────────────────────────────
  return (
    <LiveKitRoom
      video={videoEnabled}
      audio={audioEnabled}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      onDisconnected={() => setDisconnected(true)}
      onError={(err) => setError(err?.message || 'Connection failed. Please try again.')}
      className="h-screen w-full bg-[#09090b]"
      data-lk-theme="default"
    >
      <MeetingLayout meetingId={id!} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
