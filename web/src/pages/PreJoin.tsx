import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Video, Mic, MicOff, VideoOff, LogOut, Smartphone, Calendar, Shield } from 'lucide-react';
import AuvrynLogo from '../components/AuvrynLogo';

const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function PreJoin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [meetingState, setMeetingState] = useState<'idle' | 'loading' | 'pending' | 'accepted' | 'declined' | 'ended' | 'not_invited' | 'waiting_for_host'>('idle');
  const [meetingDetails, setMeetingDetails] = useState<any>(null);

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

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (active) {
          console.error("Media devices API not available");
          setCameraError("Browser doesn't support camera or blocked by environment");
        }
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
        setCameraError('');
      } catch (err: any) {
        if (active) {
          setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied in browser.' : (err.message || 'Unknown error'));
        }
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
          .select('id, host_id, workspace_id, status, end_time, title, description, start_time')
          .eq('id', id)
          .single();

        if (meetingError || !meeting) {
          if (isMounted) setMeetingState('not_invited');
          return;
        }

        if (isMounted) {
          setMeetingDetails(meeting);
        }

        if (meeting.status === 'completed') {
          if (isMounted) setMeetingState('ended');
          return;
        }

        if (meeting.host_id === user.id) {
          if (isMounted) setMeetingState('accepted');
          return;
        }

        // 1. Check meeting_participants first
        const { data: part } = await supabase
          .from('meeting_participants')
          .select('status, admission_status')
          .eq('meeting_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (part && (part.admission_status === 'admitted' || part.status === 'accepted' || part.status === 'joined')) {
          if (isMounted) setMeetingState('accepted');
          return;
        }

        // 2. Check meeting_invitations
        const { data: inv } = await supabase
          .from('meeting_invitations')
          .select('status')
          .eq('meeting_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (inv) {
          if (isMounted) setMeetingState(inv.status as any);
          return;
        }

        if (part) {
          if (isMounted) setMeetingState('pending');
          return;
        }

        // 3. Check if user is a member of the organization hosting the meeting
        if (meeting.workspace_id) {
          const { data: wsData } = await supabase
            .from('workspaces')
            .select('organization_id')
            .eq('id', meeting.workspace_id)
            .maybeSingle();

          if (wsData?.organization_id) {
            const { data: uo } = await supabase
              .from('user_organizations')
              .select('id')
              .eq('org_id', wsData.organization_id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (uo) {
              if (isMounted) setMeetingState('accepted');
              return;
            }
          }
        }

        if (isMounted) setMeetingState('not_invited');

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
    if (!id || !user) return;
    try {
      setMeetingState('accepted');
      await supabase.rpc('respond_to_meeting_invitation', {
        p_meeting_id: id,
        p_status: 'accepted',
      });

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (token) {
        fetch(`${baseUrl}/api/meetings/${id}/invitations/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }
        }).catch(err => console.warn('API Sync Warning:', err));
      }
    } catch (e) {
      console.error('Accept invitation failed:', e);
      setMeetingState('pending');
    }
  };

  const handleDeclineInvitation = async () => {
    if (!id || !user) return;
    try {
      setMeetingState('declined');
      await supabase.rpc('respond_to_meeting_invitation', {
        p_meeting_id: id,
        p_status: 'declined',
      });

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (token) {
        fetch(`${baseUrl}/api/meetings/${id}/invitations/decline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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
      video: String(videoEnabled && !cameraError),
      audio: String(audioEnabled),
    });

    navigate(`/meetings/${id}/room?${query.toString()}`);
  };

  const handleOpenApp = () => {
    window.location.href = `coreflow://meetings/${id}`;
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-app p-4 sm:p-6 lg:p-8">
      {/* Background Mesh Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] left-[20%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#FF6B4A]/15 via-[#FF4500]/5 to-transparent blur-[140px] animate-float-slow" />
        <div className="absolute -bottom-[20%] right-[10%] w-[550px] h-[550px] rounded-full bg-gradient-to-tl from-blue-600/10 via-purple-600/5 to-transparent blur-[140px] animate-float-delayed" />
      </div>

      {isMobile && (
        <div className="fixed top-0 left-0 right-0 p-3.5 bg-hover/90 border-b border-divider backdrop-blur-xl z-50 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FF6B4A] to-[#FF8E75] flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-main" />
            </div>
            <div>
              <p className="font-bold text-main text-xs">AUVRYN Mobile</p>
              <p className="text-muted text-[10px]">Optimized for mobile calling</p>
            </div>
          </div>
          <button
            onClick={handleOpenApp}
            className="px-3 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-bold rounded-xl text-xs transition-colors shadow-md shadow-[#FF6B4A]/20"
          >
            Open in App
          </button>
        </div>
      )}

      {/* Top Navbar Actions */}
      <div className="absolute top-6 left-6 right-6 z-40 flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-divider backdrop-blur-md">
          <AuvrynLogo size={14} />
          <span className="text-main font-bold text-sm tracking-tight">AUVRYN</span>
        </div>

        <button 
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/', { replace: true });
          }}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-muted hover:text-main border border-divider text-xs font-semibold backdrop-blur-md transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-xl glass-panel rounded-3xl p-6 sm:p-8 mt-12 mb-4">
        {/* Meeting Header */}
        <div className="text-center mb-6">
          {meetingDetails ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B4A]/10 border border-[#FF6B4A]/20 text-muted text-xs font-bold uppercase tracking-wider mb-3">
                <Shield className="w-3.5 h-3.5" />
                <span>Enterprise Meeting</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">{meetingDetails.title}</h1>
              {meetingDetails.description && (
                <p className="text-muted text-sm mt-1.5 max-w-md mx-auto">{meetingDetails.description}</p>
              )}
              {meetingDetails.start_time && (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-muted mt-3 px-3 py-1 rounded-lg bg-white/[0.04] border border-divider">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  <span>{new Date(meetingDetails.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">Ready to join?</h1>
              <p className="text-muted text-sm mt-1 font-medium">Verify your audio and video stream before entering</p>
            </>
          )}
        </div>

        {/* Video Preview Box (Spatial Anchor Motion) */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-video w-full rounded-2xl overflow-hidden bg-app border border-divider shadow-inner mb-6 flex items-center justify-center"
        >
          {videoEnabled && !cameraError ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-divider flex items-center justify-center mb-3">
                <VideoOff className="w-7 h-7 text-muted" />
              </div>
              <p className="text-muted text-sm font-medium">
                {cameraError ? cameraError : 'Camera is muted'}
              </p>
            </div>
          )}

          {/* Floating Camera / Audio Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-divider shadow-2xl">
            <button
              type="button"
              onClick={() => setAudioEnabled(v => !v)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                audioEnabled
                  ? 'bg-white/15 text-main hover:bg-white/25 border border-divider'
                  : 'bg-red-500 text-main shadow-lg shadow-red-500/25'
              }`}
            >
              {audioEnabled ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>{audioEnabled ? 'Mic On' : 'Mic Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => setVideoEnabled(v => !v)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                videoEnabled
                  ? 'bg-white/15 text-main hover:bg-white/25 border border-divider'
                  : 'bg-red-500 text-main shadow-lg shadow-red-500/25'
              }`}
            >
              {videoEnabled ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5" />}
              <span>{videoEnabled ? 'Cam On' : 'Cam Off'}</span>
            </button>
          </div>
        </motion.div>

        {/* Join Actions */}
        <div className="space-y-3">
          {meetingState === 'pending' && (
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleAcceptInvitation} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-main font-bold rounded-2xl py-3.5 text-sm transition-all shadow-lg shadow-emerald-600/20"
              >
                Accept Invitation
              </button>
              <button 
                onClick={handleDeclineInvitation} 
                className="w-full bg-white/[0.04] hover:bg-red-500/10 border border-divider hover:border-red-500/30 text-muted hover:text-red-400 font-bold rounded-2xl py-3.5 text-sm transition-all"
              >
                Decline
              </button>
            </div>
          )}

          {meetingState === 'declined' && (
            <div className="w-full bg-white/[0.03] border border-divider text-center rounded-2xl py-3.5">
              <span className="text-muted font-bold text-sm">Invitation Declined</span>
            </div>
          )}

          {meetingState === 'ended' && (
            <div className="w-full bg-white/[0.03] border border-divider text-center rounded-2xl py-3.5">
              <span className="text-muted font-bold text-sm">Meeting Ended</span>
            </div>
          )}

          {meetingState === 'not_invited' && id && (
            <div className="w-full bg-red-500/10 border border-red-500/20 text-center rounded-2xl py-3.5">
              <span className="text-red-300 font-bold text-sm">Access Denied - Not Invited</span>
            </div>
          )}

          {(meetingState === 'accepted' || meetingState === 'idle' || meetingState === 'loading' || (meetingState === 'not_invited' && !id)) && (
            <button
              onClick={handleJoin}
              disabled={!id || meetingState === 'loading'}
              className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF6B4A] via-[#FF5722] to-[#FF4500] text-main font-bold py-3.5 text-sm shadow-xl shadow-[#FF6B4A]/25 hover:shadow-2xl hover:shadow-[#FF6B4A]/35 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {meetingState === 'loading' ? 'Checking Access...' : 'Join Meeting Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
