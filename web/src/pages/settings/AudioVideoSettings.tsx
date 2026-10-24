import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export default function AudioVideoSettings() {
  const { userSettings, updateUserSetting } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <h2 className="text-sm font-bold text-text mb-1">Hardware & Media Devices</h2>
        <p className="text-xs text-muted mb-4">Manage microphone routing, camera capture, and WebRTC encryption.</p>
        <div className="flex items-center justify-between p-3.5 bg-surface-2 border border-line rounded-xl">
          <div>
            <div className="text-xs font-semibold text-text">WebRTC E2EE Encryption</div>
            <div className="text-[11px] text-muted">End-to-end hardware ratchet encryption for audio and video feeds</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={userSettings.e2eeEnabled}
            onClick={() => updateUserSetting('e2eeEnabled', !userSettings.e2eeEnabled)}
            className={`w-10 h-5.5 rounded-full transition-colors relative ${
              userSettings.e2eeEnabled ? 'bg-accent' : 'bg-line'
            }`}
          >
            <span className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
              userSettings.e2eeEnabled ? 'right-0.5' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}
