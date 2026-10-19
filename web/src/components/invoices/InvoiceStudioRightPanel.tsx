import {
  Palette,
  Type,
  SunMoon,
  Sliders,
  Check,
  X,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Layers,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import type { CanvasElement, StudioDesignProperties } from '../../types/invoiceStudio';
import { ACCENT_PALETTES } from './templateGalleryData';

interface InvoiceStudioRightPanelProps {
  properties: StudioDesignProperties;
  onUpdateProperties: (partial: Partial<StudioDesignProperties>) => void;
  selectedElement: CanvasElement | null;
  onUpdateSelectedElement: (updates: Partial<CanvasElement>) => void;
  onDuplicateSelectedElement: () => void;
  onDeleteSelectedElement: () => void;
  onReorderElementLayer: (direction: 'up' | 'down' | 'front' | 'back') => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export function InvoiceStudioRightPanel({
  properties,
  onUpdateProperties,
  selectedElement,
  onUpdateSelectedElement,
  onDuplicateSelectedElement,
  onDeleteSelectedElement,
  onReorderElementLayer,
  isOpen = true,
  onToggleOpen,
}: InvoiceStudioRightPanelProps) {
  return (
    <aside
      className={`w-72 lg:w-80 flex flex-col border-l border-zinc-800 bg-[#0E0F15] text-[#F5F5F5] h-full shrink-0 select-none transition-all duration-200 ${
        isOpen ? 'block' : 'hidden'
      }`}
    >
      {/* Panel Header */}
      <div className="h-12 border-b border-zinc-800 px-4 flex items-center justify-between bg-[#0A0B10]">
        <div className="flex items-center gap-2">
          <Sliders size={14} className="text-[#FF6B4A]" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F5F5F5]">
            {selectedElement ? 'Element Inspector' : 'Canvas Properties'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-[#A1A1AA]">
            {selectedElement ? selectedElement.type : 'A4 Stage'}
          </span>
          {onToggleOpen && (
            <button
              type="button"
              onClick={onToggleOpen}
              className="p-1 rounded hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors"
              title="Close Panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Properties Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs text-[#F5F5F5]">
        {/* ═══════════════════════════════════════════════════════ */}
        {/* CASE A: AN ELEMENT IS SELECTED                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        {selectedElement ? (
          <div className="space-y-5">
            {/* Element Quick Actions: Lock, Duplicate, Delete */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-[#12131A]">
              <span className="font-mono text-[11px] font-bold text-[#F5F5F5] truncate max-w-[120px]">
                {selectedElement.name}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSelectedElement({ isLocked: !selectedElement.isLocked })
                  }
                  className={`p-1.5 rounded transition-colors ${
                    selectedElement.isLocked
                      ? 'bg-[#FF6B4A] text-white'
                      : 'hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]'
                  }`}
                  title={selectedElement.isLocked ? 'Unlock Element' : 'Lock Element Position'}
                >
                  {selectedElement.isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>

                <button
                  type="button"
                  onClick={onDuplicateSelectedElement}
                  className="p-1.5 rounded hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors"
                  title="Duplicate Element (Ctrl+D)"
                >
                  <Copy size={13} />
                </button>

                <button
                  type="button"
                  onClick={onDeleteSelectedElement}
                  disabled={selectedElement.isLocked}
                  className="p-1.5 rounded hover:bg-zinc-800 text-[#A1A1AA] hover:text-red-400 disabled:opacity-30 transition-colors"
                  title="Delete Element (Delete)"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Geometry Inputs (X, Y, W, H, Rotation) */}
            <section className="space-y-2">
              <span className="font-mono font-bold uppercase text-[10px] text-[#A1A1AA] block">
                Transform Coordinates
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#12131A] border border-zinc-800 rounded p-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[#A1A1AA]">X</span>
                  <input
                    type="number"
                    disabled={selectedElement.isLocked}
                    value={selectedElement.x}
                    onChange={(e) =>
                      onUpdateSelectedElement({ x: parseInt(e.target.value) || 0 })
                    }
                    className="w-16 bg-transparent text-right text-[#F5F5F5] focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="bg-[#12131A] border border-zinc-800 rounded p-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[#A1A1AA]">Y</span>
                  <input
                    type="number"
                    disabled={selectedElement.isLocked}
                    value={selectedElement.y}
                    onChange={(e) =>
                      onUpdateSelectedElement({ y: parseInt(e.target.value) || 0 })
                    }
                    className="w-16 bg-transparent text-right text-[#F5F5F5] focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="bg-[#12131A] border border-zinc-800 rounded p-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[#A1A1AA]">W</span>
                  <input
                    type="number"
                    min="20"
                    disabled={selectedElement.isLocked}
                    value={selectedElement.width}
                    onChange={(e) =>
                      onUpdateSelectedElement({ width: parseInt(e.target.value) || 20 })
                    }
                    className="w-16 bg-transparent text-right text-[#F5F5F5] focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="bg-[#12131A] border border-zinc-800 rounded p-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[#A1A1AA]">H</span>
                  <input
                    type="number"
                    min="10"
                    disabled={selectedElement.isLocked}
                    value={selectedElement.height}
                    onChange={(e) =>
                      onUpdateSelectedElement({ height: parseInt(e.target.value) || 10 })
                    }
                    className="w-16 bg-transparent text-right text-[#F5F5F5] focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Rotation & Opacity */}
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div className="bg-[#12131A] border border-zinc-800 rounded p-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[#A1A1AA]">Rot°</span>
                  <input
                    type="number"
                    disabled={selectedElement.isLocked}
                    value={selectedElement.rotation}
                    onChange={(e) =>
                      onUpdateSelectedElement({ rotation: parseInt(e.target.value) || 0 })
                    }
                    className="w-16 bg-transparent text-right text-[#F5F5F5] focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="bg-[#12131A] border border-zinc-800 rounded p-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[#A1A1AA]">Opacity</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    disabled={selectedElement.isLocked}
                    value={selectedElement.opacity}
                    onChange={(e) =>
                      onUpdateSelectedElement({
                        opacity: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-16 bg-transparent text-right text-[#F5F5F5] focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            </section>

            {/* Layer Ordering Controls */}
            <section className="space-y-2 pt-3 border-t border-zinc-800">
              <span className="font-mono font-bold uppercase text-[10px] text-[#A1A1AA] flex items-center gap-1.5">
                <Layers size={12} className="text-[#FF6B4A]" />
                <span>Layer Stacking</span>
              </span>
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => onReorderElementLayer('front')}
                  className="p-1.5 rounded border border-zinc-800 bg-[#12131A] hover:bg-zinc-800 text-[#F5F5F5] text-center transition-colors"
                  title="Bring to Front"
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => onReorderElementLayer('up')}
                  className="p-1.5 rounded border border-zinc-800 bg-[#12131A] hover:bg-zinc-800 text-[#F5F5F5] flex items-center justify-center transition-colors"
                  title="Forward"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onReorderElementLayer('down')}
                  className="p-1.5 rounded border border-zinc-800 bg-[#12131A] hover:bg-zinc-800 text-[#F5F5F5] flex items-center justify-center transition-colors"
                  title="Backward"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onReorderElementLayer('back')}
                  className="p-1.5 rounded border border-zinc-800 bg-[#12131A] hover:bg-zinc-800 text-[#F5F5F5] text-center transition-colors"
                  title="Send to Back"
                >
                  Back
                </button>
              </div>
            </section>

            {/* SPECIFIC: TEXT ELEMENT STYLING */}
            {selectedElement.type === 'text' && (
              <section className="space-y-3 pt-3 border-t border-zinc-800">
                <span className="font-mono font-bold uppercase text-[10px] text-[#A1A1AA] block">
                  Text Content & Style
                </span>
                <textarea
                  rows={2}
                  value={selectedElement.content}
                  onChange={(e) => onUpdateSelectedElement({ content: e.target.value })}
                  className="w-full bg-[#0A0B10] border border-zinc-800 rounded p-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#FF6B4A] resize-none"
                  placeholder="Text contents..."
                />

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className="text-[10px] text-[#A1A1AA] block mb-1">Font Size</span>
                    <input
                      type="number"
                      min="8"
                      max="72"
                      value={selectedElement.fontSize}
                      onChange={(e) =>
                        onUpdateSelectedElement({
                          fontSize: parseInt(e.target.value) || 12,
                        })
                      }
                      className="w-full bg-[#0A0B10] border border-zinc-800 rounded px-2 py-1 text-xs text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#A1A1AA] block mb-1">Font Style</span>
                    <select
                      value={selectedElement.fontFamily}
                      onChange={(e) =>
                        onUpdateSelectedElement({
                          fontFamily: e.target.value as any,
                        })
                      }
                      className="w-full bg-[#0A0B10] border border-zinc-800 rounded px-1.5 py-1 text-xs text-[#F5F5F5]"
                    >
                      <option value="sans">Inter (Sans)</option>
                      <option value="serif">Playfair (Serif)</option>
                      <option value="mono">JetBrains (Mono)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-[#A1A1AA] font-mono">Color:</span>
                  <input
                    type="color"
                    value={selectedElement.color}
                    onChange={(e) => onUpdateSelectedElement({ color: e.target.value })}
                    className="w-7 h-7 rounded border border-zinc-800 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selectedElement.color}
                    onChange={(e) => onUpdateSelectedElement({ color: e.target.value })}
                    className="flex-1 bg-[#0A0B10] border border-zinc-800 rounded px-2 py-1 text-xs font-mono uppercase text-[#F5F5F5]"
                  />
                </div>
              </section>
            )}

            {/* SPECIFIC: SHAPE ELEMENT STYLING */}
            {selectedElement.type === 'shape' && (
              <section className="space-y-3 pt-3 border-t border-zinc-800">
                <span className="font-mono font-bold uppercase text-[10px] text-[#A1A1AA] block">
                  Shape Styling
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#A1A1AA] font-mono">Fill:</span>
                  <input
                    type="color"
                    value={selectedElement.fillColor}
                    onChange={(e) =>
                      onUpdateSelectedElement({ fillColor: e.target.value })
                    }
                    className="w-7 h-7 rounded border border-zinc-800 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selectedElement.fillColor}
                    onChange={(e) =>
                      onUpdateSelectedElement({ fillColor: e.target.value })
                    }
                    className="flex-1 bg-[#0A0B10] border border-zinc-800 rounded px-2 py-1 text-xs font-mono uppercase text-[#F5F5F5]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className="text-[10px] text-[#A1A1AA] block mb-1">Border W</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={selectedElement.borderWidth}
                      onChange={(e) =>
                        onUpdateSelectedElement({
                          borderWidth: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#0A0B10] border border-zinc-800 rounded px-2 py-1 text-xs text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#A1A1AA] block mb-1">Radius</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selectedElement.borderRadius}
                      onChange={(e) =>
                        onUpdateSelectedElement({
                          borderRadius: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#0A0B10] border border-zinc-800 rounded px-2 py-1 text-xs text-[#F5F5F5]"
                    />
                  </div>
                </div>
              </section>
            )}
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════ */
          /* CASE B: NO ELEMENT SELECTED (GLOBAL CANVAS PROPERTIES)  */
          /* ═══════════════════════════════════════════════════════ */
          <>
            {/* 1. COLOR & PALETTE SECTION */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold uppercase text-[11px] text-[#A1A1AA] flex items-center gap-1.5">
                  <Palette size={13} className="text-[#FF6B4A]" />
                  <span>ACCENT COLOR</span>
                </span>
                <span className="text-[10px] font-mono text-[#F5F5F5] bg-zinc-800/80 px-1.5 py-0.5 rounded">{properties.accentColor}</span>
              </div>

              {/* Color Swatches Grid */}
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_PALETTES.map((p) => {
                  const isSelected = properties.accentColor.toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => onUpdateProperties({ accentColor: p.color })}
                      className={`group relative h-9 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-offset-[#090A0F] ring-white scale-105 shadow-md'
                          : 'hover:scale-102 border border-white/10'
                      }`}
                      style={{ backgroundColor: p.color }}
                      title={p.name}
                    >
                      {isSelected && <Check size={14} className="text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Color Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={properties.accentColor}
                  onChange={(e) => onUpdateProperties({ accentColor: e.target.value })}
                  className="w-7 h-7 rounded border border-zinc-800 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={properties.accentColor}
                  onChange={(e) => onUpdateProperties({ accentColor: e.target.value })}
                  placeholder="#FF6B4A"
                  className="flex-1 bg-[#0A0B10] border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-[#F5F5F5] uppercase focus:outline-none focus:border-[#FF6B4A]"
                />
              </div>
            </section>

            {/* 2. TYPOGRAPHY SECTION */}
            <section className="space-y-3 pt-4 border-t border-zinc-800">
              <span className="font-mono font-bold uppercase text-[11px] text-[#A1A1AA] flex items-center gap-1.5">
                <Type size={13} className="text-[#FF6B4A]" />
                <span>TYPOGRAPHY</span>
              </span>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'sans', label: 'Inter', desc: 'Sans-serif', fontClass: 'font-sans' },
                  { id: 'serif', label: 'Playfair', desc: 'Serif', fontClass: 'font-serif' },
                  { id: 'mono', label: 'JetBrains', desc: 'Monospace', fontClass: 'font-mono' },
                ].map((f) => {
                  const isSelected = properties.fontFamily === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onUpdateProperties({ fontFamily: f.id as any })}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        isSelected
                          ? 'border-[#FF6B4A] bg-[#FF6B4A]/15 ring-1 ring-[#FF6B4A]/40'
                          : 'border-zinc-800 bg-[#12131A] hover:border-zinc-700'
                      }`}
                    >
                      <span className={`text-base font-bold block ${f.fontClass} ${isSelected ? 'text-[#F5F5F5]' : 'text-[#D4D4D8]'}`}>Aa</span>
                      <span className={`text-[10px] font-mono block mt-0.5 ${isSelected ? 'text-[#F5F5F5]' : 'text-[#A1A1AA]'}`}>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. PRINT & CANVAS THEME */}
            <section className="space-y-3 pt-4 border-t border-zinc-800">
              <span className="font-mono font-bold uppercase text-[11px] text-[#A1A1AA] flex items-center gap-1.5">
                <SunMoon size={13} className="text-[#FF6B4A]" />
                <span>PRINT & EXPORT THEME</span>
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateProperties({ printTheme: 'light' })}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    properties.printTheme === 'light'
                      ? 'border-[#FF6B4A] bg-[#FF6B4A]/15 ring-1 ring-[#FF6B4A]/40'
                      : 'border-zinc-800 bg-[#12131A] hover:border-zinc-700'
                  }`}
                >
                  <span className="font-bold text-xs block text-[#F5F5F5]">Classic Paper</span>
                  <span className="text-[10px] text-[#B4B4BB] block mt-0.5">High-contrast white</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateProperties({ printTheme: 'dark' })}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    properties.printTheme === 'dark'
                      ? 'border-[#FF6B4A] bg-[#FF6B4A]/15 ring-1 ring-[#FF6B4A]/40'
                      : 'border-zinc-800 bg-[#12131A] hover:border-zinc-700'
                  }`}
                >
                  <span className="font-bold text-xs block text-[#F5F5F5]">Obsidian Dark</span>
                  <span className="text-[10px] text-[#B4B4BB] block mt-0.5">Sleek dark canvas</span>
                </button>
              </div>
            </section>

            {/* 4. LAYOUT DENSITY */}
            <section className="space-y-3 pt-4 border-t border-zinc-800">
              <span className="font-mono font-bold uppercase text-[11px] text-[#A1A1AA] flex items-center gap-1.5">
                <Sliders size={13} className="text-[#FF6B4A]" />
                <span>LAYOUT SPACING</span>
              </span>

              <div className="grid grid-cols-3 gap-1.5">
                {(['compact', 'comfortable', 'spacious'] as const).map((density) => {
                  const isSelected = properties.density === density;
                  return (
                    <button
                      key={density}
                      type="button"
                      onClick={() => onUpdateProperties({ density })}
                      className={`py-1.5 px-2 rounded-lg border text-center font-mono capitalize transition-all ${
                        isSelected
                          ? 'border-[#FF6B4A] bg-[#FF6B4A]/15 text-[#FF6B4A] font-bold ring-1 ring-[#FF6B4A]/40'
                          : 'border-zinc-800 bg-[#12131A] text-[#A1A1AA] hover:text-[#F5F5F5]'
                      }`}
                    >
                      {density}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
