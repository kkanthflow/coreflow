import React, { useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CheckSquare,
  Briefcase,
  Video,
  Megaphone,
  Settings as SettingsIcon,
  CreditCard,
  Code,
  Target,
  Layers,
  type LucideIcon,
} from 'lucide-react';

export interface TabDefinition {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
  category?: string;
  isCustom?: boolean;
}

export interface DepartmentTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: TabDefinition[];
  syncWithUrl?: boolean;
}

/**
 * Resolves a semantic Lucide icon for any standard or user-defined tab.
 */
export function getTabIcon(tabId: string, category?: string): LucideIcon {
  const normalizedId = tabId.toLowerCase();
  const normalizedCat = (category || '').toLowerCase();

  switch (normalizedId) {
    case 'overview':
      return LayoutDashboard;
    case 'members':
      return Users;
    case 'chat':
      return MessageSquare;
    case 'tasks':
      return CheckSquare;
    case 'projects':
      return Briefcase;
    case 'meetings':
      return Video;
    case 'announcements':
      return Megaphone;
    case 'settings':
      return SettingsIcon;
    default:
      if (normalizedCat.includes('finance') || normalizedCat.includes('account') || normalizedCat.includes('budget') || normalizedId.includes('invoice') || normalizedId.includes('expense')) {
        return CreditCard;
      }
      if (normalizedCat.includes('engineering') || normalizedCat.includes('software') || normalizedCat.includes('dev') || normalizedId.includes('sprint') || normalizedId.includes('bug')) {
        return Code;
      }
      if (normalizedCat.includes('growth') || normalizedCat.includes('sales') || normalizedCat.includes('lead') || normalizedCat.includes('market')) {
        return Target;
      }
      return Layers;
  }
}

export function DepartmentTabs({
  activeTab,
  onTabChange,
  tabs,
  syncWithUrl = true,
}: DepartmentTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabListRef = useRef<HTMLDivElement>(null);

  // Sync active tab from URL param if available
  useEffect(() => {
    if (!syncWithUrl) return;
    const urlTab = searchParams.get('tab');
    if (urlTab && tabs.some(t => t.id === urlTab) && urlTab !== activeTab) {
      onTabChange(urlTab);
    }
  }, [searchParams, syncWithUrl, tabs, activeTab, onTabChange]);

  const handleSelectTab = (tabId: string) => {
    onTabChange(tabId);
    if (syncWithUrl) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (tabId === 'overview') {
          next.delete('tab');
        } else {
          next.set('tab', tabId);
        }
        return next;
      }, { replace: true });
    }
  };

  // Keyboard navigation (ArrowLeft / ArrowRight / Home / End)
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex >= 0) {
      e.preventDefault();
      const targetTab = tabs[targetIndex];
      handleSelectTab(targetTab.id);

      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      if (buttons && buttons[targetIndex]) {
        buttons[targetIndex].focus();
      }
    }
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-orientation="horizontal"
      className="flex bg-surface-2 border border-line rounded-lg p-0.5 overflow-x-auto scrollbar-none max-w-full select-none"
    >
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon || getTabIcon(tab.id, tab.category);

        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSelectTab(tab.id)}
            onKeyDown={e => handleKeyDown(e, idx)}
            className={`px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              isActive
                ? 'bg-card-bg text-text font-semibold shadow-xs'
                : 'text-muted hover:text-text font-medium'
            }`}
          >
            <Icon size={13} className={isActive ? 'text-accent' : 'text-muted'} />
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                  isActive
                    ? 'bg-surface-2 text-main border border-divider'
                    : 'text-muted/80'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

