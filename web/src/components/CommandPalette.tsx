import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, LayoutDashboard, Briefcase, CheckSquare, Video,
  MessageSquare, Building, FileText, BarChart3,
  Settings as SettingsIcon, Plus
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const ACTIONS = [
    { section: 'Navigation', title: 'Go to Dashboard', icon: LayoutDashboard, path: '/dashboard', shortcut: 'G D' },
    { section: 'Navigation', title: 'Open Projects', icon: Briefcase, path: '/projects', shortcut: 'G P' },
    { section: 'Navigation', title: 'Open Tasks Kanban', icon: CheckSquare, path: '/tasks', shortcut: 'G T' },
    { section: 'Navigation', title: 'Open Live Chat', icon: MessageSquare, path: '/chat', shortcut: 'G C' },
    { section: 'Navigation', title: 'Open Video Meetings', icon: Video, path: '/meetings', shortcut: 'G M' },
    { section: 'Navigation', title: 'Open Invoices & Billing', icon: FileText, path: '/invoices', shortcut: 'G I' },
    { section: 'Navigation', title: 'Open Client Directory', icon: Building, path: '/clients', shortcut: 'G L' },
    { section: 'Navigation', title: 'Open Analytics Telemetry', icon: BarChart3, path: '/analytics', shortcut: 'G A' },
    { section: 'Navigation', title: 'Workspace Settings', icon: SettingsIcon, path: '/settings', shortcut: 'G S' },
    { section: 'Quick Actions', title: 'Create New Project', icon: Plus, path: '/projects/new', shortcut: 'N P' },
    { section: 'Quick Actions', title: 'Schedule Video Conference', icon: Plus, path: '/meetings/new', shortcut: 'N M' },
    { section: 'Quick Actions', title: 'Generate New Invoice', icon: Plus, path: '/invoices/new', shortcut: 'N I' },
  ];

  const filtered = ACTIONS.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.section.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        navigate(filtered[selectedIndex].path);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, navigate, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center pt-24 px-4 select-none"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.94, y: -16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: -10, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl bg-[#0C0D12] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-white/[0.08] gap-3">
              <Search size={16} className="text-[#FF6B4A] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Type a command, page, or action (e.g. 'Project', 'Invoice')..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-medium"
              />
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold text-zinc-400 bg-white/[0.06] border border-white/[0.08] rounded">
                ESC
              </kbd>
            </div>

            {/* Action List with physical layout reorganization */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-medium">
                  No matching commands or pages found.
                </div>
              ) : (
                filtered.map((action, idx) => {
                  const isSelected = idx === selectedIndex;
                  const Icon = action.icon;
                  return (
                    <motion.div
                      layout
                      key={action.title}
                      onClick={() => {
                        navigate(action.path);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                        isSelected
                          ? 'bg-[#FF6B4A] text-white shadow-lg shadow-[#FF6B4A]/25'
                          : 'text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={15} className={isSelected ? 'text-white' : 'text-zinc-400'} />
                        <span className="font-semibold">{action.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-black/20 text-white font-bold' : 'bg-white/[0.05] text-zinc-400 border border-white/[0.06]'
                        }`}>
                          {action.shortcut}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="px-4 py-2 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500 font-medium">
              <div className="flex items-center gap-3">
                <span><kbd className="text-zinc-400 font-mono">↑↓</kbd> Navigate</span>
                <span><kbd className="text-zinc-400 font-mono">↵</kbd> Select</span>
              </div>
              <span className="font-mono text-[10px]">CoreFlow Command Layer</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
