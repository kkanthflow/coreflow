import { useState, useRef, useEffect } from 'react';
import { useRoomContext, Chat } from '@livekit/components-react';
import { StageView } from './StageView';
import { MeetingControls } from './MeetingControls';
import { DiagnosticsOverlay } from './DiagnosticsOverlay';
import { supabase } from '../lib/supabase';
import ConfirmModal from './ConfirmModal';

interface MeetingLayoutProps {
  meetingId: string;
}

import { toast } from './ui/Toast';
import AuvrynLogo from './AuvrynLogo';

export function MeetingLayout({ meetingId }: MeetingLayoutProps) {
  const room = useRoomContext();

  const [activeDrawer, setActiveDrawer] = useState<'notes' | 'chat' | null>(null);
  const defaultNotesTemplate = `# Meeting Notes\n\n**Agenda:**\n- \n\n**Decisions:**\n- \n\n**Action Items:**\n- `;
  const [notesText, setNotesText] = useState(defaultNotesTemplate);
  const [egressId, setEgressId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const recordingStartTime = useRef<number | null>(null);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';

  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);

  // Setup waiting room for host
  useEffect(() => {
    let channel: any;
    
    const setupWaitingRoom = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: meeting } = await supabase
        .from('meetings')
        .select('host_id')
        .eq('id', meetingId)
        .single();
        
      if (meeting?.host_id === session.user.id) {
        setIsHost(true);
        
        const fetchWaiting = async () => {
          const { data } = await supabase
            .from('meeting_participants')
            .select('user_id, users:user_id(full_name, email)')
            .eq('meeting_id', meetingId)
            .eq('admission_status', 'waiting');
            
          if (data) setWaitingParticipants(data);
        };
        fetchWaiting();
        
        channel = supabase.channel(`host_waiting_${meetingId}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'meeting_participants',
            filter: `meeting_id=eq.${meetingId}`
          }, () => {
            fetchWaiting();
          }).subscribe();
      }
    };
    
    setupWaitingRoom();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const handleAdmit = async (userId: string) => {
    try {
      setWaitingParticipants(prev => prev.filter(p => p.user_id !== userId));
      await supabase
        .from('meeting_participants')
        .update({ admission_status: 'admitted' })
        .eq('meeting_id', meetingId)
        .eq('user_id', userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${apiUrl}/api/meetings/${meetingId}/participants/${userId}/admit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` }
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to admit participant', e);
    }
  };

  const handleDeny = async (userId: string) => {
    try {
      setWaitingParticipants(prev => prev.filter(p => p.user_id !== userId));
      await supabase
        .from('meeting_participants')
        .update({ admission_status: 'rejected' })
        .eq('meeting_id', meetingId)
        .eq('user_id', userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${apiUrl}/api/meetings/${meetingId}/participants/${userId}/deny`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` }
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to deny participant', e);
    }
  };

  const handleAdmitAll = async () => {
    const list = [...waitingParticipants];
    setWaitingParticipants([]);
    for (const p of list) {
      handleAdmit(p.user_id);
    }
  };

  // Fetch initial notes
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/notes`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.notes?.content) {
            setNotesText(data.notes.content);
          }
        }
      } catch (e) {
        console.error('Failed to fetch notes:', e);
      }
    };
    fetchNotes();
  }, [meetingId]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotesText(val);
    
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch(`${apiUrl}/api/meetings/${meetingId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ content: val })
        });
      } catch (e) {
        console.error('Failed to save notes:', e);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const handleLeave = () => {
    room.disconnect();
  };

  const [isConfirmEndOpen, setIsConfirmEndOpen] = useState(false);

  const confirmEndMeeting = async () => {
    setIsConfirmEndOpen(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      await fetch(`${apiUrl}/api/meetings/${meetingId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      room.disconnect();
    } catch (e) {
      console.error('Failed to end meeting', e);
    }
  };

  const handleEndMeeting = () => {
    setIsConfirmEndOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.origin + `/meetings/${meetingId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my AUVRYN Meeting', url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Meeting link copied to clipboard!', 'Link Copied');
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const startBrowserRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error('Screen & audio recording is not supported in this browser.', 'Recording Unsupported');
        setIsRecording(false);
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true
      });
      screenStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `AUVRYN-Meeting-${new Date().toISOString().slice(0, 10)}.webm`;
          document.body.appendChild(a);
          a.click();
          toast.success('Meeting recording saved and downloaded successfully.', 'Recording Saved');
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
        }
      };

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopBrowserRecording();
        };
      }

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      recordingStartTime.current = Date.now();
    } catch (err: any) {
      console.warn('Browser recording canceled or rejected:', err);
      setIsRecording(false);
      recordingStartTime.current = null;
    }
  };

  const stopBrowserRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping browser recording:', e);
    }
    setIsRecording(false);
    recordingStartTime.current = null;
  };

  const handleToggleRecord = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (isRecording) {
        // Stop recording (either server egress or browser recording)
        if (egressId && session?.access_token) {
          try {
            await fetch(`${apiUrl}/api/meetings/${meetingId}/record/stop`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ egressId })
            });
          } catch {}
          setEgressId(null);
        }
        stopBrowserRecording();
        setIsRecording(false);
        recordingStartTime.current = null;
      } else {
        // Start recording: try backend egress, fallback directly to browser capture
        if (session?.access_token) {
          try {
            const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/record/start`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.egressId) {
                setEgressId(data.egressId);
                setIsRecording(true);
                recordingStartTime.current = Date.now();
                return;
              }
            }
          } catch {
            // Backend egress unavailable, fallback to browser recorder below
          }
        }

        // Fallback: start browser high-definition screen/tab recorder
        await startBrowserRecording();
      }
    } catch (err) {
      console.error('Recording error:', err);
      setIsRecording(false);
      setEgressId(null);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-app flex flex-col relative overflow-hidden select-none">
      {/* Top Bar Header */}
      <div className="h-14 px-3 md:px-6 border-b border-divider flex items-center justify-between bg-card-bg z-30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <AuvrynLogo size={14} color="white" />
          </div>
          <span className="text-main font-bold text-sm md:text-base tracking-wide">AUVRYN Meeting</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-hover hover:bg-hover text-main px-3 py-1.5 rounded-full text-xs font-semibold transition-all border border-divider shadow"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="hidden sm:inline">Share Meeting</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex w-full h-full min-h-0 relative overflow-hidden">
        {/* Stage View */}
        <div className={`flex-1 h-full transition-all duration-300 ${activeDrawer ? 'mr-[360px]' : ''}`}>
          <StageView />
        </div>

        {/* Notes Side Drawer */}
        {activeDrawer === 'notes' && (
          <div className="w-[360px] h-full bg-card-bg border-l border-divider flex flex-col absolute right-0 top-0 bottom-0 z-40 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-divider flex justify-between items-center bg-hover">
              <h3 className="text-main font-bold text-base flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Meeting Notes
              </h3>
              <button
                onClick={() => setActiveDrawer(null)}
                className="text-muted hover:text-main p-1 rounded-lg transition-colors"

              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <textarea
              className="flex-1 p-4 bg-transparent text-gray-200 outline-none resize-none font-mono text-sm leading-relaxed"
              placeholder="Type your meeting notes here..."
              value={notesText}
              onChange={handleNotesChange}
            />
          </div>
        )}

        {/* Chat Side Drawer */}
        {activeDrawer === 'chat' && (
          <div className="w-[360px] h-full bg-card-bg border-l border-divider flex flex-col absolute right-0 top-0 bottom-0 z-40 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-divider flex justify-between items-center bg-hover">
              <h3 className="text-main font-bold text-base flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Meeting Chat
              </h3>
              <button
                onClick={() => setActiveDrawer(null)}
                className="text-muted hover:text-main p-1 rounded-lg transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <Chat />
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics Overlay (WebRTC Telemetry) */}
      <DiagnosticsOverlay />

      {/* Waiting Room Notifications for Host */}
      {isHost && waitingParticipants.length > 0 && (
        <div className="absolute top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
          {waitingParticipants.length > 1 && (
            <div className="flex justify-end mb-1">
              <button
                onClick={handleAdmitAll}
                className="px-3 py-1 bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold rounded shadow-md transition-colors"
              >
                Admit All ({waitingParticipants.length})
              </button>
            </div>
          )}
          {waitingParticipants.map(p => {
            const name = p.users?.full_name || p.users?.email || p.user_id || 'Attendee';
            return (
              <div
                key={p.user_id}
                className="bg-card-bg/95 backdrop-blur border border-[#FF6B4A]/30 p-3.5 rounded-lg shadow-2xl animate-in slide-in-from-right flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-[#FF6B4A]/15 text-[#FF6B4A] font-bold text-xs flex items-center justify-center shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-main font-semibold truncate">{name}</p>
                    <p className="text-muted text-[10px]">Waiting in lobby...</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleDeny(p.user_id)}
                    className="px-2.5 py-1 bg-hover hover:bg-hover text-muted hover:text-main rounded text-[11px] font-medium border border-divider transition-colors"
                  >
                    Deny
                  </button>
                  <button 
                    onClick={() => handleAdmit(p.user_id)}
                    className="px-3 py-1 bg-[#FF6B4A] hover:bg-[#FF552B] text-main rounded text-[11px] font-semibold transition-colors shadow-sm"
                  >
                    Admit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Control Bar at Bottom */}
      <MeetingControls
        activeDrawer={activeDrawer}
        isRecording={isRecording}
        onToggleNotes={() => setActiveDrawer(v => v === 'notes' ? null : 'notes')}
        onToggleChat={() => setActiveDrawer(v => v === 'chat' ? null : 'chat')}
        onToggleRecord={handleToggleRecord}
        onLeave={handleLeave}
        isHost={isHost}
        onEndMeeting={handleEndMeeting}
      />

      <ConfirmModal
        isOpen={isConfirmEndOpen}
        title="End Meeting"
        message="Are you sure you want to end this meeting for everyone? All active participants will be disconnected."
        confirmText="End Meeting for All"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmEndMeeting}
        onCancel={() => setIsConfirmEndOpen(false)}
      />
    </div>
  );
}
