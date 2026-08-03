import {
  useParticipants,
  useTracks,
  VideoTrack,
  ControlBar,
} from '@livekit/components-react';
import { Track, Participant, TrackPublication } from 'livekit-client';

// ─── Participant Tile ──────────────────────────────────────────────────────────
function ParticipantTile({
  participant,
  size = 'normal',
}: {
  participant: Participant;
  size?: 'normal' | 'small';
}) {
  const cameraTracks = participant.getTrackPublications();
  const cameraTrack = [...cameraTracks.values()].find(
    (t) => t.source === Track.Source.Camera && t.track
  );

  const h = size === 'small' ? 'h-[120px] w-[160px]' : 'h-full w-full';

  return (
    <div className={`relative ${h} rounded-xl overflow-hidden bg-[#1c1c1e] border border-white/5 flex-shrink-0`}>
      {cameraTrack?.track ? (
        <VideoTrack
          trackRef={{ participant, publication: cameraTrack as TrackPublication, source: Track.Source.Camera }}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#2c2c2e] flex items-center justify-center">
            <span className="text-white font-semibold text-lg">
              {(participant.name || participant.identity || '?')[0].toUpperCase()}
            </span>
          </div>
        </div>
      )}
      <div className="absolute bottom-1 left-2 text-white text-xs font-medium truncate max-w-[140px] drop-shadow-lg">
        {participant.name || participant.identity}
        {participant.isLocal && ' (You)'}
      </div>
    </div>
  );
}

// ─── Screen Share Track type ───────────────────────────────────────────────────
interface ScreenShareInfo {
  participant: Participant;
  publication: TrackPublication;
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export function MeetingLayout() {
  const participants = useParticipants();

  // Find all screen share tracks
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });

  const activeScreenShare: ScreenShareInfo | null =
    screenShareTracks.length > 0
      ? {
          participant: screenShareTracks[0].participant,
          publication: screenShareTracks[0].publication as TrackPublication,
        }
      : null;

  const count = participants.length;
  const cols =
    count <= 1 ? 1 :
    count <= 2 ? 2 :
    count <= 4 ? 2 :
    count <= 6 ? 3 : 4;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {activeScreenShare ? (
          <div className="flex h-full w-full gap-2 p-2">
            {/* Main screen share area */}
            <div className="flex-1 relative rounded-2xl overflow-hidden bg-black">
              <VideoTrack
                trackRef={{
                  participant: activeScreenShare.participant,
                  publication: activeScreenShare.publication,
                  source: Track.Source.ScreenShare,
                }}
                className="w-full h-full object-contain"
              />
              {/* Presenter label */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                {activeScreenShare.participant.name || activeScreenShare.participant.identity} is presenting
              </div>
            </div>

            {/* Participant strip on the right */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-full pr-0.5" style={{ width: 172 }}>
              {participants.map((p) => (
                <ParticipantTile key={p.identity} participant={p} size="small" />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="h-full w-full p-3 gap-2"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              alignContent: 'center',
            }}
          >
            {participants.map((p) => (
              <div key={p.identity} className="relative aspect-video rounded-xl overflow-hidden bg-[#1c1c1e] border border-white/5">
                <ParticipantTile participant={p} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-white/10 flex justify-center bg-[#09090b]">
        <ControlBar controls={{ chat: false, settings: false }} />
      </div>
    </div>
  );
}
