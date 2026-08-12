import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import type { RoomOptions } from 'livekit-client';
import { VideoPresets } from 'livekit-client';
import { MeetingLayout } from '../components/MeetingLayout';
import { useSingleTabLock } from '../hooks/useSingleTabLock';
import { supabase } from '../lib/supabase';
import '@livekit/components-styles';

export default function MeetingRoom() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();

  const { isDuplicate, claimLock } = useSingleTabLock(id);

  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  const videoEnabled = searchParams.get('video') === 'true';
  const audioEnabled = searchParams.get('audio') === 'true';

  // LiveKit Enterprise Room Configuration (Google Meet Parity)
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: true, // Auto scale rendering elements to match DOM tile sizes
      dynacast: true,      // Automatically pause video layers not visible to other participants
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      publishDefaults: {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        // Single high-quality 1080p @ 30 FPS layer for screen share (no simulcast downscaling for text sharpness)
        screenShareEncoding: {
          maxBitrate: 3_500_000,
          maxFramerate: 30,
        },
        screenShareSimulcastLayers: [],
        videoEncoding: {
          maxBitrate: 3_000_000, // Elevated bitrate back to 3Mbps to carry high definition 1080p details
          maxFramerate: 24,      // 24fps delivers cinema-smooth video without heavy network packet delays
        },
        videoSimulcastLayers: [
          VideoPresets.h1080,
          VideoPresets.h720,
          VideoPresets.h360,
        ],
        dtx: true,
        backupCodec: true, // Enable fallback codecs if primary has high latency
      },
      videoCaptureDefaults: {
        resolution: {
          width: 1920,
          height: 1080,
          frameRate: 24,
        },
        facingMode: 'user',
      },
      // Real-time audio configurations
      latency: false,
    }),
    []
  );

  useEffect(() => {
    if (authLoading) return;
    if (!session?.access_token) {
      navigate('/login', { state: { from: location }, replace: true });
      return;
    }

    let isMounted = true;
    
    const fetchToken = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
        const res = await fetch(`${apiUrl}/api/meetings/${id}/join`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
        });

        if (!res.ok) {
          const bodyText = await res.text();
          try {
            const errBody = JSON.parse(bodyText);
            if (errBody.error === 'waiting_room') {
              if (isMounted) setIsWaiting(true);
              return;
            }
            throw new Error(errBody.error || errBody.details || `Failed to join meeting: ${res.statusText}`);
          } catch (e: any) {
            if (e.message.includes('Failed to join meeting')) throw e;
            throw new Error(`Failed to join meeting: ${res.statusText}`);
          }
        }

        const data = await res.json();
        
        if (!data.token || !data.roomUrl) {
          throw new Error('Invalid response from meeting server');
        }

        if (isMounted) {
          setToken(data.token);
          setServerUrl(data.roomUrl);
          setIsWaiting(false);
        }
      } catch (err: any) {
        console.error('Failed to fetch token:', err);
        if (isMounted) {
          setError(err.message || 'Failed to connect to meeting room');
        }
      }
    };

    fetchToken();

    // Subscribe to admission_status updates to join automatically when approved
    const channel = supabase
      .channel(`waiting_room_web_${id}_${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meeting_participants',
          filter: `meeting_id=eq.${id}`,
        },
        (payload) => {
          if (payload.new.user_id === session.user.id && payload.new.admission_status === 'admitted') {
            fetchToken();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id, session, authLoading, navigate, location]);

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

  // ── Waiting Room State (Google Meet style) ──────────────────────────────────
  if (isWaiting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 bg-[#09090b] relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute w-[300px] h-[300px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
        
        {/* Animated pulse ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-full border border-blue-500/20 animate-ping opacity-75" />
          <div className="w-16 h-16 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        </div>

        <div className="text-center max-w-sm relative z-10">
          <h2 className="text-white text-xl font-bold mb-2">Waiting for the host</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            The meeting room is locked until the host joins. Once they arrive, you will join the room automatically.
          </p>
        </div>

        <button
          onClick={() => navigate('/meetings', { replace: true })}
          className="mt-2 px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium rounded-xl transition-all border border-white/5 text-sm"
        >
          Return to Dashboard
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
      video={videoEnabled ? { resolution: VideoPresets.h1080 } : false}
      audio={audioEnabled ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false}
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
