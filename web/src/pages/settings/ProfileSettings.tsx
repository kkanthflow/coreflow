import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export default function ProfileSettings() {
  const { userSettings } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <h2 className="text-sm font-bold text-text mb-1">Personal Profile</h2>
        <p className="text-xs text-muted mb-4">Your display name, job title, and platform contact email.</p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Full Name</label>
            <div className="px-3.5 py-2 bg-surface-2 border border-line rounded-xl text-xs text-text font-medium">
              {userSettings.fullName || 'User'}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Email Address</label>
            <div className="px-3.5 py-2 bg-surface-2 border border-line rounded-xl text-xs text-text font-medium">
              {userSettings.email || 'user@example.com'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
