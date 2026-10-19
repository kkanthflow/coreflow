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
  Maximize2,
  Sun,
  Moon
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
  isDark?: boolean;
  onToggleTheme?: () => void;
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
  isDark = true,
  onToggleTheme,
}: InvoiceStudioToolbarProps) {
  return (
    <header className={`h-14 border-b px-4 flex items-center justify-between gap-3 select-none z-20 transition-colors ${
      isDark
        ? 'border-zinc-800 bg-[#0E0F15] text-[#F5F5F5]'
        : 'border-zinc-200 bg-white text-zinc-900 shadow-xs'
    }`}>
      {/* Left: Back & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark
              ? 'hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
          }`}
          title="Return to Invoices List"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => onInvoiceNumberChange(e.target.value)}
            className={`border rounded px-2 py-0.5 text-xs font-mono font-bold focus:outline-none transition-all w-36 sm:w-44 ${
              isDark
                ? 'bg-[#12131A] border-zinc-800 text-[#F5F5F5] focus:border-[#FF6B4A]'
                : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-[#FF6B4A]'
            }`}
            title="Click to customize invoice number"
          />
          <div className={`hidden sm:flex items-center gap-1.5 text-[11px] font-mono pl-2 border-l ${
            isDark ? 'border-zinc-800 text-[#A1A1AA]' : 'border-zinc-200 text-zinc-500'
          }`}>
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle2 size={12} /> Synced
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="text-amber-500 animate-pulse font-medium">Saving...</span>
            ) : saveStatus === 'conflict' ? (
              <span className="text-red-500 font-bold">Conflict</span>
            ) : (
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Unsaved edits</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Undo, Redo, Zoom, Preview & Theme Toggle */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-xs ${
          isDark ? 'bg-[#12131A] border-zinc-800 text-[#A1A1AA]' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
        }`}>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1 disabled:opacity-25 transition-colors ${
              isDark ? 'hover:text-[#F5F5F5]' : 'hover:text-zinc-900'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1 disabled:opacity-25 transition-colors ${
              isDark ? 'hover:text-[#F5F5F5]' : 'hover:text-zinc-900'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Zoom Controls + Fit to Page */}
        <div className={`flex items-center gap-1 border rounded-lg px-2 py-1 text-xs font-mono ${
          isDark ? 'bg-[#12131A] border-zinc-800' : 'bg-zinc-100 border-zinc-200'
        }`}>
          <button
            onClick={() => onZoomChange(Math.max(40, zoom - 15))}
            className={`p-0.5 ${isDark ? 'text-[#A1A1AA] hover:text-[#F5F5F5]' : 'text-zinc-500 hover:text-zinc-900'}`}
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className={`text-[11px] w-9 text-center font-semibold ${
            isDark ? 'text-[#F5F5F5]' : 'text-zinc-800'
          }`}>{zoom}%</span>
          <button
            onClick={() => onZoomChange(Math.min(160, zoom + 15))}
            className={`p-0.5 ${isDark ? 'text-[#A1A1AA] hover:text-[#F5F5F5]' : 'text-zinc-500 hover:text-zinc-900'}`}
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={onFitToPage}
            className={`p-0.5 border-l pl-1.5 ml-0.5 hover:text-[#FF6B4A] ${
              isDark ? 'text-[#A1A1AA] border-zinc-800' : 'text-zinc-500 border-zinc-200'
            }`}
            title="Fit to Page Width"
          >
            <Maximize2 size={12} />
          </button>
        </div>

        {/* Dynamic Light/Dark Theme Switcher */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
              isDark
                ? 'bg-[#12131A] border-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900'
            }`}
            title={isDark ? 'Switch to Dynamic Light Workspace' : 'Switch to Dynamic Dark Workspace'}
          >
            {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-zinc-700" />}
          </button>
        )}

        {/* Preview Mode Switcher */}
        <button
          onClick={onTogglePreviewMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            previewMode
              ? 'bg-[#FF6B4A]/15 border-[#FF6B4A]/50 text-[#FF6B4A]'
              : isDark
              ? 'bg-[#12131A] border-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]'
              : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900'
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
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            isDark
              ? 'bg-[#12131A] hover:bg-zinc-800 border-zinc-800 text-[#F5F5F5]'
              : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-800'
          }`}
          title="Download PNG Snapshot"
        >
          <ImageIcon size={13} />
          <span>PNG</span>
        </button>

        <button
          onClick={onDownloadPDF}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            isDark
              ? 'bg-[#12131A] hover:bg-zinc-800 border-zinc-800 text-[#F5F5F5]'
              : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-800'
          }`}
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
