import React from 'react';
import { Pressable, Text, View, ViewStyle, TextStyle } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface PremiumButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
  textClassName?: string;
  textStyle?: TextStyle;
}

export function PremiumButton({
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  children,
  className,
  style,
  textClassName,
  textStyle,
}: PremiumButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const sizeClasses = {
    sm: 'px-3 py-2 rounded-lg',
    md: 'px-6 py-3 rounded-xl',
    lg: 'px-8 py-4 rounded-2xl',
  };

  const textSizeClasses = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-semibold',
    lg: 'text-lg font-bold',
  };

  const variantClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    outline: 'border-2 border-primary',
    ghost: 'bg-transparent',
  };

  const textColorClasses = {
    primary: 'text-background',
    secondary: 'text-background',
    outline: 'text-primary',
    ghost: 'text-primary',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
          transform: pressed && !isDisabled ? [{ scale: 0.97 }] : [{ scale: 1 }],
        },
        style,
      ]}
    >
      <View
        className={cn(
          'items-center justify-center',
          sizeClasses[size],
          variantClasses[variant],
          isDisabled && 'opacity-50',
          className
        )}
      >
        {loading ? (
          <Text className="text-base">...</Text>
        ) : typeof children === 'string' ? (
          <Text
            className={cn(
              textSizeClasses[size],
              textColorClasses[variant],
              'text-center',
              textClassName
            )}
            style={textStyle}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}
