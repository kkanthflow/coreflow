import { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';

interface MeetingControlsProps {
  isNotesOpen: boolean;
  onToggleNotes: () => void;
  onLeave: () => void;
}

export function MeetingControls({ isNotesOpen, onToggleNotes, onLeave }: MeetingControlsProps) {
  const { localParticipant } = useLocalParticipant();

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

  const [isTogglingScreen, setIsTogglingScreen] = useState(false);

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicOn);
    } catch (err) {
      console.error('Failed to toggle mic:', err);
    }
  };

  const toggleCam = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCamOn);
    } catch (err) {
      console.error('Failed to toggle camera:', err);
    }
  };

  const toggleScreenShare = async () => {
    if (isTogglingScreen) return;
    setIsTogglingScreen(true);
    try {
      if (isScreenSharing) {
        await localParticipant.setScreenShareEnabled(false);
      } else {
        // LiveKit best practice: Pass options to getDisplayMedia
        await localParticipant.setScreenShareEnabled(true, {
          audio: true,
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
        } as any);
      }
    } catch (err) {
      // User cancelling picker is not an error
      console.log('Screen share result:', err);
    } finally {
      setIsTogglingScreen(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3 bg-[#121214] border-t border-white/10 w-full z-40">
      {/* Microphone Toggle */}
      <button
        onClick={toggleMic}
        className={`p-3 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
          isMicOn
            ? 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
            : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
        }`}
        title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
      >
        {isMicOn ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          </svg>
        )}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={toggleCam}
        className={`p-3 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
          isCamOn
            ? 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
            : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
        }`}
        title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCamOn ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 16l4.553 2.069A1 1 0 0 0 22 17.155V6.845a1 1 0 0 0-1.447-.894L15 8M2 2l20 20M15 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1" />
          </svg>
        )}
      </button>

      {/* Screen Share Toggle */}
      <button
        onClick={toggleScreenShare}
        disabled={isTogglingScreen}
        className={`p-3 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
          isScreenSharing
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
            : 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
        }`}
        title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </button>

      {/* Notes Toggle */}
      <button
        onClick={onToggleNotes}
        className={`p-3 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
          isNotesOpen
            ? 'bg-blue-600 text-white'
            : 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
        }`}
        title="Toggle Notes"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </button>

      <div className="h-6 w-[1px] bg-white/10 mx-1" />

      {/* Leave Button */}
      <button
        onClick={onLeave}
        className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Leave
      </button>
    </div>
  );
}
