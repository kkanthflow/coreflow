import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PreJoin as LiveKitPreJoin } from '@livekit/components-react';
import '@livekit/components-styles';

const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export default function PreJoin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const handleOpenApp = () => {
    window.location.href = `coreflow://meetings/${id}`;
    setTimeout(() => {
      console.log('App might not be installed.');
    }, 2000);
  };

  const handleJoin = (values: any) => {
    const { username, userChoices } = values;
    if (!username.trim()) return;
    
    // Pass choices to the room
    const query = new URLSearchParams({
      name: username,
      video: userChoices.videoEnabled.toString(),
      audio: userChoices.audioEnabled.toString()
    });
    
    navigate(`/meetings/${id}/room?${query.toString()}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background" data-lk-theme="default">
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-primary/10 border-b border-primary/20 backdrop-blur-md z-50 flex items-center justify-between">
          <div className="text-sm">
            <p className="font-semibold text-foreground">CoreFlow App</p>
            <p className="text-muted-foreground text-xs">For the best experience</p>
          </div>
          <button 
            onClick={handleOpenApp}
            className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-full text-sm"
          >
            Open in App
          </button>
        </div>
      )}

      <div className="w-full max-w-2xl p-4 md:p-8 rounded-2xl bg-card border border-border shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Join Meeting</h1>
        
        <LiveKitPreJoin
          onSubmit={handleJoin}
          defaults={{
            videoEnabled: true,
            audioEnabled: true,
          }}
          className="lk-prejoin"
        />
      </div>
    </div>
  );
}
