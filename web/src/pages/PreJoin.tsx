import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Mic } from 'lucide-react';

const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export default function PreJoin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    // Pass name to the room via state or query params
    navigate(`/meetings/${id}/room?name=${encodeURIComponent(name)}`);
  };

  const handleOpenApp = () => {
    // Attempt to open the native app using deep link
    window.location.href = `coreflow://meetings/${id}`;
    
    // Fallback if app is not installed
    setTimeout(() => {
      // Could redirect to App Store / Play Store here
      console.log('App might not be installed.');
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
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

      <div className="w-full max-w-md p-8 rounded-2xl bg-card border border-border shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Join Meeting</h1>
        
        <div className="aspect-video bg-muted rounded-xl mb-6 flex items-center justify-center border border-border/50">
          <div className="flex gap-4 text-muted-foreground">
            <Video size={32} />
            <Mic size={32} />
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Your Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-input/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Enter your name"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-foreground text-background font-bold rounded-lg px-4 py-3 hover:opacity-90 transition-opacity"
          >
            Join via Browser
          </button>
        </form>
      </div>
    </div>
  );
}
