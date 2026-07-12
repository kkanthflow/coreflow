import React from 'react';
import { ViewStyle } from 'react-native';

export type KPIStatus = "success" | "warning" | "error" | "info" | "neutral";
export type KPIVariant = "compact" | "default" | "expanded" | "minimal";

export interface KPITrendData {
  value: number;
  direction: "up" | "down";
}

export interface KPIBadgeData {
  label: string;
  color: string;
}

export interface PremiumKPIData {
  title: string;
  value: string | number;
  progress?: number; // Precalculated progress (0-1) or calculated via value/maxValue
  subtitle?: string;
  trend?: KPITrendData;
  badge?: KPIBadgeData;
  status?: KPIStatus;
  footer?: React.ReactNode;
}

export interface PremiumKPIProps {
  data: PremiumKPIData;
  icon: React.ReactNode;
  variant?: KPIVariant;
  onPress?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}
