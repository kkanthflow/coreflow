import React from 'react';
import { Participant } from 'livekit-client';
import { ParticipantTile } from './ParticipantTile';

interface ParticipantGridProps {
  participants: Participant[];
}

export const ParticipantGrid = React.memo(function ParticipantGrid({ participants }: ParticipantGridProps) {
  const count = participants.length;

  const getGridColsClass = () => {
    if (count <= 1) return 'grid-cols-1 max-w-4xl max-h-[80vh]';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2 max-w-5xl max-h-[85vh]';
    if (count <= 4) return 'grid-cols-2 max-w-5xl';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3 max-w-6xl';
    return 'grid-cols-2 md:grid-cols-4 max-w-7xl';
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className={`grid gap-4 w-full h-full ${getGridColsClass()}`}>
        {participants.map((p) => (
          <div key={p.identity} className="w-full h-full min-h-[180px]">
            <ParticipantTile participant={p} />
          </div>
        ))}
      </div>
    </div>
  );
});
