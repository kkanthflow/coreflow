import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export default function OrganizationSettings() {
  const { workspaceSettings, canEditWorkspace, activeCurrency } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-text">Workspace Details</h2>
          {!canEditWorkspace && (
            <span className="text-[10px] font-mono text-muted bg-surface-2 border border-line px-2 py-0.5 rounded">
              Read-only (Admin Required)
            </span>
          )}
        </div>
        <p className="text-xs text-muted mb-4">Organization name, legal profile, and active base currency.</p>
        
        <div className="space-y-3 max-w-md">
          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Workspace Name</label>
            <div className="px-3.5 py-2 bg-surface-2 border border-line rounded-xl text-xs text-text font-medium">
              {workspaceSettings.workspaceName}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Active Currency</label>
            <div className="px-3.5 py-2 bg-surface-2 border border-line rounded-xl text-xs text-text font-mono font-medium">
              {activeCurrency}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
