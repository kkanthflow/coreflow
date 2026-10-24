import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export default function IntegrationsSettings() {
  const { canEditWorkspace } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-text">Developer Integrations & API Keys</h2>
          {!canEditWorkspace && (
            <span className="text-[10px] font-mono text-muted bg-surface-2 border border-line px-2 py-0.5 rounded">
              Read-only (Admin Required)
            </span>
          )}
        </div>
        <p className="text-xs text-muted mb-4">Manage REST API credentials, webhook endpoints, and connected telemetry services.</p>

        <div className="p-4 bg-surface-2 border border-line rounded-xl text-xs text-muted">
          Developer API and webhook configurations will be configured here.
        </div>
      </div>
    </div>
  );
}
