import React from 'react';
import { Sun, Moon, Laptop, Palette, Sliders, PlayCircle, Smartphone, Check } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import type { ThemeMode, DensityMode } from '../../contexts/SettingsContext';
import {
  SettingsSection,
  SettingsRow,
  Toggle,
  SegmentedControl,
} from '../../components/settings';
import type { SegmentedOption } from '../../components/settings';

const THEME_OPTIONS: SegmentedOption<ThemeMode>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
];

const DENSITY_OPTIONS: SegmentedOption<DensityMode>[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

const ACCENT_PRESETS = [
  { name: 'Auvryn Coral', hex: '#FF5A36' },
  { name: 'Indigo Aura', hex: '#6366F1' },
  { name: 'Emerald Flux', hex: '#10B981' },
  { name: 'Solar Amber', hex: '#F59E0B' },
  { name: 'Cyber Sky', hex: '#0EA5E9' },
];

export default function AppearanceSettings() {
  const {
    theme,
    resolvedTheme,
    setTheme,
    userSettings,
    updateUserSetting,
  } = useSettings();

  const handleAccentChange = (hex: string) => {
    updateUserSetting('accent', hex, true);
    document.documentElement.style.setProperty('--accent', hex);
    // Soft tint calculation
    document.documentElement.style.setProperty('--accent-soft', `${hex}1a`);
  };

  const handleDensityChange = (density: DensityMode) => {
    updateUserSetting('density', density, true);
    if (density === 'compact') {
      document.documentElement.setAttribute('data-density', 'compact');
    } else {
      document.documentElement.removeAttribute('data-density');
    }
  };

  const handleReduceMotionChange = (reduce: boolean) => {
    updateUserSetting('reduceMotion', reduce, true);
    if (reduce) {
      document.documentElement.setAttribute('data-reduce-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduce-motion');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Theme & Mode ── */}
      <SettingsSection
        label="Theme & Display Mode"
        description="Configure display contrast, light/dark themes, and workspace ambiance."
      >
        <SettingsRow
          icon={Palette}
          title="Color Theme"
          description={`Select explicit mode or adapt to operating system. Active: ${resolvedTheme === 'dark' ? 'Dark' : 'Light'}.`}
        >
          <SegmentedControl<ThemeMode>
            name="theme-control"
            options={THEME_OPTIONS}
            value={theme}
            onChange={(nextTheme) => setTheme(nextTheme)}
          />
        </SettingsRow>

        <SettingsRow
          icon={Sliders}
          title="Display Density"
          description="Adjust data rows, list spacing, and card padding for your display."
        >
          <SegmentedControl<DensityMode>
            name="density-control"
            options={DENSITY_OPTIONS}
            value={userSettings.density || 'comfortable'}
            onChange={handleDensityChange}
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Brand Accent Preset ── */}
      <SettingsSection
        label="Accent Color Palette"
        description="Personalized primary accent tone for active indicators, focus highlights, and badges."
      >
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {ACCENT_PRESETS.map((preset) => {
              const activeAccent = (userSettings.accent || '#FF5A36').toLowerCase();
              const isSelected = activeAccent === preset.hex.toLowerCase();

              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => handleAccentChange(preset.hex)}
                  className={`
                    flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none
                    ${
                      isSelected
                        ? 'border-accent bg-accent-soft shadow-2xs font-semibold'
                        : 'border-line bg-surface-2/60 hover:bg-surface-2 text-muted hover:text-text'
                    }
                  `}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-2xs text-white"
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="text-xs truncate">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* ── Accessibility & Interaction ── */}
      <SettingsSection
        label="Accessibility & Feedback"
        description="Motion smoothness and interactive sensory feedback preferences."
      >
        <SettingsRow
          icon={PlayCircle}
          title="Reduce Motion"
          description="Minimize spring layout transitions, cursor glow pulses, and carousel animations."
        >
          <Toggle
            checked={!!userSettings.reduceMotion}
            onChange={handleReduceMotionChange}
            ariaLabel="Toggle reduce motion"
          />
        </SettingsRow>

        <SettingsRow
          icon={Smartphone}
          title="Haptic & Audio Feedback"
          description="Subtle clicks and soft notifications on toggle interactions and room state shifts."
        >
          <Toggle
            checked={userSettings.hapticAudioFeedback ?? true}
            onChange={(checked) => updateUserSetting('hapticAudioFeedback', checked, true)}
            ariaLabel="Toggle haptic and audio feedback"
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
