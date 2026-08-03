import { useParticipants, useTracks } from '@livekit/components-react';
import { Track, TrackPublication, Participant } from 'livekit-client';
import { ScreenShareView } from './ScreenShareView';
import { ParticipantGrid } from './ParticipantGrid';
import { ParticipantTile } from './ParticipantTile';

export function StageView() {
  const participants = useParticipants();

  // Retrieve active screen share tracks
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });

  const activeScreenShare =
    screenShareTracks.length > 0
      ? {
          presenter: screenShareTracks[0].participant as Participant,
          publication: screenShareTracks[0].publication as TrackPublication,
        }
      : null;

  // ── 1. Presenter Mode (Google Meet layout) ──────────────────────────────────
  if (activeScreenShare) {
    return (
      <div className="flex h-full w-full gap-3 p-3 overflow-hidden">
        {/* Main Stage (Screen Share View) */}
        <div className="flex-1 h-full min-w-0">
          <ScreenShareView
            presenter={activeScreenShare.presenter}
            publication={activeScreenShare.publication}
          />
        </div>

        {/* Right Sidebar Filmstrip (Camera Feeds) */}
        <div className="w-[160px] h-full flex flex-col gap-2.5 overflow-y-auto pr-1 flex-shrink-0">
          {participants.map((p) => (
            <ParticipantTile key={p.identity} participant={p} size="small" />
          ))}
        </div>
      </div>
    );
  }

  // ── 2. Camera Grid Mode ─────────────────────────────────────────────────────
  return <ParticipantGrid participants={participants} />;
}
