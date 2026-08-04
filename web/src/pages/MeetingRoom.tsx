import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import type { RoomOptions } from 'livekit-client';
import { VideoPresets } from 'livekit-client';
import { MeetingLayout } from '../components/MeetingLayout';
import { useSingleTabLock } from '../hooks/useSingleTabLock';
import '@livekit/components-styles';

export default function MeetingRoom() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name');
  const navigate = useNavigate();

  const { isDuplicate, claimLock } = useSingleTabLock(id);

  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [disconnected, setDisconnected] = useState(false);

  const videoEnabled = searchParams.get('video') === 'true';
  const audioEnabled = searchParams.get('audio') === 'true';

  const fetchedRef = useRef(false);

  // LiveKit Enterprise Room Configuration (Google Meet Parity)
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: {
        pixelDensity: 'screen',
      },
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        // Single high-quality 1080p @ 30 FPS layer for screen share (no simulcast downscaling for text sharpness)
        screenShareEncoding: {
          maxBitrate: 3_500_000,
          maxFramerate: 30,
        },
        screenShareSimulcastLayers: [],
        videoEncoding: {
          maxBitrate: 1_500_000,
          maxFramerate: 30,
        },
        videoSimulcastLayers: [
          VideoPresets.h720,
          VideoPresets.h360,
          VideoPresets.h180,
        ],
        dtx: true,
      },
    }),
    []
  );

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

  // ── Duplicate Tab State (Single-tab meeting enforcement) ─────────────────────
  if (isDuplicate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-[#09090b]">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold">Already in meeting in another tab</h2>
        <p className="text-gray-400 text-sm text-center max-w-md leading-relaxed">
          You are already attending this meeting in another tab or browser window. Meetings can only be active in one tab at a time to prevent audio feedback.
        </p>
        <button
          onClick={claimLock}
          className="mt-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/20 text-sm"
        >
          Use This Tab Instead
        </button>
      </div>
    );
  }

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
      options={roomOptions}
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
