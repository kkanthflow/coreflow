import React, { useState } from 'react';
import { 
  Key, 
  Webhook, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Video, 
  Database, 
  CreditCard,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../hooks/useAuth';
import {
  SettingsSection,
  SettingsRow,
} from '../../components/settings';

const CONNECTED_SERVICES = [
  {
    name: 'Resend',
    category: 'Transactional Email Service',
    description: 'Powers workflow approval notifications, diagnostic emails, and workspace digests.',
    icon: Mail,
    status: 'Operational',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    name: 'LiveKit Cloud',
    category: 'Real-Time WebRTC Media SFU',
    description: 'Drives low-latency group video rooms, screen sharing, and audio streams.',
    icon: Video,
    status: 'Operational',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    name: 'Supabase Platform',
    category: 'PostgreSQL Database & Auth',
    description: 'Manages multi-tenant identity, encrypted credentials, Row-Level Security, and storage.',
    icon: Database,
    status: 'Operational',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    name: 'Razorpay Gateway',
    category: 'Standard Payment Gateway',
    description: 'Processes credit card, UPI, and netbanking subscriptions and client invoice settlements.',
    icon: CreditCard,
    status: 'Operational',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
];

export default function IntegrationsSettings() {
  const { canEditWorkspace } = useSettings();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* ── Connected Core Infrastructure ── */}
      <SettingsSection
        label="Connected Infrastructure Services"
        description="Active integrated platform providers running the Auvryn workspace infrastructure."
      >
        <div className="divide-y divide-line">
          {CONNECTED_SERVICES.map((service) => {
            const Icon = service.icon;

            return (
              <div
                key={service.name}
                className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/30 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center shrink-0 mt-0.5 text-text">
                    <Icon size={18} className="text-accent" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs sm:text-sm text-text">
                        {service.name}
                      </span>
                      <span className="text-[10px] font-mono text-muted">
                        ({service.category})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted leading-relaxed mt-0.5">
                      {service.description}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pl-13 sm:pl-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${service.statusColor}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{service.status}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── Developer API Keys (Backend-Gated) ── */}
      <SettingsSection
        label="Developer API Keys"
        description="Programmable machine-to-machine tokens for headless workspace integrations."
      >
        <div className="p-5 sm:p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-muted mx-auto">
            <Key size={20} />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-semibold text-text">Public Developer API (Coming Soon)</h4>
            <p className="text-xs text-muted leading-relaxed">
              Workspace REST and GraphQL API tokens with fine-grained RBAC scopes are scheduled for the next platform release. Database and auth endpoints currently communicate securely via server-side session tokens.
            </p>
          </div>

          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-2 border border-line text-[10px] font-mono font-semibold text-muted">
              <Clock size={11} />
              <span>Release v2.4 Target</span>
            </span>
          </div>
        </div>
      </SettingsSection>

      {/* ── Outbound Webhooks (Backend-Gated) ── */}
      <SettingsSection
        label="Event Webhooks"
        description="Publish real-time HTTP payloads to custom endpoints on invoice payments, task events, and approvals."
      >
        <div className="p-5 sm:p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-muted mx-auto">
            <Webhook size={20} />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-semibold text-text">Outbound Webhooks (Coming Soon)</h4>
            <p className="text-xs text-muted leading-relaxed">
              Configurable HTTPS webhook subscriptions with HMAC signature verification will be available once the event bus pipeline reaches general availability.
            </p>
          </div>

          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-2 border border-line text-[10px] font-mono font-semibold text-muted">
              <Clock size={11} />
              <span>Event Engine Integration Pending</span>
            </span>
          </div>
        </div>
      </SettingsSection>

      {/* ── About Card ── */}
      <SettingsSection
        label="ABOUT"
        description="Core build version, real-time database state, and authenticated user identity."
      >
        <div className="divide-y divide-line">
          <div className="flex justify-between items-center py-3 sm:py-3.5 px-[18px]">
            <span className="text-[13px] text-muted">App Version</span>
            <span className="text-[13px] font-mono font-normal text-text">1.0.0 (Production)</span>
          </div>
          <div className="flex justify-between items-center py-3 sm:py-3.5 px-[18px]">
            <span className="text-[13px] text-muted">Supabase Environment</span>
            <span className="text-[13px] font-mono font-normal text-emerald-400">Connected</span>
          </div>
          <div className="flex justify-between items-center py-3 sm:py-3.5 px-[18px] min-w-0">
            <span className="text-[13px] text-muted shrink-0 mr-3">Signed In As</span>
            <span className="text-[13px] font-mono font-normal text-text truncate max-w-[260px] sm:max-w-none break-all" title={user?.email}>
              {user?.email}
            </span>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
