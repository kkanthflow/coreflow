import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

type Stage = 'prejoin' | 'connecting' | 'room' | 'error' | 'done';

export default function Meeting() {
  const { id } = useParams();

  // ── Stage machine ────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>('prejoin');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Pre-join state ───────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewStream = useRef<MediaStream | null>(null);
  const [cameraErr, setCameraErr] = useState(false);

  // ── Room state ───────────────────────────────────────────────────────────────
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const defaultNotes = `# Meeting Notes\n\n**Agenda:**\n- \n\n**Decisions:**\n- \n\n**Action Items:**\n- `;
  const [notesText, setNotesText] = useState(() => localStorage.getItem(`meeting_notes_${id}`) || defaultNotes);
  const fetchedRef = useRef(false);

  // ── Camera preview ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'prejoin') return;
    let alive = true;

    if (!videoOn) {
      previewStream.current?.getTracks().forEach(t => t.stop());
      previewStream.current = null;
      if (previewRef.current) previewRef.current.srcObject = null;
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        previewStream.current = stream;
        if (previewRef.current) { previewRef.current.srcObject = stream; previewRef.current.play().catch(() => {}); }
        setCameraErr(false);
      })
      .catch(() => { if (alive) setCameraErr(true); });

    return () => {
      alive = false;
      previewStream.current?.getTracks().forEach(t => t.stop());
      previewStream.current = null;
    };
  }, [stage, videoOn]);

  // ── Join handler ─────────────────────────────────────────────────────────────
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || fetchedRef.current) return;
    fetchedRef.current = true;

    // Stop camera preview stream before entering room
    previewStream.current?.getTracks().forEach(t => t.stop());
    previewStream.current = null;

    setStage('connecting');

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-one.vercel.app';
      const res = await fetch(`${apiUrl}/api/meetings/${id}/join-guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Server error ${res.status}: ${body}`);
      }

      const data = await res.json();
      if (!data.token || !data.roomUrl) throw new Error('Invalid response from server');

      setToken(data.token);
      setServerUrl(data.roomUrl);
      setStage('room');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join meeting');
      setStage('error');
      fetchedRef.current = false;
    }
  };

  const handleShare = async () => {
    const url = window.location.origin + `/meetings/${id}`;
    if (navigator.share) { try { await navigator.share({ title: 'Join my CoreFlow Meeting', url }); } catch {} }
    else { navigator.clipboard.writeText(url); alert('Meeting link copied!'); }
  };

  // ── PRE-JOIN ─────────────────────────────────────────────────────────────────
  if (stage === 'prejoin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#09090b]">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="7" width="12" height="10" rx="2"/></svg>
              </div>
              <span className="text-white font-bold text-xl">CoreFlow</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Ready to join?</h1>
            <p className="text-gray-500 text-sm mt-1">Set up your camera and microphone</p>
          </div>

          {/* Camera preview */}
          <div className="relative aspect-video bg-[#1c1c1e] rounded-2xl overflow-hidden border border-white/10 mb-5">
            {videoOn && !cameraErr
              ? <video ref={previewRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20L4 4M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="7" width="12" height="10" rx="2"/></svg>
                  </div>
                  <p className="text-gray-600 text-sm">{cameraErr ? 'Camera unavailable' : 'Camera off'}</p>
                </div>
            }
            {/* Toggle buttons */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              <button type="button" onClick={() => setAudioOn(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border backdrop-blur-sm ${audioOn ? 'bg-white/10 border-white/20 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {audioOn
                    ? <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></>
                    : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/></>
                  }
                </svg>
                {audioOn ? 'Mic On' : 'Mic Off'}
              </button>
              <button type="button" onClick={() => setVideoOn(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border backdrop-blur-sm ${videoOn ? 'bg-white/10 border-white/20 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {videoOn
                    ? <><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="7" width="12" height="10" rx="2"/></>
                    : <><path d="M16 16l4.553 2.069A1 1 0 0 0 22 17.155V6.845a1 1 0 0 0-1.447-.894L15 8M2 2l20 20M15 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/></>
                  }
                </svg>
                {videoOn ? 'Cam On' : 'Cam Off'}
              </button>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name to join"
              required
              autoFocus
              className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-base"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-[#2c2c2e] disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl px-4 py-4 transition-colors text-base"
            >
              {name.trim() ? 'Join Meeting' : 'Enter your name to join'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── CONNECTING ────────────────────────────────────────────────────────────────
  if (stage === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#09090b]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
        <p className="text-gray-400 text-sm">Joining as {name}...</p>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-[#09090b]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold">Couldn't join</h2>
        <p className="text-gray-400 text-sm text-center max-w-sm">{errorMsg}</p>
        <button onClick={() => { setStage('prejoin'); setErrorMsg(''); fetchedRef.current = false; }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  // ── DONE (left meeting) ───────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-[#09090b]">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold">You've left the meeting</h2>
        <button onClick={() => { setStage('prejoin'); setToken(''); setServerUrl(''); fetchedRef.current = false; }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
          Rejoin
        </button>
      </div>
    );
  }

  // ── ROOM ──────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-[#09090b] flex flex-col relative" data-lk-theme="default">
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={() => setIsNotesOpen(!isNotesOpen)}
          className="flex items-center gap-2 bg-slate-800/80 backdrop-blur hover:bg-slate-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-lg border border-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
          Notes
        </button>
        <button onClick={handleShare}
          className="flex items-center gap-2 bg-blue-600/80 backdrop-blur hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-lg border border-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share
        </button>
      </div>

      <div className="flex-1 flex w-full h-full">
        <LiveKitRoom
          video={videoOn}
          audio={audioOn}
          token={token}
          serverUrl={serverUrl}
          connect={true}
          onDisconnected={() => setStage('done')}
          onError={(err) => { setErrorMsg(err?.message || 'Connection error'); setStage('error'); }}
          className={`flex-1 transition-all ${isNotesOpen ? 'w-2/3' : 'w-full'}`}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>

        {isNotesOpen && (
          <div className="w-1/3 h-full bg-[#09090b] border-l border-white/10 flex flex-col absolute right-0 top-0 bottom-0 z-40">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
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
              onChange={e => { setNotesText(e.target.value); localStorage.setItem(`meeting_notes_${id}`, e.target.value); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
