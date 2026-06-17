export const themeColors: {
  primary: { light: string; dark: string };
  secondary: { light: string; dark: string };
  tertiary: { light: string; dark: string };
  background: { light: string; dark: string };
  surface: { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  border: { light: string; dark: string };
  success: { light: string; dark: string };
  warning: { light: string; dark: string };
  error: { light: string; dark: string };
  role_md: { light: string; dark: string };
  role_ceo: { light: string; dark: string };
  role_cto: { light: string; dark: string };
  role_pm: { light: string; dark: string };
  role_hr: { light: string; dark: string };
  role_dev: { light: string; dark: string };
  role_member: { light: string; dark: string };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
};

export default themeConfig;
