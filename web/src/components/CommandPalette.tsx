import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, LayoutDashboard, Briefcase, CheckSquare, Video,
  MessageSquare, Building, FileText, BarChart3,
  Settings as SettingsIcon, Plus, Sparkles, Sun, Moon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandAction {
  section: string;
  title: string;
  icon: any;
  path?: string;
  onSelect?: () => void;
  shortcut?: string;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const ACTIONS: CommandAction[] = [
    { section: 'Preferences', title: `Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`, icon: resolvedTheme === 'dark' ? Sun : Moon, onSelect: () => toggleTheme(), shortcut: 'T T' },
    { section: 'Navigation', title: 'Go to Dashboard', icon: LayoutDashboard, path: '/dashboard', shortcut: 'G D' },
    { section: 'Navigation', title: 'Open Plans & Pricing', icon: Sparkles, path: '/pricing', shortcut: 'G $' },
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

  const executeAction = (action: CommandAction) => {
    if (action.onSelect) {
      action.onSelect();
    } else if (action.path) {
      navigate(action.path);
    }
    onClose();
  };

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
        executeAction(filtered[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4 select-none"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.95, y: -16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: -10, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl bg-card-bg border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-divider gap-3">
              <Search size={16} className="text-accent shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Type a command, page, or action (e.g. 'Project', 'Theme', 'Invoice')..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full bg-transparent text-sm text-text placeholder-muted/60 focus:outline-none font-medium"
              />
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold text-muted bg-surface-2 border border-line rounded shadow-xs">
                ESC
              </kbd>
            </div>

            {/* Action List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted font-medium">
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
                      onClick={() => executeAction(action)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                        isSelected
                          ? 'bg-accent text-white shadow-md shadow-accent/25'
                          : 'text-text hover:bg-surface-2'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={15} className={isSelected ? 'text-white' : 'text-muted'} />
                        <span className="font-semibold">{action.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {action.shortcut && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xs ${
                            isSelected ? 'bg-black/20 text-white font-bold' : 'bg-surface-2 text-muted border border-line'
                          }`}>
                            {action.shortcut}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="px-4 py-2.5 bg-surface-2/40 border-t border-divider flex items-center justify-between text-[11px] text-muted font-medium">
              <div className="flex items-center gap-3">
                <span><kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-surface-2 text-text border border-line rounded">↑↓</kbd> Navigate</span>
                <span><kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-surface-2 text-text border border-line rounded">↵</kbd> Select</span>
              </div>
              <span className="font-mono text-[10px] tracking-wider text-muted">SKAVELON COMMAND LAYER</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

 