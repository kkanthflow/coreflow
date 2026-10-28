import React, { useState, useEffect } from 'react';
import { PROFESSIONAL_JOB_TITLES, ALL_JOB_TITLES_FLAT } from '../../lib/jobTitles';

interface JobTitleSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function JobTitleSelect({
  value,
  onChange,
  placeholder = 'Select professional job title...',
  className = '',
  disabled = false,
}: JobTitleSelectProps) {
  const isPredefined = ALL_JOB_TITLES_FLAT.includes(value);
  const [isCustomMode, setIsCustomMode] = useState(!isPredefined && !!value);
  const [customValue, setCustomValue] = useState(!isPredefined ? value : '');

  useEffect(() => {
    if (!ALL_JOB_TITLES_FLAT.includes(value) && value) {
      setIsCustomMode(true);
      setCustomValue(value);
    } else if (ALL_JOB_TITLES_FLAT.includes(value)) {
      setIsCustomMode(false);
    }
  }, [value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'CUSTOM_TRIGGER') {
      setIsCustomMode(true);
      onChange(customValue || 'Specialist');
    } else {
      setIsCustomMode(false);
      onChange(val);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    onChange(val);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <select
        value={isCustomMode ? 'CUSTOM_TRIGGER' : (value || '')}
        onChange={handleSelectChange}
        disabled={disabled}
        className="w-full bg-[#121217] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {PROFESSIONAL_JOB_TITLES.map((cat) => (
          <optgroup key={cat.category} label={cat.category}>
            {cat.titles.map((title) => (
              <option
                key={title}
                value={title === 'Custom Job Title' ? 'CUSTOM_TRIGGER' : title}
              >
                {title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {isCustomMode && (
        <input
          type="text"
          value={customValue}
          onChange={handleCustomInputChange}
          placeholder="Enter custom job title..."
          disabled={disabled}
          className="w-full bg-[#181820] border border-[#FF6B4A]/50 focus:border-[#FF6B4A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
        />
      )}
    </div>
  );
}

export default JobTitleSelect;
