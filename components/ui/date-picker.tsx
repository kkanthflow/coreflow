import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  label?: string;
  placeholder?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  placeholder = 'Select a date',
}: DatePickerProps) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'calendar' | 'year'>('calendar');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const initialDate = value || today;
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  // Build calendar grid for current month/year view
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const grid: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    // Pad remaining cells to fill complete 6-row grid for consistency
    while (grid.length % 7 !== 0) grid.push(null);

    return grid;
  }, [viewMonth, viewYear]);

  // Year range for year picker: 5 years back, 15 years forward
  const yearRange = useMemo(() => {
    const base = today.getFullYear();
    const years: number[] = [];
    for (let y = base - 5; y <= base + 15; y++) {
      years.push(y);
    }
    return years;
  }, [today]);

  const isDateDisabled = useCallback(
    (day: number) => {
      const date = new Date(viewYear, viewMonth, day);
      date.setHours(0, 0, 0, 0);
      if (minDate) {
        const min = new Date(minDate);
        min.setHours(0, 0, 0, 0);
        if (date < min) return true;
      }
      if (maxDate) {
        const max = new Date(maxDate);
        max.setHours(0, 0, 0, 0);
        if (date > max) return true;
      }
      return false;
    },
    [viewMonth, viewYear, minDate, maxDate]
  );

  const isDateSelected = useCallback(
    (day: number) => {
      return (
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === viewMonth &&
        selectedDate.getFullYear() === viewYear
      );
    },
    [selectedDate, viewMonth, viewYear]
  );

  const isDateToday = useCallback(
    (day: number) => {
      return (
        today.getDate() === day &&
        today.getMonth() === viewMonth &&
        today.getFullYear() === viewYear
      );
    },
    [today, viewMonth, viewYear]
  );

  const handleDayPress = (day: number) => {
    if (isDateDisabled(day)) return;
    const date = new Date(viewYear, viewMonth, day);
    setSelectedDate(date);
  };

  const handleConfirm = () => {
    onChange?.(selectedDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    // Reset view to selected date's month/year
    setViewMonth(selectedDate.getMonth());
    setViewYear(selectedDate.getFullYear());
    setIsOpen(false);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const formatDisplay = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const weeks = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);

  return (
    <>
      <Pressable
        onPress={() => {
          // Sync view to current selected date when opening
          setViewMonth(selectedDate.getMonth());
          setViewYear(selectedDate.getFullYear());
          setView('calendar');
          setIsOpen(true);
        }}
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.triggerText, { color: value ? colors.foreground : colors.muted }]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancel}
      >
        <Pressable
          style={styles.overlay}
          onPress={handleCancel}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modal, { backgroundColor: colors.surface, shadowColor: colors.foreground }]}
          >
            {/* Month/Year Header */}
            <View style={styles.header}>
              {view === 'calendar' && (
                <Pressable onPress={goPrevMonth} style={styles.navBtn} hitSlop={12}>
                  <Ionicons name="chevron-back" size={20} color={colors.foreground} />
                </Pressable>
              )}
              <Pressable
                onPress={() => setView(view === 'year' ? 'calendar' : 'year')}
                style={styles.monthYearBtn}
              >
                <Text style={[styles.monthYear, { color: colors.foreground }]}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <Ionicons
                  name={view === 'year' ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.primary}
                  style={{ marginLeft: 4 }}
                />
              </Pressable>
              {view === 'calendar' && (
                <Pressable onPress={goNextMonth} style={styles.navBtn} hitSlop={12}>
                  <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
                </Pressable>
              )}
            </View>

            {/* Year Picker View */}
            {view === 'year' ? (
              <ScrollView
                style={{ maxHeight: 240 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.yearGrid}>
                  {yearRange.map((yr) => {
                    const isSelected = yr === viewYear;
                    return (
                      <Pressable
                        key={yr}
                        onPress={() => {
                          setViewYear(yr);
                          setView('calendar');
                        }}
                        style={[
                          styles.yearItem,
                          {
                            backgroundColor: isSelected ? colors.primary : 'transparent',
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.yearText,
                            { color: isSelected ? '#fff' : colors.foreground },
                          ]}
                        >
                          {yr}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <>
                {/* Day Headers */}
                <View style={styles.dayHeaders}>
                  {DAYS.map((d) => (
                    <View key={d} style={styles.dayHeaderCell}>
                      <Text style={[styles.dayHeaderText, { color: colors.muted }]}>{d}</Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.grid}>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={styles.week}>
                      {week.map((day, di) => {
                        if (day === null) {
                          return <View key={di} style={styles.dayCell} />;
                        }
                        const selected = isDateSelected(day);
                        const isToday = isDateToday(day);
                        const disabled = isDateDisabled(day);
                        return (
                          <Pressable
                            key={di}
                            onPress={() => handleDayPress(day)}
                            disabled={disabled}
                            style={styles.dayCell}
                          >
                            <View
                              style={[
                                styles.dayInner,
                                selected && { backgroundColor: colors.primary },
                                isToday && !selected && {
                                  borderWidth: 1.5,
                                  borderColor: colors.primary,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.dayText,
                                  selected
                                    ? { color: '#fff', fontWeight: '700' }
                                    : isToday
                                    ? { color: colors.primary, fontWeight: '700' }
                                    : disabled
                                    ? { color: colors.muted, opacity: 0.35 }
                                    : { color: colors.foreground },
                                ]}
                              >
                                {day}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>

                {/* Selected date preview */}
                <Text style={[styles.preview, { color: colors.muted }]}>
                  Selected: {formatDisplay(selectedDate)}
                </Text>
              </>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                onPress={handleCancel}
                style={[styles.actionBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Confirm</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '700',
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  grid: {
    marginBottom: 12,
  },
  week: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayInner: {
    width: '90%',
    aspectRatio: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  preview: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Year picker
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 4,
    paddingBottom: 12,
  },
  yearItem: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
