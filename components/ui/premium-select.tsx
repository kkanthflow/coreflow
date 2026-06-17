import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';
import clsx from 'clsx';

export interface SelectOption {
  label: string;
  value: string;
}

interface PremiumSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function PremiumSelect({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select an option',
  error,
  disabled = false,
}: PremiumSelectProps) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-foreground mb-2 ml-1">
        {label}
      </Text>

      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        className={clsx(
          'flex-row items-center justify-between px-4 py-3.5 rounded-xl border',
          error ? 'border-error bg-error/5' : 'border-border',
          disabled && 'opacity-50',
        )}
        style={{ backgroundColor: error ? undefined : colors.surface }}
      >
        <Text
          className={clsx(
            'text-base',
            selectedOption ? 'text-foreground' : 'text-muted'
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>

      {error && (
        <Text className="text-xs text-error mt-1 ml-1">{error}</Text>
      )}

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable
            className="flex-1"
            onPress={() => setIsOpen(false)}
          />
          <View
            className="w-full rounded-t-3xl pt-2 pb-8 px-4"
            style={{ backgroundColor: colors.background }}
          >
            <View className="w-12 h-1.5 rounded-full bg-border self-center mb-6" />
            
            <Text className="text-xl font-bold text-foreground mb-4 ml-2">
              {label}
            </Text>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.value);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      'flex-row items-center justify-between p-4 rounded-xl mb-2 border',
                      isSelected ? 'border-primary bg-primary/10' : 'border-transparent'
                    )}
                    style={{ backgroundColor: isSelected ? undefined : colors.surface }}
                  >
                    <Text
                      className={clsx(
                        'text-base font-medium',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </Pressable>
                );
              }}
            />
            <SafeAreaView />
          </View>
        </View>
      </Modal>
    </View>
  );
}
