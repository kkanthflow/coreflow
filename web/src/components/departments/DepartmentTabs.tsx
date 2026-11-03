import React, { useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Briefcase,
  Layers,
  FileText,
  BarChart3,
  ArrowLeftRight,
  Settings as SettingsIcon,
  Target,
  Shield,
  CreditCard,
  Code,
  type LucideIcon,
} from 'lucide-react';

export interface TabDefinition {
  id?: string;
  key?: string;
  label: string;
  count?: number;
  badge?: number | string;
  icon?: LucideIcon;
  category?: string;
  isCustom?: boolean;
}

export interface DepartmentTabsProps {
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  onChange?: (tabId: string) => void;
  tabs: TabDefinition[];
  syncWithUrl?: boolean;
}

/**
 * Resolves a semantic Lucide icon for any dynamic capability tab.
 */
export function getTabIcon(tabId: string, category?: string): LucideIcon {
  const normalizedId = tabId.toLowerCase();
  const normalizedCat = (category || '').toLowerCase();

  switch (normalizedId) {
    case 'overview':
      return LayoutDashboard;
    case 'tasks':
      return CheckSquare;
    case 'projects':
      return Briefcase;
    case 'modules':
      return Layers;
    case 'members':
      return Users;
    case 'documents':
      return FileText;
    case 'analytics':
    case 'reports':
      return BarChart3;
    case 'collaboration':
    case 'approvals':
      return ArrowLeftRight;
    case 'settings':
      return SettingsIcon;
    default:
      if (normalizedCat.includes('finance') || normalizedCat.includes('budget') || normalizedId.includes('invoice') || normalizedId.includes('expense')) {
        return CreditCard;
      }
      if (normalizedCat.includes('engineering') || normalizedCat.includes('software') || normalizedCat.includes('tech') || normalizedId.includes('sprint') || normalizedId.includes('bug')) {
        return Code;
      }
      if (normalizedCat.includes('growth') || normalizedCat.includes('sales') || normalizedCat.includes('market') || normalizedCat.includes('campaign')) {
        return Target;
      }
      if (normalizedCat.includes('security') || normalizedCat.includes('legal') || normalizedCat.includes('compliance')) {
        return Shield;
      }
      return Layers;
  }
}

export function DepartmentTabs({
  activeTab,
  onTabChange,
  onChange,
  tabs,
  syncWithUrl = true,
}: DepartmentTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleCallback = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
    if (onChange) onChange(tabId);
  };

  // Sync active tab from URL param if available
  useEffect(() => {
    if (!syncWithUrl) return;
    const urlTab = searchParams.get('tab');
    if (urlTab && tabs.some(t => (t.id || t.key) === urlTab) && urlTab !== activeTab) {
      handleCallback(urlTab);
    }
  }, [searchParams, syncWithUrl, tabs, activeTab]);

  const handleSelectTab = (tabId: string) => {
    handleCallback(tabId);
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

  const safeTabs = tabs || [];

  // Keyboard navigation (ArrowLeft / ArrowRight / Home / End)
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % safeTabs.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + safeTabs.length) % safeTabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = safeTabs.length - 1;
    }

    if (targetIndex >= 0) {
      e.preventDefault();
      const targetTab = safeTabs[targetIndex];
      const tid = targetTab.id || targetTab.key || '';
      handleSelectTab(tid);

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
      {safeTabs.map((tab, idx) => {
        const tabKey = tab.id || tab.key || `tab-${idx}`;
        const isActive = activeTab === tabKey;
        const Icon = tab.icon || getTabIcon(tabKey, tab.category);
        const badgeCount = tab.badge !== undefined ? tab.badge : tab.count;

        return (
          <button
            key={tabKey}
            id={`tab-${tabKey}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tabKey}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSelectTab(tabKey)}
            onKeyDown={e => handleKeyDown(e, idx)}
            className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              isActive
                ? 'bg-surface-1 text-text-primary font-semibold shadow-xs'
                : 'text-text-muted hover:text-text-primary font-medium'
            }`}
          >
            <Icon size={14} className={isActive ? 'text-accent' : 'text-text-muted'} />
            <span>{tab.label}</span>
            {badgeCount !== undefined && badgeCount !== null && (
              <span
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                  isActive
                    ? 'bg-surface-2 text-text-primary border border-border-subtle'
                    : 'text-text-muted'
                }`}
              >
                {badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
