import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalToastHandler: ToastContextValue | null = null;

export const toast = {
  success: (message: string, title?: string) => globalToastHandler?.success(message, title),
  error: (message: string, title?: string) => globalToastHandler?.error(message, title),
  info: (message: string, title?: string) => globalToastHandler?.info(message, title),
  warning: (message: string, title?: string) => globalToastHandler?.warning(message, title),
  show: (t: Omit<ToastItem, 'id'>) => globalToastHandler?.showToast(t),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toastData: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    const newToast: ToastItem = { ...toastData, id };
    
    setToasts((prev) => [...prev, newToast]);

    const duration = toastData.duration ?? 4000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const success = useCallback((message: string, title = 'Success') => {
    showToast({ type: 'success', title, message });
  }, [showToast]);

  const error = useCallback((message: string, title = 'Error') => {
    showToast({ type: 'error', title, message });
  }, [showToast]);

  const info = useCallback((message: string, title = 'Information') => {
    showToast({ type: 'info', title, message });
  }, [showToast]);

  const warning = useCallback((message: string, title = 'Warning') => {
    showToast({ type: 'warning', title, message });
  }, [showToast]);

  const contextValue = { showToast, success, error, info, warning };
  globalToastHandler = contextValue;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-lg p-3.5 shadow-2xl border backdrop-blur-xl transition-all animate-in slide-in-from-bottom-2 duration-200 flex items-start gap-3 ${
                isSuccess
                  ? 'bg-[#0A0D0B]/95 border-emerald-500/30 text-emerald-100'
                  : isError
                  ? 'bg-[#0D0808]/95 border-red-500/30 text-red-100'
                  : isWarning
                  ? 'bg-[#0D0B08]/95 border-amber-500/30 text-amber-100'
                  : 'bg-card-bg/95 border-divider text-zinc-100'
              }`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 size={16} className="text-emerald-400" />}
                {isError && <AlertCircle size={16} className="text-red-400" />}
                {isWarning && <AlertCircle size={16} className="text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info size={16} className="text-blue-400" />}
              </div>

              {/* Message Content */}
              <div className="min-w-0 flex-1">
                {t.title && (
                  <h4 className="text-xs font-semibold font-mono tracking-wide text-main mb-0.5">
                    {t.title}
                  </h4>
                )}
                <p className="text-xs text-muted leading-relaxed break-words">{t.message}</p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 text-muted hover:text-main rounded transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
