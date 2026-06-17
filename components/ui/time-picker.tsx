import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value?: Date;
  onChange?: (date: Date) => void;
  format?: '12h' | '24h';
}

export function TimePicker({
  value,
  onChange,
  format = '24h',
}: TimePickerProps) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState(value || new Date());
  const [selectedHour, setSelectedHour] = useState(selectedTime.getHours());
  const [selectedMinute, setSelectedMinute] = useState(selectedTime.getMinutes());
  const [period, setPeriod] = useState<'AM' | 'PM'>(selectedTime.getHours() >= 12 ? 'PM' : 'AM');

  const hours = useMemo(() => {
    if (format === '12h') {
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }
    return Array.from({ length: 24 }, (_, i) => i);
  }, [format]);

  const minutes = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => i);
  }, []);

  const handleSelectTime = () => {
    let hour = selectedHour;
    if (format === '12h') {
      hour = period === 'PM' ? (selectedHour === 12 ? 12 : selectedHour + 12) : selectedHour === 12 ? 0 : selectedHour;
    }

    const newTime = new Date(selectedTime);
    newTime.setHours(hour, selectedMinute, 0, 0);
    setSelectedTime(newTime);
    onChange?.(newTime);
    setIsOpen(false);
  };

  const formatTime = (date: Date) => {
    if (format === '12h') {
      const hour = date.getHours() % 12 || 12;
      const minute = String(date.getMinutes()).padStart(2, '0');
      const period = date.getHours() >= 12 ? 'PM' : 'AM';
      return `${hour}:${minute} ${period}`;
    }
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${hour}:${minute}`;
  };

  const displayHour = format === '12h' ? (selectedHour % 12 || 12) : selectedHour;

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View
          className="px-4 py-3 rounded-lg border border-border bg-surface"
          style={{ borderColor: colors.border }}
        >
          <Text className="text-base text-foreground font-medium">
            {formatTime(selectedTime)}
          </Text>
        </View>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View
            className="w-full max-w-sm bg-surface rounded-2xl p-6"
            style={{ backgroundColor: colors.surface }}
          >
            {/* Header */}
            <View className="mb-6">
              <Text className="text-2xl font-bold text-foreground text-center">
                Select Time
              </Text>
            </View>

            {/* Time Selector */}
            <View className="flex-row gap-4 mb-6 items-center justify-center">
              {/* Hours */}
              <View className="flex-1 items-center">
                <Text className="text-sm text-muted font-semibold mb-2">Hour</Text>
                <ScrollView
                  horizontal={false}
                  showsVerticalScrollIndicator={false}
                  className="max-h-48 border border-border rounded-lg"
                  style={{ borderColor: colors.border }}
                >
                  {hours.map((hour) => (
                    <Pressable
                      key={hour}
                      onPress={() => setSelectedHour(hour)}
                      className={cn(
                        'py-3 px-4 items-center',
                        selectedHour === hour && 'bg-primary'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-lg font-semibold',
                          selectedHour === hour ? 'text-background' : 'text-foreground'
                        )}
                      >
                        {String(hour).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Separator */}
              <Text className="text-2xl font-bold text-foreground">:</Text>

              {/* Minutes */}
              <View className="flex-1 items-center">
                <Text className="text-sm text-muted font-semibold mb-2">Minute</Text>
                <ScrollView
                  horizontal={false}
                  showsVerticalScrollIndicator={false}
                  className="max-h-48 border border-border rounded-lg"
                  style={{ borderColor: colors.border }}
                >
                  {minutes.map((minute) => (
                    <Pressable
                      key={minute}
                      onPress={() => setSelectedMinute(minute)}
                      className={cn(
                        'py-3 px-4 items-center',
                        selectedMinute === minute && 'bg-primary'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-lg font-semibold',
                          selectedMinute === minute ? 'text-background' : 'text-foreground'
                        )}
                      >
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* AM/PM for 12h format */}
              {format === '12h' && (
                <View className="flex-1 items-center">
                  <Text className="text-sm text-muted font-semibold mb-2">Period</Text>
                  <View className="gap-2">
                    {(['AM', 'PM'] as const).map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => setPeriod(p)}
                        className={cn(
                          'py-3 px-4 rounded-lg border border-border',
                          period === p && 'bg-primary border-primary'
                        )}
                        style={period === p ? { borderColor: colors.primary } : { borderColor: colors.border }}
                      >
                        <Text
                          className={cn(
                            'text-lg font-semibold text-center',
                            period === p ? 'text-background' : 'text-foreground'
                          )}
                        >
                          {p}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setIsOpen(false)}
                className="flex-1"
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="px-4 py-3 rounded-lg border border-border items-center">
                  <Text className="text-base font-semibold text-foreground">Cancel</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleSelectTime}
                className="flex-1"
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="px-4 py-3 rounded-lg bg-primary items-center">
                  <Text className="text-base font-semibold text-background">Select</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
