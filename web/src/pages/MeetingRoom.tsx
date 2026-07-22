import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from '@livekit/components-react';
import { VideoPresets } from 'livekit-client';
import '@livekit/components-styles';

export default function MeetingRoom() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name');
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!name) {
      navigate(`/meetings/${id}`);
      return;
    }

    const fetchToken = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-one.vercel.app';
        const res = await fetch(`${apiUrl}/api/meetings/${id}/join-guest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        });
        
        if (!res.ok) {
          throw new Error('Failed to join meeting');
        }
        
        const data = await res.json();
        setToken(data.token);
        setServerUrl(data.roomUrl);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchToken();
  }, [id, name, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-destructive">
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => navigate(`/meetings/${id}`)}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleShare = async () => {
    const url = window.location.origin + `/meetings/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my CoreFlow Meeting',
          url: url
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Meeting link copied to clipboard!');
    }
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col relative" data-lk-theme="default">
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={handleShare}
          className="flex items-center gap-2 bg-primary/80 backdrop-blur hover:bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-lg border border-white/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share
        </button>
      </div>
      <LiveKitRoom
        video={{ resolution: VideoPresets.h1080 }}
        audio={{ autoGainControl: true, echoCancellation: true, noiseSuppression: true }}
        token={token}
        serverUrl={serverUrl}
        onDisconnected={() => navigate('/')}
        className="flex-1"
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
