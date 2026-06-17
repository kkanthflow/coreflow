import React from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getRoleColor } from '@/lib/_core/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface RoleBadgeProps {
  role: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'filled' | 'outline' | 'subtle';
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  // Enterprise roles
  owner:            'Owner',
  administrator:    'Administrator',
  director:         'Director',
  senior_manager:   'Senior Manager',
  manager:          'Manager',
  team_lead:        'Team Lead',
  senior_employee:  'Senior Employee',
  employee:         'Employee',
  intern:           'Intern',
  freelancer:       'Freelancer',
  // Legacy aliases
  managing_director: 'Owner',
  ceo:              'Owner',
  cto:              'Owner',
  project_manager:  'Manager',
  hr:               'Administrator',
  developer:        'Employee',
  general_member:   'Employee',
};

export function RoleBadge({ role, size = 'md', variant = 'filled' }: RoleBadgeProps) {
  const scheme = useColorScheme();
  const colors = useColors();
  const roleColor = getRoleColor(role, scheme || 'light');

  const sizeStyles = {
    sm: { px: 8,  py: 3,  radius: 6,  fontSize: 11 },
    md: { px: 10, py: 5,  radius: 8,  fontSize: 12 },
    lg: { px: 14, py: 7,  radius: 10, fontSize: 14 },
  }[size];

  const displayName =
    ROLE_DISPLAY_NAMES[role] ||
    (typeof role === 'string'
      ? role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'Member');

  if (variant === 'outline') {
    return (
      <View
        style={{
          borderWidth: 1.5,
          borderColor: roleColor,
          paddingHorizontal: sizeStyles.px,
          paddingVertical: sizeStyles.py,
          borderRadius: sizeStyles.radius,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          style={{
            color: roleColor,
            fontSize: sizeStyles.fontSize,
            fontWeight: '700',
            letterSpacing: 0.3,
          }}
        >
          {displayName}
        </Text>
      </View>
    );
  }

  if (variant === 'subtle') {
    return (
      <View
        style={{
          backgroundColor: `${roleColor}18`,
          paddingHorizontal: sizeStyles.px,
          paddingVertical: sizeStyles.py,
          borderRadius: sizeStyles.radius,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          style={{
            color: roleColor,
            fontSize: sizeStyles.fontSize,
            fontWeight: '700',
            letterSpacing: 0.3,
          }}
        >
          {displayName}
        </Text>
      </View>
    );
  }

  // filled (default)
  return (
    <View
      style={{
        backgroundColor: roleColor,
        paddingHorizontal: sizeStyles.px,
        paddingVertical: sizeStyles.py,
        borderRadius: sizeStyles.radius,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: sizeStyles.fontSize,
          fontWeight: '700',
          letterSpacing: 0.3,
        }}
      >
        {displayName}
      </Text>
    </View>
  );
}

// Utility: get display name without rendering a component
export function getRoleDisplayName(role: string | undefined | null): string {
  if (!role) return 'Member';
  return (
    ROLE_DISPLAY_NAMES[role] ||
    role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  );
}
