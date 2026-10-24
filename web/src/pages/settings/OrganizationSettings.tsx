import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Coins, 
  MapPin, 
  Receipt, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  Upload, 
  Lock,
  CheckCircle2
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useRole } from '../../hooks/useRole';
import { useSettings } from '../../contexts/SettingsContext';
import { SUPPORTED_CURRENCIES, getCurrencyDetails } from '../../lib/currency';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
import {
  SettingsSection,
  SettingsRow,
  ChipGrid,
  Select,
} from '../../components/settings';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +5:30)' },
  { value: 'America/New_York', label: 'America/New_York (EST -5:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST -8:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST +0:00)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET +1:00)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST +4:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT +8:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST +9:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST +10:00)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-12-31)' },
];

const FISCAL_YEAR_OPTIONS = [
  { value: 'April', label: 'April – March (Standard India / UK)' },
  { value: 'January', label: 'January – December (Calendar Year)' },
  { value: 'July', label: 'July – June (Standard Australia)' },
  { value: 'October', label: 'October – September (US Federal)' },
];

export default function OrganizationSettings() {
  const { orgName, orgId, refreshWorkspace } = useWorkspace();
  const { role } = useRole();
  const {
    workspaceSettings,
    activeCurrency,
    updateWorkspaceSetting,
    updateWorkspaceSettings,
    canEditWorkspace,
  } = useSettings();

  // Organization profile state
  const [name, setName] = useState(workspaceSettings.workspaceName || orgName || '');
  const [address, setAddress] = useState(workspaceSettings.workspaceAddress || '');
  const [gst, setGst] = useState(workspaceSettings.workspaceGst || '');
  const [timezone, setTimezone] = useState(workspaceSettings.timezone || 'Asia/Kolkata');
  const [dateFormat, setDateFormat] = useState(workspaceSettings.dateFormat || 'DD/MM/YYYY');
  const [fiscalYear, setFiscalYear] = useState(workspaceSettings.fiscalYear || 'April');
  const [logoUrl, setLogoUrl] = useState(workspaceSettings.workspaceLogoUrl || '');

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (workspaceSettings.workspaceName) setName(workspaceSettings.workspaceName);
    if (workspaceSettings.workspaceAddress) setAddress(workspaceSettings.workspaceAddress);
    if (workspaceSettings.workspaceGst) setGst(workspaceSettings.workspaceGst);
    if (workspaceSettings.timezone) setTimezone(workspaceSettings.timezone);
    if (workspaceSettings.dateFormat) setDateFormat(workspaceSettings.dateFormat);
    if (workspaceSettings.fiscalYear) setFiscalYear(workspaceSettings.fiscalYear);
    if (workspaceSettings.workspaceLogoUrl) setLogoUrl(workspaceSettings.workspaceLogoUrl);
  }, [workspaceSettings]);

  // Currency conversion chip items
  const currencyChipItems = SUPPORTED_CURRENCIES.map((curr) => {
    const isCurrentActive = curr.code === activeCurrency;
    return {
      value: curr.code,
      label: curr.code,
      symbol: curr.symbol,
      sublabel: curr.name.replace(/\s*\([^)]*\)/, ''), // Remove bracketed symbol for clean subtitle
      badge: isCurrentActive ? 'Active' : undefined,
      disabled: !canEditWorkspace,
    };
  });

  const handleCurrencySelect = async (currCode: string) => {
    if (!canEditWorkspace) {
      toast.error('Only organization administrators can update workspace currency');
      return;
    }
    const curr = getCurrencyDetails(currCode);
    const success = await updateWorkspaceSetting('currency', currCode, true);
    if (success) {
      toast.success(`Workspace currency updated to ${curr.name}`);
      if (refreshWorkspace) await refreshWorkspace();
    }
  };

  const handleFieldChange = (field: string, val: string) => {
    if (!canEditWorkspace) return;
    setIsDirty(true);
    updateWorkspaceSettings({ [field]: val } as any, false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEditWorkspace || !orgId) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `org-logos/${orgId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setLogoUrl(base64);
          handleFieldChange('workspaceLogoUrl', base64);
          toast.success('Workspace logo preview updated');
        };
        reader.readAsDataURL(file);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        setLogoUrl(publicUrlData.publicUrl);
        handleFieldChange('workspaceLogoUrl', publicUrlData.publicUrl);
        toast.success('Workspace logo uploaded');
      }
    } catch (err: any) {
      toast.error('Failed to upload logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!canEditWorkspace || !orgId) return;
    setSaving(true);
    try {
      // 1. Write to organizations table
      const { error } = await supabase
        .from('organizations')
        .update({
          name: name.trim(),
          address: address.trim(),
          gst_number: gst.trim() || null,
        })
        .eq('id', orgId);

      if (error) throw error;

      // 2. Persist in SettingsContext
      await updateWorkspaceSettings({
        workspaceName: name.trim(),
        workspaceAddress: address.trim(),
        workspaceGst: gst.trim(),
        timezone,
        dateFormat,
        fiscalYear,
        workspaceLogoUrl: logoUrl,
      }, true);

      setIsDirty(false);
      toast.success('Organization settings saved successfully');
      if (refreshWorkspace) await refreshWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setName(workspaceSettings.workspaceName || orgName || '');
    setAddress(workspaceSettings.workspaceAddress || '');
    setGst(workspaceSettings.workspaceGst || '');
    setTimezone(workspaceSettings.timezone || 'Asia/Kolkata');
    setDateFormat(workspaceSettings.dateFormat || 'DD/MM/YYYY');
    setFiscalYear(workspaceSettings.fiscalYear || 'April');
    setLogoUrl(workspaceSettings.workspaceLogoUrl || '');
    setIsDirty(false);
    toast.info('Changes discarded');
  };

  return (
    <div className="space-y-6">
      {/* ── Non-Admin Banner ── */}
      {!canEditWorkspace && (
        <div className="p-4 rounded-2xl bg-surface-2 border border-line flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-surface border border-line flex items-center justify-center text-muted shrink-0 mt-0.5">
            <Lock size={15} />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-semibold text-text">Workspace Settings Locked (Read-Only)</div>
            <p className="text-muted leading-relaxed">
              Only organization owners and administrators can modify workspace profile, currency, and fiscal policies. Contact your administrator to request updates.
            </p>
          </div>
        </div>
      )}

      {/* ── Primary Currency Selection (ChipGrid) ── */}
      <SettingsSection
        label="Primary Workspace Currency"
        description="Governs money amounts across all invoices, dashboard telemetry, projects, and outstanding revenue. Razorpay checkout remain in standard INR."
        badge={`Active: ${activeCurrency}`}
      >
        <div className="p-4 sm:p-5">
          <ChipGrid<string>
            items={currencyChipItems}
            value={activeCurrency}
            onChange={handleCurrencySelect}
            columns="auto"
            disabled={!canEditWorkspace}
            disabledTooltip="Only organization administrators can switch workspace currency"
            ariaLabel="Select workspace currency"
          />

          <div className="mt-3.5 pt-3 border-t border-line flex items-center gap-2 text-[11px] text-muted">
            <CheckCircle2 size={13} className="text-accent shrink-0" />
            <span>
              Real-time reactive formatting: Money amounts throughout dashboard and invoices adapt automatically without manual reload.
            </span>
          </div>
        </div>
      </SettingsSection>

      {/* ── Organization Profile ── */}
      <SettingsSection
        label="Company Profile & Billing Details"
        description="Legal identity and tax identifiers rendered on customer invoices and official agreements."
      >
        {/* Logo Upload */}
        <SettingsRow
          icon={Building2}
          title="Organization Brandmark / Logo"
          description="Rendered at the top of generated invoices and workspace headers."
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-line flex items-center justify-center font-bold text-text overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-xs font-mono font-bold">
                  {(name || 'A').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {canEditWorkspace && (
              <label className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-text border border-line text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
                <Upload size={12} />
                <span>{uploadingLogo ? 'Uploading...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </SettingsRow>

        {/* Workspace Name */}
        <SettingsRow
          icon={Building2}
          title="Company Legal Name"
          description="Formal registered company name."
        >
          <input
            type="text"
            value={name}
            disabled={!canEditWorkspace}
            onChange={(e) => {
              setName(e.target.value);
              handleFieldChange('workspaceName', e.target.value);
            }}
            placeholder="Skavelon Technologies Pvt Ltd"
            className="w-full sm:w-72 px-3.5 py-1.5 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent disabled:opacity-50"
          />
        </SettingsRow>

        {/* Registered Address */}
        <SettingsRow
          icon={MapPin}
          title="Registered Business Address"
          description="Complete physical headquarters address."
        >
          <textarea
            value={address}
            disabled={!canEditWorkspace}
            rows={2}
            onChange={(e) => {
              setAddress(e.target.value);
              handleFieldChange('workspaceAddress', e.target.value);
            }}
            placeholder="Suite 400, Innovation Tower, Cyber City"
            className="w-full sm:w-72 px-3.5 py-1.5 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent disabled:opacity-50 resize-none font-sans"
          />
        </SettingsRow>

        {/* GST / Tax ID */}
        <SettingsRow
          icon={Receipt}
          title="GSTIN / Tax Identification"
          description="Official tax identifier for B2B tax compliance."
        >
          <input
            type="text"
            value={gst}
            disabled={!canEditWorkspace}
            onChange={(e) => {
              setGst(e.target.value);
              handleFieldChange('workspaceGst', e.target.value);
            }}
            placeholder="e.g. 29AAAAA0000A1Z5"
            className="w-full sm:w-72 px-3.5 py-1.5 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent font-mono disabled:opacity-50"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Regional & Fiscal Policy ── */}
      <SettingsSection
        label="Timezone & Fiscal Calendar"
        description="Operational timezone and fiscal cycles applied to project milestones and telemetry."
      >
        {/* Timezone */}
        <SettingsRow
          icon={Clock}
          title="Primary Timezone"
          description="Affects workflow cron jobs, automated reminders, and calendar synchronization."
        >
          <Select
            value={timezone}
            disabled={!canEditWorkspace}
            onChange={(e) => {
              setTimezone(e.target.value);
              handleFieldChange('timezone', e.target.value);
            }}
            options={TIMEZONE_OPTIONS}
            size="sm"
          />
        </SettingsRow>

        {/* Date Format */}
        <SettingsRow
          icon={Calendar}
          title="Date Display Format"
          description="Formatting pattern for tasks, invoices, and ledger tables."
        >
          <Select
            value={dateFormat}
            disabled={!canEditWorkspace}
            onChange={(e) => {
              setDateFormat(e.target.value);
              handleFieldChange('dateFormat', e.target.value);
            }}
            options={DATE_FORMAT_OPTIONS}
            size="sm"
          />
        </SettingsRow>

        {/* Fiscal Year */}
        <SettingsRow
          icon={Coins}
          title="Fiscal Year Commencement"
          description="Defines yearly accounting start period for financial summaries."
        >
          <Select
            value={fiscalYear}
            disabled={!canEditWorkspace}
            onChange={(e) => {
              setFiscalYear(e.target.value);
              handleFieldChange('fiscalYear', e.target.value);
            }}
            options={FISCAL_YEAR_OPTIONS}
            size="sm"
          />
        </SettingsRow>
      </SettingsSection>

      {/* Local Save / Discard Bar for Organization */}
      {isDirty && canEditWorkspace && (
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-muted hover:text-text border border-line text-xs font-semibold transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
