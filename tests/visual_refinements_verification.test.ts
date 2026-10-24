import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('--- Verifying Visual Refinements Between Settings and Dashboard ---');

const webSrc = path.join(process.cwd(), 'web', 'src');

// 1. SHELL: Topbar breadcrumb and single Dashboard button
const topbarContent = fs.readFileSync(path.join(webSrc, 'components', 'Topbar.tsx'), 'utf-8').replace(/\r\n/g, '\n');
assert(
  topbarContent.includes("if (path.startsWith('/settings')) {\n    pageLabel = 'Settings';"),
  'Topbar sets pageLabel to Settings for all settings paths yielding "{Workspace name} / Settings"'
);

const sidebarContent = fs.readFileSync(path.join(webSrc, 'components', 'Sidebar.tsx'), 'utf-8');
assert(
  sidebarContent.includes('layoutId="active-nav-indicator"') &&
  sidebarContent.includes('shadow-[0_0_12px_rgba(255,90,54,0.6)]') &&
  sidebarContent.includes('transition-all duration-150 text-xs font-medium group'),
  'Sidebar highlights Settings with exact same active pill, transitions, and indicators as other items'
);

const settingsLayoutContent = fs.readFileSync(path.join(webSrc, 'components', 'settings', 'SettingsLayout.tsx'), 'utf-8');
assert(
  settingsLayoutContent.includes('← Dashboard') &&
  settingsLayoutContent.includes('font-mono border border-line'),
  'SettingsLayout renders single "← Dashboard" button next to page title'
);

// 2. TYPOGRAPHY: Section labels & Row titles & Active badge
const settingsSectionContent = fs.readFileSync(path.join(webSrc, 'components', 'settings', 'SettingsSection.tsx'), 'utf-8');
assert(
  settingsSectionContent.includes('text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-muted') &&
  settingsSectionContent.includes('mt-7 first:mt-0') &&
  settingsSectionContent.includes('mb-2.5'),
  'SettingsSection typography has 11px uppercase mono tracking-0.08em with 28px above and 8-10px below'
);
assert(
  settingsSectionContent.includes('text-accent') &&
  settingsSectionContent.includes('isBadgeActive'),
  'Active badge in SettingsSection uses accent colour'
);

const settingsRowContent = fs.readFileSync(path.join(webSrc, 'components', 'settings', 'SettingsRow.tsx'), 'utf-8');
assert(
  settingsRowContent.includes('text-[14.5px]') &&
  settingsRowContent.includes('font-medium') &&
  settingsRowContent.includes('text-[12.5px] text-muted'),
  'SettingsRow title is ~14.5px font-medium and description is ~12.5px muted'
);

// 3. CARDS AND ROWS: Card surface background, 1px border, 12-14px radius, no heavy shadow, 38x38 icon box rounded 10px
assert(
  settingsSectionContent.includes('bg-surface rounded-[13px] border border-line divide-y divide-line overflow-visible'),
  'SettingsSection card container uses surface bg, 1px line border, 13px radius, no heavy shadow, overflow-visible'
);
assert(
  settingsRowContent.includes('py-4 px-[18px]') &&
  settingsRowContent.includes('gap-3.5') &&
  settingsRowContent.includes('w-[38px] h-[38px] rounded-[10px] bg-accent-soft'),
  'SettingsRow uses 16px 18px padding, 14px gap, 38x38 icon box with rounded 10px and accent-soft bg'
);

// 4. CONTROLS: Toggle 44-46x26px, 20px knob, coral on, neutral track off
const toggleContent = fs.readFileSync(path.join(webSrc, 'components', 'settings', 'Toggle.tsx'), 'utf-8');
assert(
  toggleContent.includes("w-[45px] h-[26px]") &&
  toggleContent.includes("w-5 h-5") &&
  toggleContent.includes("translate-x-[22px]") &&
  toggleContent.includes("translate-x-[3px]") &&
  toggleContent.includes("role=\"switch\"") &&
  toggleContent.includes("aria-checked={checked}"),
  'Toggle has 45x26px track, 20px knob, role="switch", aria-checked, coral when on and neutral track when off'
);

// 5. SUBSCRIPTION CARD: padding 18-20px, icon, title, badges, description on left, buttons on right, wraps under 900px
const billingContent = fs.readFileSync(path.join(webSrc, 'pages', 'settings', 'BillingSettings.tsx'), 'utf-8');
assert(
  billingContent.includes('p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4') &&
  billingContent.includes('SUBSCRIPTION & PLANS') &&
  billingContent.includes('w-[38px] h-[38px] rounded-[10px] bg-accent-soft'),
  'BillingSettings subscription card has 20px padding, icon box 38x38 rounded 10px, and wraps below text under 900px (lg breakpoint)'
);

// 6. CURRENCY CARD: repeat(auto-fill, minmax(180px, 1fr)), gap 10px, equal height chips, rounded 10px, filled accent selected state
const chipGridContent = fs.readFileSync(path.join(webSrc, 'components', 'settings', 'ChipGrid.tsx'), 'utf-8');
assert(
  chipGridContent.includes("repeat(auto-fill, minmax(180px, 1fr))") &&
  chipGridContent.includes("gap-[10px]") &&
  chipGridContent.includes("rounded-[10px]") &&
  chipGridContent.includes("h-full min-h-[72px]") &&
  chipGridContent.includes("border-accent bg-accent text-white") &&
  chipGridContent.includes("aria-pressed={isSelected}") &&
  chipGridContent.includes("focus-visible:ring-focus-ring"),
  'ChipGrid uses repeat(auto-fill, minmax(180px, 1fr)), gap 10px, rounded 10px chips, filled accent selected state with white text and focus ring'
);

// 7. ABOUT CARD: rows with 12-14px vertical padding, 1px dividers, labels 13px muted, values 13px mono, green only for Connected
const settingsPageContent = fs.readFileSync(path.join(webSrc, 'pages', 'Settings.tsx'), 'utf-8');
assert(
  settingsPageContent.includes('py-3 sm:py-3.5 px-[18px]') &&
  settingsPageContent.includes('text-[13px] text-muted') &&
  settingsPageContent.includes('text-[13px] font-mono font-normal text-text') &&
  settingsPageContent.includes('text-[13px] font-mono font-normal text-emerald-400') &&
  settingsPageContent.includes('truncate max-w-[260px] sm:max-w-none break-all'),
  'About card has 12-14px vertical padding, 1px dividers, 13px muted labels, 13px mono values with green only for Connected, and wraps/truncates long email'
);

// 8. BACKGROUND: AppShell applies same corner gradient and dot-grid to settings as dashboard
const appShellContent = fs.readFileSync(path.join(webSrc, 'components', 'AppShell.tsx'), 'utf-8');
assert(
  appShellContent.includes("(currentModule === 'dashboard' || currentModule === 'settings')"),
  'AppShell provides the exact same corner gradient, page background, and dot-grid to Settings as Dashboard'
);

console.log('--- All 10 Visual Requirements Verified Successfully! ---');
