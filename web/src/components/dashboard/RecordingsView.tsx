import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Video, Play, Download, HardDrive, AlertCircle } from 'lucide-react';

interface Recording {
  id: string;
  meeting_id: string;
  file_url: string;
  duration: number;
  resolution: string;
  file_size: number;
  recording_status: string;
  started_at: string;
  finished_at: string;
  meetings: {
    title: string;
  };
}

export function RecordingsView() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const { data, error } = await supabase
          .from('meeting_recordings')
          .select(`
            *,
            meetings (
              title
            )
          `)
          .order('started_at', { ascending: false });

        if (error) throw error;
        setRecordings(data || []);
      } catch (error) {
        console.error('Error fetching recordings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] text-white">
      <div className="p-8 pb-4">
        <h1 className="text-3xl font-bold mb-2">Recordings</h1>
        <p className="text-gray-400">View and manage all your saved meeting recordings.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500">
            Loading recordings...
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-white/10 rounded-2xl">
            <Video size={48} className="text-gray-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">No Recordings Found</h3>
            <p className="text-gray-500 max-w-sm">
              You haven't recorded any meetings yet. Start a recording inside a live meeting to see it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recordings.map((recording) => (
              <div key={recording.id} className="bg-[#1A1A1D] rounded-2xl overflow-hidden border border-white/5 flex flex-col group">
                <div className="aspect-video bg-black/50 relative flex items-center justify-center group-hover:bg-black/40 transition-colors">
                  {recording.recording_status === 'completed' ? (
                    <button 
                      onClick={() => window.open(recording.file_url, '_blank')}
                      className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-blue-600/30"
                    >
                      <Play className="ml-1" size={20} />
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-yellow-500">
                      <AlertCircle size={24} />
                      <span className="text-sm font-semibold uppercase tracking-wider">{recording.recording_status}</span>
                    </div>
                  )}
                  
                  {recording.duration && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 rounded text-xs font-mono">
                      {formatDuration(recording.duration)}
                    </div>
                  )}
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg mb-1 truncate">
                    {recording.meetings?.title || 'Untitled Meeting'}
                  </h3>
                  <p className="text-gray-400 text-xs mb-4">
                    {new Date(recording.started_at).toLocaleDateString()} at {new Date(recording.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {recording.resolution && (
                        <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                          <Video size={12} />
                          {recording.resolution}
                        </span>
                      )}
                      {recording.file_size && (
                        <span className="flex items-center gap-1.5">
                          <HardDrive size={12} />
                          {formatBytes(recording.file_size)}
                        </span>
                      )}
                    </div>
                    
                    {recording.recording_status === 'completed' && recording.file_url && (
                      <button 
                        onClick={() => window.open(recording.file_url, '_blank')}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Download"
                      >
                        <Download size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
