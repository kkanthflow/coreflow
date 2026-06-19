export const themeColors: {
  primary: { light: string; dark: string };
  secondary: { light: string; dark: string };
  tertiary: { light: string; dark: string };
  background: { light: string; dark: string };
  surface: { light: string; dark: string };
  card: { light: string; dark: string };
  overlay: { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  secondary_text: { light: string; dark: string };
  disabled: { light: string; dark: string };
  border: { light: string; dark: string };
  divider: { light: string; dark: string };
  glass: { light: string; dark: string };
  shadow: { light: string; dark: string };
  chat_bubble: { light: string; dark: string };
  nav_active: { light: string; dark: string };
  success: { light: string; dark: string };
  warning: { light: string; dark: string };
  error: { light: string; dark: string };
  info: { light: string; dark: string };
  hover: { light: string; dark: string };
  role_owner: { light: string; dark: string };
  role_administrator: { light: string; dark: string };
  role_director: { light: string; dark: string };
  role_senior_manager: { light: string; dark: string };
  role_manager: { light: string; dark: string };
  role_team_lead: { light: string; dark: string };
  role_senior_employee: { light: string; dark: string };
  role_employee: { light: string; dark: string };
  role_intern: { light: string; dark: string };
  role_freelancer: { light: string; dark: string };
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
