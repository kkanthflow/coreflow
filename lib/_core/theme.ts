import { Platform } from "react-native";

import themeConfig from "@/theme.config";

export type ColorScheme = "light" | "dark";

export const ThemeColors = themeConfig.themeColors;

type ThemeColorTokens = typeof ThemeColors;
type ThemeColorName = keyof ThemeColorTokens;
type SchemePalette = Record<ColorScheme, Record<ThemeColorName, string>>;
type SchemePaletteItem = SchemePalette[ColorScheme];

function buildSchemePalette(colors: ThemeColorTokens): SchemePalette {
  const palette: SchemePalette = {
    light: {} as SchemePalette["light"],
    dark: {} as SchemePalette["dark"],
  };

  (Object.keys(colors) as ThemeColorName[]).forEach((name) => {
    const swatch = colors[name];
    palette.light[name] = swatch.light;
    palette.dark[name] = swatch.dark;
  });

  return palette;
}

export const SchemeColors = buildSchemePalette(ThemeColors);

type RuntimePalette = SchemePaletteItem & {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
};

function buildRuntimePalette(scheme: ColorScheme): RuntimePalette {
  const base = SchemeColors[scheme];
  return {
    ...base,
    text: base.foreground,
    background: base.background,
    tint: base.primary,
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: base.primary,
    border: base.border,
  };
}

export const Colors = {
  light: buildRuntimePalette("light"),
  dark: buildRuntimePalette("dark"),
} satisfies Record<ColorScheme, RuntimePalette>;

export type ThemeColorPalette = (typeof Colors)[ColorScheme];

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ─────────────────────────────────────────────────────────────────────
// Enterprise role → theme color token mapping
// ─────────────────────────────────────────────────────────────────────
export const roleColorMap = {
  // New enterprise roles
  owner:            'role_owner',
  administrator:    'role_administrator',
  director:         'role_director',
  senior_manager:   'role_senior_manager',
  manager:          'role_manager',
  team_lead:        'role_team_lead',
  senior_employee:  'role_senior_employee',
  employee:         'role_employee',
  intern:           'role_intern',
  freelancer:       'role_freelancer',
  // Legacy aliases (backward compat)
  managing_director: 'role_owner',
  ceo:              'role_owner',
  cto:              'role_owner',
  project_manager:  'role_manager',
  hr:               'role_administrator',
  developer:        'role_employee',
  general_member:   'role_member',
} as const;

export type UserRole = keyof typeof roleColorMap;

// Helper to get role color from role name
export function getRoleColor(role: string, scheme: ColorScheme): string {
  const colorKey = (roleColorMap as Record<string, string>)[role] as keyof typeof SchemeColors.light;
  if (!colorKey) return SchemeColors[scheme].muted;
  return (SchemeColors[scheme] as Record<string, string>)[colorKey] || SchemeColors[scheme].muted;
}
