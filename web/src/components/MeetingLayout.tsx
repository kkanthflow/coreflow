import { useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { StageView } from './StageView';
import { MeetingControls } from './MeetingControls';

interface MeetingLayoutProps {
  meetingId: string;
}

export function MeetingLayout({ meetingId }: MeetingLayoutProps) {
  const room = useRoomContext();

  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const defaultNotesTemplate = `# Meeting Notes\n\n**Agenda:**\n- \n\n**Decisions:**\n- \n\n**Action Items:**\n- `;
  const [notesText, setNotesText] = useState(() => {
    const saved = localStorage.getItem(`meeting_notes_${meetingId}`);
    return saved || defaultNotesTemplate;
  });

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotesText(val);
    localStorage.setItem(`meeting_notes_${meetingId}`, val);
  };

  const handleLeave = () => {
    room.disconnect();
  };

  const handleShare = async () => {
    const url = window.location.origin + `/meetings/${meetingId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my CoreFlow Meeting', url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert('Meeting link copied to clipboard!');
    }
  };

  return (
    <div className="h-screen w-full bg-[#09090b] flex flex-col relative overflow-hidden select-none">
      {/* Top Bar Header */}
      <div className="h-14 px-6 border-b border-white/10 flex items-center justify-between bg-[#121214] z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14" />
              <rect x="3" y="7" width="12" height="10" rx="2" />
            </svg>
          </div>
          <span className="text-white font-bold text-base tracking-wide">CoreFlow Meeting</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-[#27272a] hover:bg-[#3f3f46] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border border-white/10 shadow"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share Meeting
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex w-full h-full min-h-0 relative overflow-hidden">
        {/* Stage View */}
        <div className={`flex-1 h-full transition-all duration-300 ${isNotesOpen ? 'mr-[360px]' : ''}`}>
          <StageView />
        </div>

        {/* Notes Side Drawer */}
        {isNotesOpen && (
          <div className="w-[360px] h-full bg-[#121214] border-l border-white/10 flex flex-col absolute right-0 top-0 bottom-0 z-40 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#18181b]">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Meeting Notes
              </h3>
              <button
                onClick={() => setIsNotesOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
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
      </div>

      {/* Control Bar at Bottom */}
      <MeetingControls
        isNotesOpen={isNotesOpen}
        onToggleNotes={() => setIsNotesOpen((v) => !v)}
        onLeave={handleLeave}
      />
    </div>
  );
}
