import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function PreJoin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, session } = useAuth();

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const [meetingState, setMeetingState] = useState<'idle' | 'loading' | 'pending' | 'accepted' | 'declined' | 'ended' | 'not_invited' | 'waiting_for_host'>('idle');


  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Start/stop camera preview
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      if (!videoEnabled) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraError(false);
      } catch {
        if (active) setCameraError(true);
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [videoEnabled]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [user, authLoading, navigate, location]);

  // Fetch meeting & invitation state
  useEffect(() => {
    if (!id || !user) {
      setMeetingState('idle');
      return;
    }

    let isMounted = true;

    const checkAccess = async () => {
      if (isMounted) setMeetingState('loading');
      
      try {
        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .select('id, host_id, status, end_time')
          .eq('id', id)
          .single();

        if (meetingError || !meeting) {
          if (isMounted) setMeetingState('not_invited');
          return;
        }

        // Removed end_time block so meetings don't expire

        if (meeting.status === 'completed') {
          if (isMounted) setMeetingState('ended');
          return;
        }

        // Host always has access
        if (meeting.host_id === user.id) {
          if (isMounted) setMeetingState('accepted');
          return;
        }

        // Non-host: Check invitation status first
        const { data: inv, error: invError } = await supabase
          .from('meeting_invitations')
          .select('status')
          .eq('meeting_id', id)
          .eq('user_id', user.id)
          .single();

        if (invError || !inv) {
          if (isMounted) setMeetingState('not_invited');
          return;
        }

        if (inv.status === 'pending') {
          if (isMounted) setMeetingState('pending');
          return;
        }
        
        if (inv.status === 'declined') {
          if (isMounted) setMeetingState('declined');
          return;
        }

        // Validate if host is active in meeting_participants
        const { data: hostParticipant } = await supabase
          .from('meeting_participants')
          .select('status')
          .eq('meeting_id', meeting.id)
          .eq('user_id', meeting.host_id)
          .eq('status', 'joined')
          .maybeSingle();

        if (!hostParticipant) {
          if (isMounted) setMeetingState('waiting_for_host');
          return;
        }

        if (isMounted) setMeetingState('accepted');

      } catch (err) {
        console.error('Error checking access:', err);
      }
    };

    checkAccess();

    const channel = supabase.channel(`invitation-web-${id}-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meeting_invitations', filter: `meeting_id=eq.${id}` },
        (payload) => {
          if (payload.new && payload.new.user_id === user.id) {
            setMeetingState(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const handleAcceptInvitation = async () => {
    if (!id || !user?.id) return;
    setMeetingState('accepted');
    try {
      // 1. Try directly updating via Supabase client (Client-side fail-safe)
      const { error: sbError } = await supabase
        .from('meeting_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('meeting_id', id)
        .eq('user_id', user.id);

      if (sbError) throw sbError;

      // 2. Proactively try synchronizing via API endpoint if it exists
      if (session?.access_token) {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
        await fetch(`${baseUrl}/api/meetings/${id}/invitations/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          }
        }).catch(err => console.warn('API Sync Warning:', err));
      }
    } catch (e) {
      console.error('Accept invitation failed:', e);
      setMeetingState('pending');
    }
  };

  const handleDeclineInvitation = async () => {
    if (!id || !user?.id) return;
    setMeetingState('declined');
    try {
      // 1. Try directly updating via Supabase client (Client-side fail-safe)
      const { error: sbError } = await supabase
        .from('meeting_invitations')
        .update({ status: 'declined' })
        .eq('meeting_id', id)
        .eq('user_id', user.id);

      if (sbError) throw sbError;

      if (session?.access_token) {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
        await fetch(`${baseUrl}/api/meetings/${id}/invitations/decline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          }
        }).catch(err => console.warn('API Sync Warning:', err));
      }
    } catch (e) {
      console.error('Decline invitation failed:', e);
      setMeetingState('pending');
    }
  };

  const handleJoin = () => {
    const query = new URLSearchParams({
      video: String(videoEnabled),
      audio: String(audioEnabled),
    });

    navigate(`/meetings/${id}/room?${query.toString()}`);
  };

  const handleOpenApp = () => {
    window.location.href = `coreflow://meetings/${id}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#09090b]">
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-blue-600/10 border-b border-blue-500/20 backdrop-blur-md z-50 flex items-center justify-between">
          <div className="text-sm">
            <p className="font-semibold text-white">CoreFlow App</p>
            <p className="text-gray-400 text-xs">For the best experience</p>
          </div>
          <button
            onClick={handleOpenApp}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full text-sm hover:bg-blue-700 transition-colors"
          >
            Open in App
          </button>
        </div>
      )}

      {/* Sign Out Button in top right */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/login', { replace: true });
          }}
          className="px-4 py-2 bg-[#2c2c2e] hover:bg-[#3c3c3e] text-white font-semibold rounded-lg transition-colors border border-white/10 text-sm shadow"
        >
          Sign Out
        </button>
      </div>

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14" />
                <rect x="3" y="7" width="12" height="10" rx="2" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl">CoreFlow</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Ready to join?</h1>
          <p className="text-gray-400 text-sm mt-1">Set up your camera and microphone before joining</p>
        </div>

        {/* Camera Preview */}
        <div className="relative aspect-video bg-[#1c1c1e] rounded-2xl overflow-hidden border border-white/10 mb-6">
          {videoEnabled && !cameraError ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 20L4 4M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14" />
                  <rect x="3" y="7" width="12" height="10" rx="2" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">{cameraError ? 'Camera unavailable' : 'Camera is off'}</p>
            </div>
          )}

          {/* Toggle buttons overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              type="button"
              onClick={() => setAudioEnabled(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all backdrop-blur-sm border ${
                audioEnabled
                  ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                  : 'bg-red-600/90 border-red-500 text-white'
              }`}
            >
              {audioEnabled ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                </svg>
              )}
              {audioEnabled ? 'Mic On' : 'Mic Off'}
            </button>

            <button
              type="button"
              onClick={() => setVideoEnabled(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all backdrop-blur-sm border ${
                videoEnabled
                  ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                  : 'bg-red-600/90 border-red-500 text-white'
              }`}
            >
              {videoEnabled ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14" />
                  <rect x="3" y="7" width="12" height="10" rx="2" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 16l4.553 2.069A1 1 0 0 0 22 17.155V6.845a1 1 0 0 0-1.447-.894L15 8M2 2l20 20M15 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1" />
                </svg>
              )}
              {videoEnabled ? 'Camera On' : 'Camera Off'}
            </button>
          </div>
        </div>


        {/* Join form / Invitation states */}
        <div className="space-y-4">
          {(meetingState === 'pending') && (
            <div className="space-y-3">
              <button 
                onClick={handleAcceptInvitation} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl px-4 py-4 transition-all shadow-lg"
              >
                Accept Invitation
              </button>
              <button 
                onClick={handleDeclineInvitation} 
                className="w-full bg-transparent hover:bg-red-500/10 border border-red-500/50 text-red-500 font-bold rounded-xl px-4 py-4 transition-all"
              >
                Decline
              </button>
            </div>
          )}

          {(meetingState === 'declined') && (
            <div className="w-full bg-[#2c2c2e] text-center rounded-xl px-4 py-4">
              <span className="text-gray-400 font-bold">Invitation Declined</span>
            </div>
          )}

          {(meetingState === 'ended') && (
            <div className="w-full bg-[#2c2c2e] text-center rounded-xl px-4 py-4">
              <span className="text-gray-400 font-bold">Meeting Ended</span>
            </div>
          )}

          {(meetingState === 'not_invited' && id) && (
            <div className="w-full bg-[#2c2c2e] text-center rounded-xl px-4 py-4">
              <span className="text-gray-400 font-bold">Access Denied</span>
            </div>
          )}

          {(meetingState === 'waiting_for_host') && (
            <div className="w-full bg-[#2c2c2e] text-center rounded-xl px-4 py-4">
              <span className="text-gray-400 font-bold">Waiting for host to join...</span>
            </div>
          )}

          {(meetingState === 'accepted' || meetingState === 'idle' || meetingState === 'loading' || (meetingState === 'not_invited' && !id)) && (
            <button
              onClick={handleJoin}
              disabled={!id || meetingState === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-[#2c2c2e] disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl px-4 py-4 transition-all shadow-lg shadow-blue-600/20"
            >
              {meetingState === 'loading' ? 'Checking Access...' : 'Join Meeting'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
