/** @type {const} */
const themeColors = {
  // ── Primary Accents ──────────────────────────────────────────
  primary:   { light: '#FF6B4A', dark: '#FF6B4A' },
  secondary: { light: '#FFA86B', dark: '#FFA86B' },
  tertiary:  { light: '#3B82F6', dark: '#60A5FA' },

  // ── Backgrounds ──────────────────────────────────────────────
  background: { light: '#F9FAFB', dark: '#07070B' },
  surface:    { light: '#FFFFFF', dark: '#111118' },
  card:       { light: 'rgba(255, 255, 255, 0.92)', dark: 'rgba(24, 24, 34, 0.92)' },
  overlay:    { light: '#F3F4F6', dark: '#1D1D29' },

  // ── Text ─────────────────────────────────────────────────────
  foreground: { light: '#0F172A', dark: '#F5F5FA' },
  muted:      { light: '#64748B', dark: '#7A7A92' },
  secondary_text: { light: '#475569', dark: '#B4B4C7' },
  disabled:   { light: '#94A3B8', dark: '#4B5563' },

  // ── UI Elements ──────────────────────────────────────────────
  border:   { light: 'rgba(226, 232, 240, 0.85)', dark: 'rgba(42, 42, 58, 0.85)' },
  divider:  { light: '#E2E8F0', dark: '#333347' },
  glass:    { light: 'rgba(0, 0, 0, 0.02)', dark: 'rgba(255, 255, 255, 0.03)' },
  shadow:   { light: '#0F172A15', dark: '#000000A0' },

  // ── Chat ─────────────────────────────────────────────────────
  chat_bubble: { light: '#F1F5F9', dark: '#1D1D29' },

  // ── Nav ──────────────────────────────────────────────────────
  nav_active:  { light: '#FF6B4A15', dark: '#FF6B4A20' },

  // ── Status ───────────────────────────────────────────────────
  success: { light: '#10B981', dark: '#34D399' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  error:   { light: '#EF4444', dark: '#F87171' },
  info:    { light: '#3B82F6', dark: '#60A5FA' },

  // ── Hover ────────────────────────────────────────────────────
  hover: { light: '#E85A3A', dark: '#E85A3A' },

  // ── Role Colors ──────────────────────────────────────────────
  role_owner:          { light: '#FF6B4A', dark: '#FF6B4A' },
  role_administrator:  { light: '#F97316', dark: '#FFA86B' },
  role_manager:        { light: '#DB2777', dark: '#EC4899' },
  role_team_lead:      { light: '#EA580C', dark: '#F97316' },
  role_team_member:    { light: '#16A34A', dark: '#22C55E' },
  role_employee:       { light: '#16A34A', dark: '#22C55E' },
  role_guest:          { light: '#64748B', dark: '#7A7A92' },
  role_client:         { light: '#0D9488', dark: '#14B8A6' },
};

module.exports = { themeColors };
