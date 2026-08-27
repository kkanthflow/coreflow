import { memo, useMemo, useState, useEffect } from 'react';
import { Participant, Track, TrackPublication, ParticipantEvent } from 'livekit-client';
import { VideoTrack } from '@livekit/components-react';

interface ParticipantTileProps {
  participant: Participant;
  size?: 'normal' | 'small';
}

export const ParticipantTile = memo(function ParticipantTile({
  participant,
  size = 'normal',
}: ParticipantTileProps) {
  const [, setUpdateTrigger] = useState(0);

  // Subscribe to live participant events so camera track attachments reactively re-render
  useEffect(() => {
    const forceUpdate = () => setUpdateTrigger((v) => v + 1);

    participant.on(ParticipantEvent.TrackPublished, forceUpdate);
    participant.on(ParticipantEvent.TrackUnpublished, forceUpdate);
    participant.on(ParticipantEvent.TrackSubscribed, forceUpdate);
    participant.on(ParticipantEvent.TrackUnsubscribed, forceUpdate);
    participant.on(ParticipantEvent.TrackMuted, forceUpdate);
    participant.on(ParticipantEvent.TrackUnmuted, forceUpdate);
    participant.on(ParticipantEvent.IsSpeakingChanged, forceUpdate);

    return () => {
      participant.off(ParticipantEvent.TrackPublished, forceUpdate);
      participant.off(ParticipantEvent.TrackUnpublished, forceUpdate);
      participant.off(ParticipantEvent.TrackSubscribed, forceUpdate);
      participant.off(ParticipantEvent.TrackUnsubscribed, forceUpdate);
      participant.off(ParticipantEvent.TrackMuted, forceUpdate);
      participant.off(ParticipantEvent.TrackUnmuted, forceUpdate);
      participant.off(ParticipantEvent.IsSpeakingChanged, forceUpdate);
    };
  }, [participant]);

  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const micPub = participant.getTrackPublication(Track.Source.Microphone);

  const isCameraEnabled = Boolean(
    participant.isCameraEnabled || (cameraPub && !cameraPub.isMuted)
  );

  const isMicMuted = !micPub || micPub.isMuted || !participant.isMicrophoneEnabled;
  const isSpeaking = participant.isSpeaking;

  const heightClass = size === 'small' ? 'h-[110px] w-[150px]' : 'h-full w-full';

  const trackRef = useMemo(
    () =>
      cameraPub
        ? {
            participant,
            publication: cameraPub as TrackPublication,
            source: Track.Source.Camera,
            track: cameraPub.track ?? undefined,
          }
        : undefined,
    [participant, cameraPub, cameraPub?.track]
  );

  return (
    <div
      className={`relative ${heightClass} rounded-xl overflow-hidden bg-[#1c1c1e] border ${
        isSpeaking ? 'border-[#FF6B4A] ring-2 ring-[#FF6B4A]/50' : 'border-white/10'
      } flex-shrink-0 transition-all duration-300 shadow-md group`}
    >
      {/* Video Feed or Avatar */}
      {isCameraEnabled && trackRef ? (
        <VideoTrack
          trackRef={trackRef}
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
});
