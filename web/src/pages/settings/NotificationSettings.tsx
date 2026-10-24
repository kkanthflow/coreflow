import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export default function NotificationSettings() {
  const { userSettings, updateUserSetting } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <h2 className="text-sm font-bold text-text mb-1">Notification Preferences</h2>
        <p className="text-xs text-muted mb-4">Control delivery channels, meeting reminders, and alert thresholds.</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 bg-surface-2 border border-line rounded-xl">
            <div>
              <div className="text-xs font-semibold text-text">Push Notifications</div>
              <div className="text-[11px] text-muted">Receive live notifications in browser</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={userSettings.notifications.push}
              onClick={() => updateUserSetting('notifications', {
                ...userSettings.notifications,
                push: !userSettings.notifications.push,
              })}
              className={`w-10 h-5.5 rounded-full transition-colors relative ${
                userSettings.notifications.push ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                userSettings.notifications.push ? 'right-0.5' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
