import React from 'react';

export default function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <h2 className="text-sm font-bold text-text mb-1">Security & Authentication</h2>
        <p className="text-xs text-muted mb-4">Manage your authentication credentials, password, and session access.</p>
        <div className="p-4 bg-surface-2 border border-line rounded-xl text-xs text-muted">
          Password update and session monitoring controls will be configured here.
        </div>
      </div>
    </div>
  );
}
