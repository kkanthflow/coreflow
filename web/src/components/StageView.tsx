import { useParticipants } from '@livekit/components-react';
import { Track, TrackPublication, Participant } from 'livekit-client';
import { ScreenShareView } from './ScreenShareView';
import { ParticipantGrid } from './ParticipantGrid';
import { ParticipantTile } from './ParticipantTile';

import React from 'react';

export const StageView = React.memo(function StageView() {
  const participants = useParticipants();

  // Detect active presenter using participant.isScreenShareEnabled
  const presenter = participants.find((p) => p.isScreenShareEnabled);
  const screenSharePub = presenter?.getTrackPublication(Track.Source.ScreenShare);

  const activeScreenShare =
    presenter && screenSharePub
      ? {
          presenter: presenter as Participant,
          publication: screenSharePub as TrackPublication,
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
});
