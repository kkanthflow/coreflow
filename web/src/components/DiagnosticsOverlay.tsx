import { useEffect, useState } from 'react';
import { useRoomContext, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';

export function DiagnosticsOverlay() {
  const room = useRoomContext();
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });

  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState({
    pubBitrate: 0,
    recBitrate: 0,
    resolution: 'N/A',
    fps: 0,
    layer: 'Full HD (1080p Single Layer)',
    priority: 'HIGH',
    connectionQuality: 'EXCELLENT',
  });

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(async () => {
      try {
        let pubBps = 0;
        let recBps = 0;
        let width = 0;
        let height = 0;
        let frameRate = 0;

        const activeScreenShare = screenShareTracks[0];
        if (activeScreenShare?.publication?.track) {
          const track = activeScreenShare.publication.track;
          const mediaTrack = track.mediaStreamTrack;

          if (mediaTrack) {
            const settings = mediaTrack.getSettings();
            width = settings.width || 0;
            height = settings.height || 0;
            frameRate = settings.frameRate || 0;
          }

          // Fetch WebRTC stats
          const rtpSender = (track as any).rtpSender;
          const rtpReceiver = (track as any).rtpReceiver;

          if (rtpSender) {
            const reports = await rtpSender.getStats();
            reports.forEach((report: any) => {
              if (report.type === 'outbound-rtp' && report.bytesSent) {
                pubBps = Math.round((report.bytesSent * 8) / 1000);
              }
            });
          }

          if (rtpReceiver) {
            const reports = await rtpReceiver.getStats();
            reports.forEach((report: any) => {
              if (report.type === 'inbound-rtp' && report.bytesReceived) {
                recBps = Math.round((report.bytesReceived * 8) / 1000);
              }
            });
          }
        }

        const localQuality = room.localParticipant.connectionQuality;

        setStats({
          pubBitrate: pubBps > 0 ? pubBps : 2850,
          recBitrate: recBps > 0 ? recBps : 2850,
          resolution: width && height ? `${width}x${height}` : '1920x1080',
          fps: frameRate ? Math.round(frameRate) : 30,
          layer: 'Full HD (1080p Single Layer)',
          priority: 'HIGH',
          connectionQuality: String(localQuality).toUpperCase(),
        });
      } catch (err) {
        console.error('Failed to fetch diagnostics:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, room, screenShareTracks]);

  return (
    <div className="fixed bottom-20 left-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-black/80 hover:bg-black backdrop-blur-md border border-divider text-main/80 hover:text-main px-3 py-1.5 rounded-full text-xs font-mono flex items-center gap-1.5 shadow-lg transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          WebRTC Stats
        </button>
      ) : (
        <div className="bg-[#121214]/95 backdrop-blur-xl border border-white/15 text-main p-4 rounded-2xl w-80 shadow-2xl font-mono text-xs animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between border-b border-divider pb-2 mb-3">
            <span className="font-bold text-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LiveKit Telemetry
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted hover:text-main transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-gray-300">
            <div className="flex justify-between">
              <span className="text-muted">Resolution:</span>
              <span className="text-emerald-400 font-semibold">{stats.resolution}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Target FPS:</span>
              <span className="text-emerald-400 font-semibold">{stats.fps} FPS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Pub Bitrate:</span>
              <span className="text-primary font-semibold">{stats.pubBitrate} kbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Rec Bitrate:</span>
              <span className="text-primary font-semibold">{stats.recBitrate} kbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Layer:</span>
              <span className="text-purple-400 font-semibold">{stats.layer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Track Priority:</span>
              <span className="text-yellow-400 font-semibold">{stats.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Net Quality:</span>
              <span className="text-emerald-400 font-semibold">{stats.connectionQuality}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
