# Auvryn Workspace Platform

Auvryn is a high-performance modern workspace platform integrating project management, deliverable tracking, LiveKit video conferencing, workflow causality automations, customer client portals, and invoice settlements.

---

## 1. Design Tokens Reference

Auvryn utilizes a CSS-variable design token system declared on `:root` (Light mode) and `[data-theme="dark"]` / `.dark` (Dark mode) inside `web/src/index.css`. All tokens are exposed to Tailwind utilities via `web/tailwind.config.js`.

| Design Token | CSS Variable | Dark Value | Light Value | Semantic Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Background** | `--bg` | `#0a0b0e` | `#f8fafc` | Application canvas viewport background |
| **Surface** | `--surface` | `#111216` | `#ffffff` | Primary container cards, sidebars, modal surfaces |
| **Surface 2** | `--surface-2` | `#181920` | `#f1f5f9` | Inputs, dropdown menus, button hover states, pills |
| **Text** | `--text` | `#f8fafc` | `#0f172a` | Primary headlines, form values, high-contrast labels |
| **Muted** | `--muted` | `#94a3b8` | `#64748b` | Secondary descriptions, timestamps, metadata labels |
| **Line / Divider** | `--line` | `#232530` | `#e2e8f0` | 1px borders, card dividers, table separators |
| **Accent (Coral)** | `--accent` | `#ff5a36` | `#ff5a36` | Primary action buttons, active indicators, brand logo |
| **Accent Soft** | `--accent-soft` | `rgba(255,90,54,0.12)` | `rgba(255,90,54,0.10)` | Active tab pills, badge backgrounds, chip selections |
| **Success** | `--success` | `#10b981` | `#059669` | Nominal health telemetry, verified status, active pills |
| **Warning** | `--warning` | `#f59e0b` | `#d97706` | Pending approvals, attention required, quota > 75% |
| **Danger** | `--danger` | `#ef4444` | `#dc2626` | Critical blockers, destructive actions, quota > 90% |
| **Focus Ring** | `--focus-ring` | `rgba(255,90,54,0.45)` | `rgba(255,90,54,0.35)` | Keyboard accessibility outline ring (`:focus-visible`) |

### Pre-Paint Theme Script
Theme flashes during page loads are eliminated by an inline pre-paint script located in `web/index.html`'s `<head>`. It inspects `localStorage.getItem('app-theme')` or falls back to `window.matchMedia('(prefers-color-scheme: dark)')` to immediately mount `data-theme="dark|light"` before the DOM renders.

---

## 2. How to Add a New Settings Section / Page

To extend the settings module with a new subpage (e.g. `/settings/export`):

1. **Create the Page Component**:
   Create `web/src/pages/settings/ExportSettings.tsx`:
   ```tsx
   import React from 'react';
   import { SettingsSection, SettingsRow, Toggle } from '../../components/settings';

   export default function ExportSettings() {
     return (
       <div className="space-y-6">
         <SettingsSection label="Workspace Data Export" description="Download an encrypted snapshot of workspace data.">
           <SettingsRow title="Automatic Nightly Backups" description="Sync to external cloud storage bucket.">
             <Toggle checked={true} onChange={() => {}} />
           </SettingsRow>
         </SettingsSection>
       </div>
     );
   }
   ```

2. **Register the Lazy Route in `web/src/App.tsx`**:
   ```tsx
   const ExportSettings = lazyWithRetry(() => import('./pages/settings/ExportSettings'));

   // Inside <Route path="/settings" element={<SettingsLayout />}>
   <Route path="export" element={<Suspense fallback={<PageLoader />}><ExportSettings /></Suspense>} />
   ```

3. **Add Navigation Link in `web/src/components/settings/SettingsNav.tsx`**:
   Add to `MY_SETTINGS_ITEMS` or `WORKSPACE_SETTINGS_ITEMS`:
   ```tsx
   { name: 'Export', to: '/settings/export', icon: DownloadIcon, adminOnly: true }
   ```

4. **Add Page Title & Metadata in `web/src/components/settings/SettingsLayout.tsx`**:
   ```tsx
   export: {
     title: 'Data Export',
     description: 'Configure automated workspace backups and manual JSON/CSV data archives.',
   }
   ```

5. **Register Dynamic Breadcrumb in `web/src/components/Topbar.tsx`**:
   Add `'export': 'Settings / Data Export'` to `subLabels`.

---

## 3. How to Add a New Supported Currency

Auvryn supports 9 core currencies with reactive workspace formatting (USD, INR, EUR, GBP, AED, SGD, AUD, CAD, JPY). To add a new currency (e.g., Swiss Franc `CHF`):

1. Open `web/src/lib/currency.ts`.
2. Add the currency definition to `SUPPORTED_CURRENCIES`:
   ```ts
   { code: 'CHF', symbol: 'CHF', locale: 'de-CH', name: 'Swiss Franc (CHF)' }
   ```
3. That's it!
   - The `ChipGrid` in `/settings/organization` automatically displays the new currency chip.
   - `SettingsContext.formatMoney` automatically formats workspace revenue, invoices, and metrics using the configured locale.
   - *Note:* Subscription checkout and plan prices strictly remain in standard INR per business policy.

---

## 4. Rebranding Guide: The 3 Places to Touch

Auvryn strictly separates the **Product** name from the active **Workspace Organization** name. Never hardcode either name.

| Target | File / Location | Description |
| :--- | :--- | :--- |
| **1. Product Brand Config** | `web/src/brand.ts` | The single source of truth for `BRAND.productName` ("Auvryn"), `BRAND.company`, `BRAND.primaryColor` (`#FF5A36`), and logo assets. |
| **2. Document Title & Favicons** | `web/index.html` | The HTML `<title>` tag and web application manifest metadata. |
| **3. Organization Workspace Name** | Database (`organizations.name`) or `/settings/organization` | The dynamic workspace organization (e.g. "Skavelon Technologies") rendered in the sidebar header and topbar breadcrumbs. |

---

## 5. Local Development & Production Build Commands

Auvryn is host-agnostic and does not depend on any proprietary cloud vendor CLI or Vercel tooling.

### Prerequisites
- Node.js `20.18+` or `22.x`
- npm `10.x+`

### Setup & Local Development
```bash
# Install root dependencies
npm install

# Run full development stack (Frontend on :5173, Backend API on :3000)
npm run dev
```

### Production Build
```bash
# Build frontend web bundle (outputs to web/dist)
npm run build --prefix web

# Build backend server bundle (outputs to dist-server)
npm run build --prefix server
```

### Running Test Verification Suites
```bash
# Run Theme, Token & Currency unit tests
npx tsx tests/run_theme_tests.ts

# Run Settings Shell & Nested Routing verification
npx tsx tests/batch2_shell.test.ts

# Run Shared Primitives (Toggle, SegmentedControl, ChipGrid, SaveBar) tests
npx tsx tests/batch3_primitives.test.ts

# Run My Settings pages (Password strength, device fallback, accent presets) tests
npx tsx tests/batch4_my_settings.test.ts

# Run Workspace Settings (Currency switching, quota bars, member roles) tests
npx tsx tests/batch5_workspace_settings.test.ts

# Run Full End-to-End Suite
npx tsx tests/batch6_e2e_verification.test.ts
```
