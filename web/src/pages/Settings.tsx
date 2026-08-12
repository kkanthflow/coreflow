import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  ArrowLeft, 
  User, 
  Lock, 
  Video, 
  Bell, 
  ShieldCheck, 
  Save,
  Volume2
} from 'lucide-react';
import { SidebarProfile } from '../components/SidebarProfile';

export default function Settings() {
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState('CoreFlow Active User');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [e2eeEnabled, setE2eeEnabled] = useState(true);
  const [audioInput, setAudioInput] = useState('Default Input');
  const [videoInput, setVideoInput] = useState('Default Camera');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSave = () => {
    setSaveStatus('Saving...');
    setTimeout(() => {
      setSaveStatus('Settings updated successfully!');
      setTimeout(() => setSaveStatus(null), 2500);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#07070B] text-white font-sans p-6 md:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Back navigation header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-xl bg-[#111118] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:border-[#FF6B4A]/30 transition-all active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase block">Workspace Panel</span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <SettingsIcon size={22} className="text-[#FF6B4A]" />
              <span>Workspace Settings</span>
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Sidebar categories (visual only) */}
          <div className="md:col-span-1 flex flex-col justify-between bg-[#111118] border border-white/5 rounded-3xl p-4 gap-6">
            <div className="space-y-2">
              {[
                { label: 'General Profile', icon: User, active: true },
                { label: 'Video & Audio', icon: Video, active: false },
                { label: 'Security & E2EE', icon: Lock, active: false },
                { label: 'Alerts Notifications', icon: Bell, active: false },
              ].map((cat, idx) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={idx}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                      cat.active 
                        ? 'text-white bg-[#FF6B4A]/10 border border-[#FF6B4A]/25' 
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    <Icon size={16} className={cat.active ? 'text-[#FF6B4A]' : 'text-gray-500'} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Logout Panel */}
            <div className="mt-auto">
              <SidebarProfile />
            </div>
          </div>

          {/* Configuration Form */}
          <div className="md:col-span-2 space-y-6">
            
            {/* General Settings */}
            <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className="font-bold text-white text-base border-b border-white/5 pb-3">General Configuration</h3>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 block">Display Profile Name</label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF6B4A]/40 transition-colors"
                />
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-white block">Email Alerts</label>
                    <span className="text-xs text-gray-500 block">Send notification messages for scheduled sessions</span>
                  </div>
                  <button 
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                      emailNotifications ? 'bg-[#FF6B4A]' : 'bg-gray-800'
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      emailNotifications ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Media Settings */}
            <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className="font-bold text-white text-base border-b border-white/5 pb-3">Hardware Input Devices</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                    <Volume2 size={12} />
                    <span>Microphone</span>
                  </label>
                  <select 
                    value={audioInput} 
                    onChange={(e) => setAudioInput(e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF6B4A]/40 transition-colors appearance-none"
                  >
                    <option>Default Input</option>
                    <option>External Mic (USB)</option>
                    <option>Built-in Microphone</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                    <Video size={12} />
                    <span>Camera</span>
                  </label>
                  <select 
                    value={videoInput} 
                    onChange={(e) => setVideoInput(e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF6B4A]/40 transition-colors appearance-none"
                  >
                    <option>Default Camera</option>
                    <option>HD Webcam Pro</option>
                    <option>FaceTime Camera</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className="font-bold text-white text-base border-b border-white/5 pb-3">Security & Privacy</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-[#FF6B4A]" />
                    <span>End-to-End Encryption (E2EE)</span>
                  </label>
                  <span className="text-xs text-gray-500 block">Enforce native RNKeyProvider secure encryption tunnels for rooms</span>
                </div>
                <button 
                  onClick={() => setE2eeEnabled(!e2eeEnabled)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                    e2eeEnabled ? 'bg-[#FF6B4A]' : 'bg-gray-800'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    e2eeEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-between pt-2">
              {saveStatus ? (
                <span className="text-xs font-semibold text-emerald-400">{saveStatus}</span>
              ) : (
                <span className="text-xs text-gray-600">Last saved: Today</span>
              )}
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-[#FF6B4A] hover:bg-[#E85A3A] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-[#FF6B4A]/10 transition-all active:scale-[0.98]"
              >
                <Save size={14} />
                <span>Save Configuration</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}