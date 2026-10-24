import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export default function AppearanceSettings() {
  const { theme, setTheme } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <h2 className="text-sm font-bold text-text mb-1">Theme Mode</h2>
        <p className="text-xs text-muted mb-4">Select your preferred appearance mode across Auvryn.</p>
        <div className="flex gap-1.5 p-1 bg-surface-2 rounded-xl border border-line w-fit">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                theme === t 
                  ? 'bg-surface text-text shadow-xs border border-line' 
                  : 'text-muted hover:text-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
