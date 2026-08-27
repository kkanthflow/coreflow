import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirmation Required',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-white">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDestructive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20'
            }`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Please confirm to proceed</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed mb-6 bg-[#181824] p-4 rounded-2xl border border-white/5">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-lg transition-all ${
              isDestructive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                : 'bg-[#FF6B4A] hover:bg-[#FF8866] text-white shadow-[#FF6B4A]/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
