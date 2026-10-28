import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export default function ThemeToggle({ className = '', size = 'sm' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`relative inline-flex items-center justify-center rounded-lg border border-line bg-surface-2/80 hover:bg-surface-2 text-muted hover:text-text transition-all duration-200 select-none group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        size === 'sm' ? 'w-8 h-8' : 'w-9 h-9'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {/* Sun Icon (shown in dark mode to switch to light) */}
        <Sun
          size={14}
          className={`absolute transition-all duration-300 transform ${
            isDark
              ? 'opacity-100 rotate-0 scale-100 text-amber-400 group-hover:rotate-45'
              : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
          }`}
        />
        {/* Moon Icon (shown in light mode to switch to dark) */}
        <Moon
          size={14}
          className={`absolute transition-all duration-300 transform ${
            isDark
              ? 'opacity-0 rotate-90 scale-50 pointer-events-none'
              : 'opacity-100 rotate-0 scale-100 text-indigo-500 group-hover:-rotate-12'
          }`}
        />
      </div>
    </button>
  );
}
