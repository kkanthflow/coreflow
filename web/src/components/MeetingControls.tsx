import { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';

interface MeetingControlsProps {
  activeDrawer: 'notes' | 'chat' | null;
  isRecording: boolean;
  onToggleNotes: () => void;
  onToggleChat: () => void;
  onToggleRecord: () => void;
  onLeave: () => void;
  isHost: boolean;
  onEndMeeting: () => void;
}

export function MeetingControls({ activeDrawer, isRecording, onToggleNotes, onToggleChat, onToggleRecord, onLeave, isHost, onEndMeeting }: MeetingControlsProps) {
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
        try {
          // Dedicated 1080p @ 30 FPS screen share options (matching Google Meet)
          await localParticipant.setScreenShareEnabled(true, {
            audio: true,
            selfBrowserSurface: 'exclude',
            surfaceSwitching: 'include',
            systemAudio: 'include',
            resolution: {
              width: 1920,
              height: 1080,
              frameRate: 30,
            },
            encoding: {
              maxBitrate: 3_500_000,
              maxFramerate: 30,
              priority: 'high',
            },
            degradationPreference: 'maintain-resolution',
          } as any);
        } catch (advancedErr) {
          console.warn('Advanced displayMedia constraints rejected, trying fallback screen share:', advancedErr);
          await localParticipant.setScreenShareEnabled(true, {
            audio: true,
            resolution: { width: 1920, height: 1080, frameRate: 30 },
          } as any);
        }
      }
    } catch (err) {
      console.log('Screen share cancelled or failed:', err);
    } finally {
      setIsTogglingScreen(false);
    }
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 px-3 md:px-4 py-3 bg-[#121214] border-t border-white/10 w-full z-40 overflow-x-auto flex-shrink-0">
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

      {/* Screen Share Toggle - hidden on mobile (not supported) */}
      {!isMobile && (
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
      )}

      {/* Chat Toggle */}
      <button
        onClick={onToggleChat}
        className={`p-3 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
          activeDrawer === 'chat'
            ? 'bg-emerald-600 text-white'
            : 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
        }`}
        title="Toggle Chat"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Notes Toggle */}
      <button
        onClick={onToggleNotes}
        className={`p-3 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
          activeDrawer === 'notes'
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

      {/* Record Toggle */}
      <button
        onClick={onToggleRecord}
        className={`p-3 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
          isRecording
            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 animate-pulse'
            : 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
        }`}
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill={isRecording ? 'currentColor' : 'none'} />
        </svg>
      </button>

      <div className="h-6 w-[1px] bg-white/10 mx-1" />

      {/* Leave / End Button */}
      {isHost ? (
        <div className="flex items-center gap-2">
          <button
            onClick={onLeave}
            className="px-4 py-2.5 rounded-full bg-[#27272a] hover:bg-[#3f3f46] text-white text-sm font-bold flex items-center gap-2 transition-all"
          >
            Leave
          </button>
          <button
            onClick={onEndMeeting}
            className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
          >
            End Meeting
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
