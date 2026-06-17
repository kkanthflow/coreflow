import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface PremiumInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
  inputClassName?: string;
}

export function PremiumInput({
  label,
  error,
  containerClassName,
  inputClassName,
  ...props
}: PremiumInputProps) {
  const colors = useColors();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View className={containerClassName}>
      {label && (
        <Text className="text-sm font-semibold text-foreground mb-2">
          {label}
        </Text>
      )}

      <TextInput
        {...props}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={colors.muted}
        className={cn(
          'px-4 py-3 rounded-lg border border-border bg-surface text-base text-foreground',
          isFocused && 'border-primary',
          error && 'border-error',
          inputClassName
        )}
        style={{
          borderColor: error ? colors.error : isFocused ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          color: colors.foreground,
        }}
      />

      {error && (
        <Text className="text-sm text-error mt-1">
          {error}
        </Text>
      )}
    </View>
  );
}
