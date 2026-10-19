import { useState } from 'react';
import {
  LayoutTemplate,
  FileText,
  Shapes,
  Image as ImageIcon,
  Boxes,
  Plus,
  Trash2,
  Check,
  Building2,
  Heading,
  AlignLeft,
  Square,
  Circle,
  Minus,
  Edit3
} from 'lucide-react';
import { INVOICE_TEMPLATES } from './templateGalleryData';
import type {
  CanvasElement,
  InvoiceTemplateId,
  StudioDesignProperties,
  StudioLineItem,
} from '../../types/invoiceStudio';
import { generateStableId } from './studioDocumentMigration';

export type LeftPanelTab = 'templates' | 'text' | 'shapes' | 'images' | 'elements';

interface InvoiceStudioLeftPanelProps {
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;
  selectedTemplateId: InvoiceTemplateId;
  onSelectTemplate: (templateId: InvoiceTemplateId) => void;
  properties: StudioDesignProperties;
  onUpdateProperties: (partial: Partial<StudioDesignProperties>) => void;
  clients: { id: string; name: string; company_name: string; gst_number?: string }[];
  clientId: string;
  onClientChange: (clientId: string) => void;
  onOpenCreateClientModal?: () => void;
  issueDate: string;
  onIssueDateChange: (val: string) => void;
  dueDate: string;
  onDueDateChange: (val: string) => void;
  currency: string;
  onCurrencyChange: (val: string) => void;
  items: StudioLineItem[];
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: keyof StudioLineItem, val: any) => void;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  onAddCanvasElement?: (element: CanvasElement) => void;
  isDark?: boolean;
}

