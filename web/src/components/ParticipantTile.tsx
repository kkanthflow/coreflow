import { Participant, Track, TrackPublication } from 'livekit-client';
import { VideoTrack } from '@livekit/components-react';

interface ParticipantTileProps {
  participant: Participant;
  size?: 'normal' | 'small';
}

export function ParticipantTile({ participant, size = 'normal' }: ParticipantTileProps) {
  const cameraPublications = participant.getTrackPublications();
  const cameraPub = [...cameraPublications.values()].find(
    (t) => t.source === Track.Source.Camera && t.track
  );

  const isCameraEnabled = cameraPub && !cameraPub.isMuted && cameraPub.track;

  const micPublications = participant.getTrackPublications();
  const micPub = [...micPublications.values()].find(
    (t) => t.source === Track.Source.Microphone
  );
  const isMicMuted = !micPub || micPub.isMuted;

  const isSpeaking = participant.isSpeaking;

  const heightClass = size === 'small' ? 'h-[110px] w-[150px]' : 'h-full w-full';

  return (
    <div
      className={`relative ${heightClass} rounded-xl overflow-hidden bg-[#1c1c1e] border ${
        isSpeaking ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-white/10'
      } flex-shrink-0 transition-all duration-300 shadow-md group`}
    >
      {/* Video Feed or Avatar */}
      {isCameraEnabled && cameraPub ? (
        <VideoTrack
          trackRef={{
            participant,
            publication: cameraPub as TrackPublication,
            source: Track.Source.Camera,
          }}
          className={`w-full h-full object-cover ${participant.isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#18181b]">
          <div className="w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center border border-white/10 shadow-inner">
            <span className="text-white font-bold text-lg select-none">
              {(participant.name || participant.identity || '?')[0].toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Mic Status Indicator (Top Right) */}
      <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white shadow">
        {isMicMuted ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        )}
      </div>

      {/* Participant Name Badge (Bottom Left) */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-xs font-medium truncate max-w-[130px] border border-white/10">
        {participant.name || participant.identity}
        {participant.isLocal && ' (You)'}
      </div>
    </div>
  );
}
