import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SettingsNav from './SettingsNav';
import SaveBar from './SaveBar';
import { BRAND } from '../../brand';

interface PageMeta {
  title: string;
  description: string;
}

const PAGE_META_MAP: Record<string, PageMeta> = {
  profile: {
    title: 'Profile',
    description: 'Manage your personal identity, contact email, and workspace role.',
  },
  appearance: {
    title: 'Appearance',
    description: 'Customize theme display mode, density, motion, and feedback.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Configure alert channels, meeting reminders, and quiet hours.',
  },
  'audio-video': {
    title: 'Audio & Video',
    description: 'Configure hardware microphones, capture camera devices, and WebRTC E2EE.',
  },
  security: {
    title: 'Security',
    description: 'Update master credentials, password, and review security policies.',
  },
  organization: {
    title: 'Organization',
    description: 'Configure workspace currency, locale, timezone, and fiscal calendar.',
  },
  billing: {
    title: 'Billing & Plans',
    description: 'Monitor active tier quotas, subscription limits, and transaction history.',
  },
  members: {
    title: 'Members & Roles',
    description: 'Inspect organization members, roles, and invitation status.',
  },
  integrations: {
    title: 'Integrations & API',
    description: 'Manage API keys, webhooks, and developer telemetry connections.',
  },
};

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const segment = location.pathname.split('/').filter(Boolean)[1] || 'appearance';
  const meta = PAGE_META_MAP[segment] || {
    title: 'Settings',
    description: 'Configure workspace preferences and account credentials.',
  };

  useEffect(() => {
    document.title = `Settings · ${meta.title} · ${BRAND.productName}`;
  }, [meta.title]);

  return (
    <div className="w-full max-w-[1100px] mx-auto py-2 sm:py-4 px-2 sm:px-4">
      {/* Settings Top Header with Dashboard Link */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              {meta.title}
            </h1>
          </div>
          <p className="text-xs text-muted mt-1 max-w-xl truncate">
            {meta.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-muted hover:text-text border border-line text-xs font-semibold transition-colors shrink-0"
        >
          <ArrowLeft size={13} />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Main Settings 2-Column Responsive Layout */}
      <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
        {/* Left Secondary Nav */}
        <SettingsNav />

        {/* Right Main Content Panel (centered, max-w-860px, responsive, no horizontal scroll at 360px) */}
        <main className="flex-1 w-full max-w-[860px] min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Floating SaveBar for dirty state across all settings subpages */}
      <SaveBar />
    </div>
  );
}