export function InvoiceStudioLeftPanel({
  activeTab,
  onTabChange,
  selectedTemplateId,
  onSelectTemplate,
  properties,
  onUpdateProperties,
  clients,
  clientId,
  onClientChange,
  onOpenCreateClientModal,
  issueDate,
  onIssueDateChange,
  dueDate,
  onDueDateChange,
  currency,
  onCurrencyChange,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  subtotal,
  totalTax,
  totalAmount,
  onAddCanvasElement,
  isDark = true,
}: InvoiceStudioLeftPanelProps) {
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('All');

  const filteredTemplates = INVOICE_TEMPLATES.filter(
    (t) => templateCategoryFilter === 'All' || t.category === templateCategoryFilter
  );

  // Dynamic theme tokens
  const textPrimary = isDark ? 'text-[#F5F5F5]' : 'text-zinc-900';
  const textSecondary = isDark ? 'text-[#B4B4BB]' : 'text-zinc-600';
  const textMuted = isDark ? 'text-[#A1A1AA]' : 'text-zinc-500';
  const cardBg = isDark
    ? 'border-zinc-800/80 hover:border-zinc-700 bg-[#12131A]'
    : 'border-zinc-200 hover:border-zinc-300 bg-white shadow-2xs hover:shadow-xs';
  const cardSelectedBg = isDark
    ? 'border-[#FF6B4A] bg-[#FF6B4A]/10 ring-1 ring-[#FF6B4A]/40 shadow-md'
    : 'border-[#FF6B4A] bg-[#FF6B4A]/10 ring-1 ring-[#FF6B4A]/40 shadow-xs';
  const innerCardBg = isDark
    ? 'border-zinc-800 bg-[#12131A]'
    : 'border-zinc-200 bg-zinc-50/90';
  const inputBg = isDark
    ? 'bg-[#0A0B10] border-zinc-800 text-[#F5F5F5] placeholder-zinc-500 focus:border-[#FF6B4A]'
    : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-[#FF6B4A] shadow-2xs';
  const subtleBorder = isDark ? 'border-zinc-800/80' : 'border-zinc-200';

  // Helper to add custom text to canvas
  const handleAddTextElement = (type: 'heading' | 'subheading' | 'body') => {
    if (!onAddCanvasElement) return;
    const newEl: CanvasElement = {
      id: generateStableId('text'),
      type: 'text',
      name: type === 'heading' ? 'Heading Text' : 'Body Text',
      x: 100,
      y: 200,
      width: type === 'heading' ? 320 : 260,
      height: type === 'heading' ? 44 : 32,
      rotation: 0,
      zIndex: 10,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      content:
        type === 'heading'
          ? 'Add Title Here'
          : type === 'subheading'
          ? 'Add Subtitle Description'
          : 'Custom invoice body note or terms.',
      fontFamily: properties.fontFamily,
      fontSize: type === 'heading' ? 24 : type === 'subheading' ? 16 : 12,
      fontWeight: type === 'heading' ? 'bold' : type === 'subheading' ? '600' : 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: properties.printTheme === 'dark' ? '#FFFFFF' : '#111827',
      lineHeight: 1.2,
    };
    onAddCanvasElement(newEl);
  };

  // Helper to add shape element to canvas
  const handleAddShapeElement = (shapeType: 'rectangle' | 'rounded-rect' | 'circle' | 'line' | 'pill') => {
    if (!onAddCanvasElement) return;
    const isLine = shapeType === 'line';
    const newEl: CanvasElement = {
      id: generateStableId('shape'),
      type: 'shape',
      name: `${shapeType.toUpperCase()} Shape`,
      x: 120,
      y: 240,
      width: isLine ? 300 : shapeType === 'circle' ? 80 : 200,
      height: isLine ? 4 : shapeType === 'circle' ? 80 : 60,
      rotation: 0,
      zIndex: 5,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      shapeType,
      fillColor: isLine ? properties.accentColor : `${properties.accentColor}25`,
      borderColor: properties.accentColor,
      borderWidth: isLine ? 0 : 2,
      borderRadius: shapeType === 'rounded-rect' ? 8 : shapeType === 'pill' ? 9999 : 0,
      borderStyle: 'solid',
    };
    onAddCanvasElement(newEl);
  };

  return (
    <aside className={`w-80 md:w-96 flex flex-col border-r h-full shrink-0 select-none transition-colors ${
      isDark
        ? 'border-zinc-800 bg-[#0E0F15] text-[#F5F5F5]'
        : 'border-zinc-200 bg-white text-zinc-900 shadow-xs'
    }`}>
      {/* Sidebar Icon Navigation Rail */}
      <div className={`flex items-center justify-between border-b p-1.5 text-xs font-mono overflow-x-auto scrollbar-none ${
        isDark ? 'border-zinc-800 bg-[#0A0B10]' : 'border-zinc-200 bg-zinc-50'
      }`}>
        <button
          type="button"
          onClick={() => onTabChange('templates')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
            activeTab === 'templates'
              ? 'bg-[#FF6B4A] text-white shadow-sm'
              : isDark
              ? 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
          title="Browse 8 Original Template Designs"
        >
          <LayoutTemplate size={13} />
          <span>Templates</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('text')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
            activeTab === 'text'
              ? 'bg-[#FF6B4A] text-white shadow-sm'
              : isDark
              ? 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-zinc-800/50'
              : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
          title="Edit Invoice Content & Line Items"
        >
          <Edit3 size={13} />
          <span>Edit Content</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeTab === 'text' ? 'bg-white/20 text-white' : 'bg-[#FF6B4A]/20 text-[#FF6B4A]'
          }`}>
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('shapes')}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
            activeTab === 'shapes'
              ? 'bg-[#FF6B4A] text-white shadow-sm'
              : isDark
              ? 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
          title="Shapes & Layout Accents"
        >
          <Shapes size={13} />
          <span>Shapes</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('images')}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
            activeTab === 'images'
              ? 'bg-[#FF6B4A] text-white shadow-sm'
              : isDark
              ? 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
          title="Logos, Stamps & Imagery"
        >
          <ImageIcon size={13} />
          <span>Images</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('elements')}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
            activeTab === 'elements'
              ? 'bg-[#FF6B4A] text-white shadow-sm'
              : isDark
              ? 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
          title="Functional Blocks & Layout Elements"
        >
          <Boxes size={13} />
          <span>Elements</span>
        </button>
      </div>

      {/* Tab Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── TAB 1: TEMPLATE GALLERY (8 DESIGNS) ── */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-sm font-bold ${textPrimary}`}>Template Gallery</h2>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                Choose from 8 original designs engineered for business velocity.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {['All', 'Modern', 'Corporate', 'Compliance', 'Creative', 'Tech'].map((cat) => {
                const isCatSelected = templateCategoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTemplateCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-all ${
                      isCatSelected
                        ? 'bg-[#FF6B4A] text-white shadow-xs'
                        : isDark
                        ? 'bg-[#12131A] text-[#A1A1AA] hover:text-[#F5F5F5] border border-zinc-800'
                        : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80 border border-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* 8 Template Cards Grid */}
            <div className="grid grid-cols-1 gap-3 pt-1">
              {filteredTemplates.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;

                return (
                  <div
                    key={tmpl.id}
                    onClick={() => onSelectTemplate(tmpl.id)}
                    className={`group relative rounded-xl p-3.5 border transition-all cursor-pointer ${
                      isSelected
                        ? cardSelectedBg
                        : cardBg
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: tmpl.thumbnailColor }}
                        />
                        <h3 className={`font-bold text-xs ${textPrimary}`}>{tmpl.name}</h3>
                      </div>
                      {tmpl.badge && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border ${
                          isDark
                            ? 'bg-black/40 text-[#FF6B4A] border-[#FF6B4A]/40'
                            : 'bg-[#FF6B4A]/15 text-[#FF6B4A] border-[#FF6B4A]/30'
                        }`}>
                          {tmpl.badge}
                        </span>
                      )}
                    </div>

                    <p className={`text-[11px] line-clamp-2 leading-relaxed ${textSecondary}`}>
                      {tmpl.description}
                    </p>

                    <div className={`mt-3 flex items-center justify-between text-[10px] font-mono pt-2 border-t ${
                      subtleBorder
                    } ${textMuted}`}>
                      <span>Category: {tmpl.category}</span>
                      <span className="text-[#FF6B4A] font-semibold flex items-center gap-1">
                        {isSelected ? (
                          <>
                            <Check size={12} /> Active Canvas
                          </>
                        ) : (
                          'Apply Template →'
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 2: TEXT & INVOICE CONTENT ── */}
        {activeTab === 'text' && (
          <div className="space-y-4 text-xs">
            <div>
              <h2 className={`text-sm font-bold ${textPrimary}`}>Text & Data Content</h2>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                Add custom text blocks or edit structured billing details.
              </p>
            </div>

            {/* Quick Add Text Elements to Canvas */}
            <div className={`space-y-1.5 p-3 rounded-lg border ${innerCardBg}`}>
              <span className={`text-[10px] font-mono uppercase font-bold block mb-1 ${textMuted}`}>
                Insert Text to Canvas
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddTextElement('heading')}
                  className={`p-2 rounded border hover:border-[#FF6B4A] text-center text-xs transition-colors ${
                    isDark ? 'border-zinc-800 bg-[#0A0B10]' : 'border-zinc-200 bg-white shadow-2xs'
                  }`}
                >
                  <Heading size={14} className="mx-auto mb-1 text-[#FF6B4A]" />
                  <span className={`font-bold block text-[10px] ${textPrimary}`}>Heading</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTextElement('subheading')}
                  className={`p-2 rounded border hover:border-[#FF6B4A] text-center text-xs transition-colors ${
                    isDark ? 'border-zinc-800 bg-[#0A0B10]' : 'border-zinc-200 bg-white shadow-2xs'
                  }`}
                >
                  <AlignLeft size={14} className="mx-auto mb-1 text-[#FF6B4A]" />
                  <span className={`font-semibold block text-[10px] ${textSecondary}`}>Subtitle</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTextElement('body')}
                  className={`p-2 rounded border hover:border-[#FF6B4A] text-center text-xs transition-colors ${
                    isDark ? 'border-zinc-800 bg-[#0A0B10]' : 'border-zinc-200 bg-white shadow-2xs'
                  }`}
                >
                  <FileText size={14} className="mx-auto mb-1 text-[#FF6B4A]" />
                  <span className={`block text-[10px] ${textMuted}`}>Body Text</span>
                </button>
              </div>
            </div>

            {/* Client Account Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={`text-[10px] font-mono uppercase font-bold flex items-center gap-1 ${textMuted}`}>
                  <Building2 size={12} />
                  <span>Client Account</span>
                </label>
                {onOpenCreateClientModal && (
                  <button
                    type="button"
                    onClick={onOpenCreateClientModal}
                    className="text-[10px] font-bold text-[#FF6B4A] hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={10} /> New Client
                  </button>
                )}
              </div>
              <select
                value={clientId}
                onChange={(e) => onClientChange(e.target.value)}
                className={`w-full rounded-lg px-2.5 py-2 text-xs border focus:outline-none ${inputBg}`}
              >
                {clients.length === 0 ? (
                  <option value="">Sample Client (Demo Preview)</option>
                ) : (
                  <>
                    <option value="">Select client account...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name || c.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Dates & Currency Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${textMuted}`}>
                  Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => onIssueDateChange(e.target.value)}
                  className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono border focus:outline-none ${inputBg}`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${textMuted}`}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => onDueDateChange(e.target.value)}
                  className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono border focus:outline-none ${inputBg}`}
                />
              </div>
            </div>

            <div>
              <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${textMuted}`}>
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputBg}`}
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>

            {/* Line Items List */}
            <div className={`space-y-2 pt-2 border-t ${subtleBorder}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-mono font-bold uppercase ${textPrimary}`}>
                  Line Items ({items.length})
                </span>
                <button
                  type="button"
                  onClick={onAddItem}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#FF6B4A] hover:underline"
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>

              <div className="space-y-2.5">
                {items.map((it) => (
                  <div key={it.id} className={`p-2.5 rounded-lg border space-y-2 ${innerCardBg}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Deliverable description..."
                        value={it.description}
                        onChange={(e) => onUpdateItem(it.id, 'description', e.target.value)}
                        className={`w-full bg-transparent border-0 text-xs focus:outline-none ${textPrimary} ${
                          isDark ? 'placeholder-zinc-500' : 'placeholder-zinc-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveItem(it.id)}
                        disabled={items.length <= 1}
                        className="text-zinc-400 hover:text-red-400 disabled:opacity-20 transition-colors p-1"
                        title="Delete line"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                      <div>
                        <span className={`text-[9px] block ${textMuted}`}>Qty</span>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => onUpdateItem(it.id, 'quantity', parseFloat(e.target.value) || 1)}
                          className={`w-full rounded px-1.5 py-1 text-right text-xs border focus:outline-none ${inputBg}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <span className={`text-[9px] block ${textMuted}`}>Rate</span>
                        <input
                          type="number"
                          step="0.01"
                          value={it.rate}
                          onChange={(e) => onUpdateItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                          className={`w-full rounded px-1.5 py-1 text-right text-xs border focus:outline-none ${inputBg}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[9px] block ${textMuted}`}>Tax%</span>
                        <input
                          type="number"
                          value={it.tax_rate}
                          onChange={(e) => onUpdateItem(it.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                          className={`w-full rounded px-1.5 py-1 text-right text-xs border focus:outline-none ${inputBg}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Financial Footprint */}
            <div className={`p-3 rounded-lg border font-mono text-[11px] space-y-1 ${innerCardBg}`}>
              <div className={`flex justify-between ${textSecondary}`}>
                <span>Subtotal:</span>
                <span>{currency} {subtotal.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between ${textSecondary}`}>
                <span>Tax:</span>
                <span>{currency} {totalTax.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between font-bold pt-1 border-t ${subtleBorder} ${textPrimary}`}>
                <span>Total:</span>
                <span className="text-[#FF6B4A]">{currency} {totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Custom Notes & Terms Text Fields */}
            <div className={`space-y-2 pt-2 border-t ${subtleBorder} text-xs`}>
              <label className={`text-[10px] font-mono uppercase font-bold block ${textMuted}`}>
                Invoice Notes & Instructions
              </label>
              <textarea
                rows={2}
                value={properties.customNotes}
                onChange={(e) => onUpdateProperties({ customNotes: e.target.value })}
                placeholder="Thank you for your business..."
                className={`w-full rounded-lg p-2 text-xs border focus:outline-none resize-none ${inputBg}`}
              />

              <label className={`text-[10px] font-mono uppercase font-bold block pt-1 ${textMuted}`}>
                Payment Terms Text
              </label>
              <input
                type="text"
                value={properties.paymentTerms}
                onChange={(e) => onUpdateProperties({ paymentTerms: e.target.value })}
                placeholder="Net 15 Days from date of invoice"
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputBg}`}
              />
            </div>
          </div>
        )}

        {/* ── TAB 3: SHAPES & DESIGN ACCENTS ── */}
        {activeTab === 'shapes' && (
          <div className="space-y-4 text-xs">
            <div>
              <h2 className={`text-sm font-bold ${textPrimary}`}>Insert Shapes</h2>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                Click any shape to add an editable layer directly onto the canvas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAddShapeElement('rectangle')}
                className={`p-3 rounded-lg border hover:border-[#FF6B4A] transition-all flex flex-col items-center justify-center gap-1.5 text-center ${innerCardBg}`}
              >
                <Square size={22} className="text-[#FF6B4A]" />
                <span className={`font-semibold text-xs ${textPrimary}`}>Rectangle</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddShapeElement('rounded-rect')}
                className={`p-3 rounded-lg border hover:border-[#FF6B4A] transition-all flex flex-col items-center justify-center gap-1.5 text-center ${innerCardBg}`}
              >
                <div className="w-5 h-5 rounded-md border-2 border-[#FF6B4A]" />
                <span className={`font-semibold text-xs ${textPrimary}`}>Rounded Box</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddShapeElement('circle')}
                className={`p-3 rounded-lg border hover:border-[#FF6B4A] transition-all flex flex-col items-center justify-center gap-1.5 text-center ${innerCardBg}`}
              >
                <Circle size={22} className="text-[#FF6B4A]" />
                <span className={`font-semibold text-xs ${textPrimary}`}>Circle</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddShapeElement('line')}
                className={`p-3 rounded-lg border hover:border-[#FF6B4A] transition-all flex flex-col items-center justify-center gap-1.5 text-center ${innerCardBg}`}
              >
                <Minus size={22} className="text-[#FF6B4A]" />
                <span className={`font-semibold text-xs ${textPrimary}`}>Divider Line</span>
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 4: IMAGES & BRAND LOGOS ── */}
        {activeTab === 'images' && (
          <div className="space-y-4 text-xs">
            <div>
              <h2 className={`text-sm font-bold ${textPrimary}`}>Brand Imagery & Logos</h2>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                Configure brand logo or insert freeform graphic elements.
              </p>
            </div>

            {/* Logo URL Input */}
            <div className="space-y-2">
              <label className={`text-[10px] font-mono uppercase font-bold block ${textMuted}`}>
                Company Brand Logo URL
              </label>
              <input
                type="url"
                value={properties.logoUrl || ''}
                onChange={(e) => onUpdateProperties({ logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputBg}`}
              />
            </div>

            {/* Insert Image Layer to Canvas */}
            <button
              type="button"
              onClick={() => {
                if (!onAddCanvasElement) return;
                onAddCanvasElement({
                  id: generateStableId('image'),
                  type: 'image',
                  name: 'Custom Image Layer',
                  x: 100,
                  y: 180,
                  width: 140,
                  height: 140,
                  rotation: 0,
                  zIndex: 8,
                  opacity: 1,
                  isLocked: false,
                  isVisible: true,
                  imageUrl: properties.logoUrl || '',
                  objectFit: 'contain',
                  borderRadius: 8,
                });
              }}
              className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-2 ${
                isDark ? 'bg-[#12131A] hover:bg-zinc-800 border-zinc-800 text-[#F5F5F5]' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-900'
              }`}
            >
              <ImageIcon size={14} className="text-[#FF6B4A]" />
              <span>Insert Image Layer to Canvas</span>
            </button>
          </div>
        )}

        {/* ── TAB 5: ELEMENTS & FUNCTIONAL BLOCKS ── */}
        {activeTab === 'elements' && (
          <div className="space-y-4 text-xs">
            <div>
              <h2 className={`text-sm font-bold ${textPrimary}`}>Modular Invoice Blocks</h2>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                Toggle structured data components and remittance credentials.
              </p>
            </div>

            <div className="space-y-2">
              <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${innerCardBg} hover:border-[#FF6B4A]`}>
                <div>
                  <span className={`font-semibold block ${textPrimary}`}>GST Tax Breakdown</span>
                  <span className={`text-[10px] block ${textMuted}`}>Display CGST and SGST line item split</span>
                </div>
                <input
                  type="checkbox"
                  checked={properties.showGstBreakdown}
                  onChange={(e) => onUpdateProperties({ showGstBreakdown: e.target.checked })}
                  className="rounded text-[#FF6B4A] focus:ring-0"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${innerCardBg} hover:border-[#FF6B4A]`}>
                <div>
                  <span className={`font-semibold block ${textPrimary}`}>Bank Remittance Details</span>
                  <span className={`text-[10px] block ${textMuted}`}>Include bank account, IFSC, and UPI ID</span>
                </div>
                <input
                  type="checkbox"
                  checked={properties.showBankDetails}
                  onChange={(e) => onUpdateProperties({ showBankDetails: e.target.checked })}
                  className="rounded text-[#FF6B4A] focus:ring-0"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${innerCardBg} hover:border-[#FF6B4A]`}>
                <div>
                  <span className={`font-semibold block ${textPrimary}`}>Authorized Signature Line</span>
                  <span className={`text-[10px] block ${textMuted}`}>Printable signing rule on document base</span>
                </div>
                <input
                  type="checkbox"
                  checked={properties.showSignatureBlock}
                  onChange={(e) => onUpdateProperties({ showSignatureBlock: e.target.checked })}
                  className="rounded text-[#FF6B4A] focus:ring-0"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${innerCardBg} hover:border-[#FF6B4A]`}>
                <div>
                  <span className={`font-semibold block ${textPrimary}`}>Notes & Payment Terms</span>
                  <span className={`text-[10px] block ${textMuted}`}>Payment policies and client gratitude notice</span>
                </div>
                <input
                  type="checkbox"
                  checked={properties.showNotesTerms}
                  onChange={(e) => onUpdateProperties({ showNotesTerms: e.target.checked })}
                  className="rounded text-[#FF6B4A] focus:ring-0"
                />
              </label>
            </div>

            {/* Bank Credentials Sub-Form if Bank Block is enabled */}
            {properties.showBankDetails && (
              <div className={`space-y-3 pt-3 border-t ${subtleBorder}`}>
                <span className={`text-[11px] font-mono font-bold uppercase block ${textPrimary}`}>
                  Remittance Settings
                </span>

                <div className="space-y-1">
                  <label className={`text-[10px] font-mono uppercase font-bold block ${textMuted}`}>
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={properties.bankName}
                    onChange={(e) => onUpdateProperties({ bankName: e.target.value })}
                    placeholder="e.g. HDFC Bank, ICICI Bank"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputBg}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-mono uppercase font-bold block ${textMuted}`}>
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={properties.accountNumber}
                    onChange={(e) => onUpdateProperties({ accountNumber: e.target.value })}
                    placeholder="e.g. 98120019283100"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none ${inputBg}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-mono uppercase font-bold block ${textMuted}`}>
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={properties.ifscCode}
                      onChange={(e) => onUpdateProperties({ ifscCode: e.target.value })}
                      placeholder="HDFC0001242"
                      className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono uppercase border focus:outline-none ${inputBg}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-mono uppercase font-bold block ${textMuted}`}>
                      UPI ID
                    </label>
                    <input
                      type="text"
                      value={properties.upiId}
                      onChange={(e) => onUpdateProperties({ upiId: e.target.value })}
                      placeholder="billing@upi"
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none ${inputBg}`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
