/** @type {const} */
const themeColors = {
  // ── Primary Accents ──────────────────────────────────────────
  primary:   { light: '#1F6FEB', dark: '#3B82F6' },
  secondary: { light: '#7C3AED', dark: '#8B5CF6' },
  tertiary:  { light: '#06B6D4', dark: '#22D3EE' },

  // ── Backgrounds ──────────────────────────────────────────────
  background: { light: '#FFFFFF', dark: '#0F172A' },
  surface:    { light: '#F8FAFC', dark: '#1E293B' },
  overlay:    { light: '#F1F5F9', dark: '#263348' },

  // ── Text ─────────────────────────────────────────────────────
  foreground: { light: '#0F172A', dark: '#F1F5F9' },
  muted:      { light: '#64748B', dark: '#94A3B8' },

  // ── UI Elements ──────────────────────────────────────────────
  border: { light: '#E2E8F0', dark: '#334155' },

  // ── Status ───────────────────────────────────────────────────
  success: { light: '#10B981', dark: '#34D399' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  error:   { light: '#EF4444', dark: '#F87171' },
  info:    { light: '#3B82F6', dark: '#60A5FA' },

  // ── Enterprise Role Colors ───────────────────────────────────
  // Owner          — Deep Royal Blue (authority)
  role_owner:         { light: '#1E3A8A', dark: '#2563EB' },
  // Administrator  — Indigo (management)
  role_administrator: { light: '#3730A3', dark: '#4F46E5' },
  // Director       — Violet (senior leadership)
  role_director:      { light: '#6D28D9', dark: '#7C3AED' },
  // Senior Manager — Purple-Pink
  role_senior_manager:{ light: '#7C3AED', dark: '#9333EA' },
  // Manager        — Pink (team leadership)
  role_manager:       { light: '#BE185D', dark: '#EC4899' },
  // Team Lead      — Orange (frontline)
  role_team_lead:     { light: '#C2410C', dark: '#F97316' },
  // Senior Employee — Teal
  role_senior_employee:{ light: '#0F766E', dark: '#14B8A6' },
  // Employee       — Green (working level)
  role_employee:      { light: '#15803D', dark: '#22C55E' },
  // Intern         — Gray-Blue (entry)
  role_intern:        { light: '#475569', dark: '#94A3B8' },
  // Freelancer     — Amber (external)
  role_freelancer:    { light: '#B45309', dark: '#F59E0B' },

  // ── Legacy Role Colors (preserved for backward compat) ───────
  role_md:     { light: '#1E3A8A', dark: '#2563EB' },
  role_ceo:    { light: '#3730A3', dark: '#4F46E5' },
  role_cto:    { light: '#06B6D4', dark: '#22D3EE' },
  role_pm:     { light: '#BE185D', dark: '#EC4899' },
  role_hr:     { light: '#F59E0B', dark: '#FBBF24' },
  role_dev:    { light: '#15803D', dark: '#22C55E' },
  role_member: { light: '#475569', dark: '#94A3B8' },
};

module.exports = { themeColors };
