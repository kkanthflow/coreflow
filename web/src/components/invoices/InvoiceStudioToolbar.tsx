import {
  Download,
  Image as ImageIcon,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Eye,
  Edit3,
  Save,
  ArrowLeft,
  Maximize2
} from 'lucide-react';

interface InvoiceStudioToolbarProps {
  invoiceNumber: string;
  onInvoiceNumberChange: (val: string) => void;
  saveStatus: 'saved' | 'saving' | 'dirty' | 'conflict';
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onFitToPage: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  previewMode: boolean;
  onTogglePreviewMode: () => void;
  onDownloadPDF: () => void;
  onDownloadPNG: () => void;
  onSaveInvoice: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isExistingInvoice?: boolean;
}

export function InvoiceStudioToolbar({
  invoiceNumber,
  onInvoiceNumberChange,
  saveStatus,
  zoom,
  onZoomChange,
  onFitToPage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  previewMode,
  onTogglePreviewMode,
  onDownloadPDF,
  onDownloadPNG,
  onSaveInvoice,
  onCancel,
  isSaving,
  isExistingInvoice = false,
}: InvoiceStudioToolbarProps) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-[#0E0F15] px-4 flex items-center justify-between gap-3 select-none z-20 text-[#F5F5F5]">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors"
          title="Return to Invoices List"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => onInvoiceNumberChange(e.target.value)}
            className="bg-transparent border border-transparent hover:border-zinc-700 focus:border-[#FF6B4A] rounded px-2 py-0.5 text-xs font-mono font-bold text-[#F5F5F5] focus:outline-none transition-all w-36 sm:w-44"
            title="Click to customize invoice number"
          />
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#A1A1AA] pl-2 border-l border-zinc-800">
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={12} /> Synced
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="text-amber-400 animate-pulse">Saving...</span>
            ) : saveStatus === 'conflict' ? (
              <span className="text-red-400 font-bold">Conflict</span>
            ) : (
              <span className="text-zinc-400">Unsaved edits</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Undo, Redo, Zoom & Preview Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[#12131A] border border-zinc-800 text-xs text-[#A1A1AA]">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 hover:text-[#F5F5F5] disabled:opacity-25 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 hover:text-[#F5F5F5] disabled:opacity-25 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Zoom Controls + Fit to Page */}
        <div className="flex items-center gap-1 bg-[#12131A] border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono">
          <button
            onClick={() => onZoomChange(Math.max(40, zoom - 15))}
            className="p-0.5 text-[#A1A1AA] hover:text-[#F5F5F5]"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-[11px] w-9 text-center text-[#F5F5F5] font-semibold">{zoom}%</span>
          <button
            onClick={() => onZoomChange(Math.min(160, zoom + 15))}
            className="p-0.5 text-[#A1A1AA] hover:text-[#F5F5F5]"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={onFitToPage}
            className="p-0.5 text-[#A1A1AA] hover:text-[#FF6B4A] border-l border-zinc-800/80 pl-1.5 ml-0.5"
            title="Fit to Page Width"
          >
            <Maximize2 size={12} />
          </button>
        </div>

        {/* Preview Mode Switcher */}
        <button
          onClick={onTogglePreviewMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            previewMode
              ? 'bg-[#FF6B4A]/15 border-[#FF6B4A]/50 text-[#FF6B4A]'
              : 'bg-[#12131A] border-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]'
          }`}
          title={previewMode ? 'Return to Editor Layout' : 'Inspect Canvas Full Preview'}
        >
          {previewMode ? <Edit3 size={13} /> : <Eye size={13} />}
          <span className="hidden sm:inline">{previewMode ? 'Editor View' : 'Preview'}</span>
        </button>
      </div>

      {/* Right: Export & Save Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDownloadPNG}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#12131A] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-[#F5F5F5] transition-colors"
          title="Download PNG Snapshot"
        >
          <ImageIcon size={13} />
          <span>PNG</span>
        </button>

        <button
          onClick={onDownloadPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12131A] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-[#F5F5F5] transition-colors"
          title="Export high-resolution PDF"
        >
          <Download size={13} />
          <span className="hidden sm:inline">Export PDF</span>
        </button>

        <button
          onClick={onSaveInvoice}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,107,74,0.3)]"
        >
          <Save size={13} />
          <span>
            {isSaving
              ? 'Saving...'
              : isExistingInvoice
              ? 'Save Changes'
              : 'Issue Invoice'}
          </span>
        </button>
      </div>
    </header>
  );
}
