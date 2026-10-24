import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface SaveBarProps {
  isDirty?: boolean;
  onSave?: () => Promise<boolean | void> | boolean | void;
  onDiscard?: () => void;
  isSaving?: boolean;
  message?: string;
  className?: string;
}

export default function SaveBar({
  isDirty: propIsDirty,
  onSave: propOnSave,
  onDiscard: propOnDiscard,
  isSaving: propIsSaving,
  message,
  className = '',
}: SaveBarProps) {
  const settings = useSettings();

  // Use props if provided, otherwise fallback to SettingsContext
  const isDirty = propIsDirty !== undefined ? propIsDirty : settings.isDirty;
  const isSaving = propIsSaving !== undefined ? propIsSaving : settings.saving;
  const onSave = propOnSave || settings.saveDirtyChanges;
  const onDiscard = propOnDiscard || settings.discardDirtyChanges;

  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className={`
            fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50
            w-[calc(100%-2rem)] max-w-lg mx-auto
            bg-surface/95 backdrop-blur-md border border-line/90
            rounded-2xl p-3 sm:p-3.5 shadow-xl shadow-black/15
            flex items-center justify-between gap-3 font-sans select-none
            ${className}
          `}
          role="region"
          aria-label="Unsaved changes bar"
        >
          {/* Status Message */}
          <div className="flex items-center gap-2.5 min-w-0 pl-1">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>

            <div className="min-w-0">
              <span className="text-xs font-semibold text-text truncate block">
                {message || 'You have unsaved changes'}
              </span>
              <span className="text-[10px] text-muted hidden sm:block">
                Careful — changes won't persist until saved
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onDiscard}
              className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-muted hover:text-text border border-line text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Discard
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                await onSave();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={13} strokeWidth={2.5} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
