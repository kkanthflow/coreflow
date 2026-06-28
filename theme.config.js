/** @type {const} */
const themeColors = {
  // ── Primary Accents ──────────────────────────────────────────
  primary:   { light: '#FF6B4A', dark: '#FF6B4A' },
  secondary: { light: '#FFA86B', dark: '#FFA86B' },
  tertiary:  { light: '#60A5FA', dark: '#60A5FA' },

  // ── Backgrounds ──────────────────────────────────────────────
  background: { light: '#FFFFFF', dark: '#07070B' },
  surface:    { light: '#FFFFFF', dark: '#111118' },
  card:       { light: '#F8F9FA', dark: '#181822' },
  overlay:    { light: '#F1F3F5', dark: '#1D1D29' },

  // ── Text ─────────────────────────────────────────────────────
  foreground: { light: '#111118', dark: '#F5F5FA' },
  muted:      { light: '#7A7A92', dark: '#7A7A92' },
  secondary_text: { light: '#6B7280', dark: '#B4B4C7' },
  disabled:   { light: '#ADB5BD', dark: '#5A5A70' },

  // ── UI Elements ──────────────────────────────────────────────
  border:   { light: '#E5E7EB', dark: '#2A2A3A' },
  divider:  { light: '#F3F4F6', dark: '#333347' },
  glass:    { light: '#FFFFFF40', dark: '#FFFFFF08' },
  shadow:   { light: '#00000008', dark: '#00000080' },

  // ── Chat ─────────────────────────────────────────────────────
  chat_bubble: { light: '#F1F3F5', dark: '#1D1D29' },

  // ── Nav ──────────────────────────────────────────────────────
  nav_active:  { light: '#FF6B4A20', dark: '#FF6B4A20' },

  // ── Status ───────────────────────────────────────────────────
  success: { light: '#10B981', dark: '#34D399' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  error:   { light: '#EF4444', dark: '#F87171' },
  info:    { light: '#3B82F6', dark: '#60A5FA' },

  // ── Hover ────────────────────────────────────────────────────
  hover: { light: '#FF845F', dark: '#FF845F' },

  // ── Enterprise Role Colors ───────────────────────────────────
  role_owner:          { light: '#FF6B4A', dark: '#FF6B4A' },
  role_administrator:  { light: '#FFA86B', dark: '#FFA86B' },
  role_director:       { light: '#60A5FA', dark: '#60A5FA' },
  role_senior_manager: { light: '#8B5CF6', dark: '#A78BFA' },
  role_manager:        { light: '#EC4899', dark: '#F472B6' },
  role_team_lead:      { light: '#F97316', dark: '#FB923C' },
  role_senior_employee:{ light: '#14B8A6', dark: '#2DD4BF' },
  role_employee:       { light: '#22C55E', dark: '#34D399' },
  role_intern:         { light: '#7A7A92', dark: '#B4B4C7' },
  role_freelancer:     { light: '#FBBF24', dark: '#FBBF24' },

  // ── Legacy Role Colors (preserved for backward compat) ───────
  role_md:     { light: '#FF6B4A', dark: '#FF6B4A' },
  role_ceo:    { light: '#FF6B4A', dark: '#FF6B4A' },
  role_cto:    { light: '#60A5FA', dark: '#60A5FA' },
  role_pm:     { light: '#EC4899', dark: '#F472B6' },
  role_hr:     { light: '#FFA86B', dark: '#FFA86B' },
  role_dev:    { light: '#22C55E', dark: '#34D399' },
  role_member: { light: '#7A7A92', dark: '#B4B4C7' },
};

module.exports = { themeColors };
