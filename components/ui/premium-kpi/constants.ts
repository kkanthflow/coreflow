import { KPIStatus } from './types';

export const getStatusColors = (status: KPIStatus | undefined, colors: any) => {
  switch (status) {
    case 'success':
      return {
        accent: colors.success || '#34D399',
        bg: `${colors.success || '#34D399'}15`,
        border: `${colors.success || '#34D399'}30`,
      };
    case 'warning':
      return {
        accent: colors.warning || '#FBBF24',
        bg: `${colors.warning || '#FBBF24'}15`,
        border: `${colors.warning || '#FBBF24'}30`,
      };
    case 'error':
      return {
        accent: colors.error || '#F87171',
        bg: `${colors.error || '#F87171'}15`,
        border: `${colors.error || '#F87171'}30`,
      };
    case 'info':
      return {
        accent: colors.info || '#60A5FA',
        bg: `${colors.info || '#60A5FA'}15`,
        border: `${colors.info || '#60A5FA'}30`,
      };
    case 'neutral':
    default:
      return {
        accent: colors.muted || '#7A7A92',
        bg: `${colors.muted || '#7A7A92'}15`,
        border: `${colors.muted || '#7A7A92'}30`,
      };
  }
};
