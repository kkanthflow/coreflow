import { useEffect, useState } from 'react';
import { Participant, TrackPublication, Track } from 'livekit-client';
import { VideoTrack, useLocalParticipant } from '@livekit/components-react';

interface ScreenShareViewProps {
  presenter: Participant;
  publication: TrackPublication;
}

export function ScreenShareView({ presenter, publication }: ScreenShareViewProps) {
  const { localParticipant } = useLocalParticipant();
  const isLocalPresenter = presenter.isLocal;

  // Presenter Elapsed Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isLocalPresenter) return;

    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocalPresenter]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleStopSharing = async () => {
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch (err) {
      console.error('Failed to stop screen sharing:', err);
    }
  };

  // ── 1. Local Presenter View (Google Meet style — No Infinite Mirror) ────────
  if (isLocalPresenter) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#121214] border border-white/10 rounded-2xl p-8 relative overflow-hidden shadow-2xl">
        {/* Subtle background blur effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 via-transparent to-transparent pointer-events-none" />

        {/* Icon & Animation */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">You are presenting to everyone</h2>
          <p className="text-gray-400 text-sm mb-6">
            Your screen is currently visible to all participants in this meeting.
          </p>

          {/* Details & Timer Pill */}
          <div className="flex items-center gap-3 bg-[#1c1c1e] border border-white/10 rounded-full px-4 py-2 mb-8 shadow-inner">
            <span className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sharing Screen
            </span>
            <span className="text-white/20">•</span>
            <span className="text-xs font-mono font-bold text-blue-400">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>

          {/* Stop Presenting Button */}
          <button
            onClick={handleStopSharing}
            className="flex items-center gap-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold px-6 py-3 rounded-full transition-all shadow-lg shadow-red-600/30 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            Stop Presenting
          </button>
        </div>
      </div>
    );
  }

  // ── 2. Remote Presenter View ─────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
      <VideoTrack
        trackRef={{
          participant: presenter,
          publication: publication,
          source: Track.Source.ScreenShare,
        }}
        className="w-full h-full object-contain"
      />

      {/* Presenter Name Badge */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-lg">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span>{presenter.name || presenter.identity} is presenting</span>
      </div>
    </div>
  );
}
