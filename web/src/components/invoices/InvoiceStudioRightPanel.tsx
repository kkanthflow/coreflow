import { useState } from 'react';
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
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  User,
  Calendar,
  CreditCard,
  Plus,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import type { CanvasElement, StudioDesignProperties, StudioLineItem } from '../../types/invoiceStudio';
import { ACCENT_PALETTES } from './templateGalleryData';

interface ClientAccount {
  id: string;
  name: string;
  company_name: string;
  gst_number?: string;
  email?: string;
  phone?: string;
  address?: string;
}

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
  onDeselectElement?: () => void;
  // Live Editable Data Props
  items?: StudioLineItem[];
  onAddItem?: () => void;
  onRemoveItem?: (id: string) => void;
  onUpdateItem?: (id: string, field: keyof StudioLineItem, val: any) => void;
  subtotal?: number;
  totalTax?: number;
  totalAmount?: number;
  clients?: ClientAccount[];
  clientId?: string;
  onClientChange?: (clientId: string) => void;
  onOpenCreateClientModal?: () => void;
  issueDate?: string;
  onIssueDateChange?: (val: string) => void;
  dueDate?: string;
  onDueDateChange?: (val: string) => void;
  currency?: string;
  onCurrencyChange?: (val: string) => void;
  invoiceNumber?: string;
  onInvoiceNumberChange?: (val: string) => void;
  seller?: {
    name: string;
    address?: string;
    gst?: string;
    email?: string;
    phone?: string;
  };
  isDark?: boolean;
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
  onDeselectElement,
  items = [],
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  subtotal = 0,
  totalTax = 0,
  totalAmount = 0,
  clients = [],
  clientId = '',
  onClientChange,
  onOpenCreateClientModal,
  issueDate = '',
  onIssueDateChange,
  dueDate = '',
  onDueDateChange,
  currency = 'USD',
  onCurrencyChange,
  invoiceNumber = '',
  onInvoiceNumberChange,
  seller,
  isDark = true,
}: InvoiceStudioRightPanelProps) {
  // Sub-tab when no element is selected: 'content' | 'style'
  const [globalTab, setGlobalTab] = useState<'content' | 'style'>('content');
  // Collapsible toggle for transform/layering controls
  const [showTransform, setShowTransform] = useState<boolean>(false);

  // Dynamic theme tokens
  const containerClasses = isDark
    ? 'border-zinc-800 bg-[#0E0F15] text-[#F5F5F5]'
    : 'border-zinc-200 bg-white text-zinc-900 shadow-sm';
  const headerClasses = isDark
    ? 'border-zinc-800 bg-[#0A0B10]'
    : 'border-zinc-200 bg-zinc-50';
  const cardClasses = isDark
    ? 'border-zinc-800 bg-[#12131A]'
    : 'border-zinc-200 bg-zinc-50/80';
  const inputClasses = isDark
    ? 'bg-[#0A0B10] border-zinc-800 text-[#F5F5F5] placeholder-zinc-500 focus:border-[#FF6B4A]'
    : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-[#FF6B4A] shadow-2xs';
  const labelClasses = isDark ? 'text-[#A1A1AA]' : 'text-zinc-600';
  const subtleBorder = isDark ? 'border-zinc-800' : 'border-zinc-200';

  // Helper for quick payment terms
  const handleSetQuickTerm = (days: number) => {
    if (!onDueDateChange) return;
    const base = issueDate ? new Date(issueDate) : new Date();
    base.setDate(base.getDate() + days);
    onDueDateChange(base.toISOString().split('T')[0]);
  };

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <aside
      className={`w-80 lg:w-96 flex flex-col border-l h-full shrink-0 select-none transition-all duration-200 ${containerClasses} ${
        isOpen ? 'block' : 'hidden'
      }`}
    >
      {/* ── PANEL HEADER ── */}
      <div className={`h-12 border-b px-4 flex items-center justify-between shrink-0 ${headerClasses}`}>
        <div className="flex items-center gap-2">
          {selectedElement ? (
            <>
              {onDeselectElement && (
                <button
                  type="button"
                  onClick={onDeselectElement}
                  className={`p-1 rounded transition-colors ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-zinc-200 text-zinc-600 hover:text-black'
                  }`}
                  title="Back to Global Properties"
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <Edit3 size={14} className="text-[#FF6B4A]" />
              <div className="flex flex-col">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider truncate max-w-[150px]">
                  {selectedElement.name}
                </span>
                <span className="text-[9px] font-mono text-[#FF6B4A]">Live Editable</span>
              </div>
            </>
          ) : (
            <>
              <Sliders size={14} className="text-[#FF6B4A]" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider">
                Studio Inspector
              </h2>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              selectedElement
                ? 'bg-[#FF6B4A]/15 text-[#FF6B4A] border border-[#FF6B4A]/30'
                : isDark
                ? 'bg-zinc-800 text-[#A1A1AA]'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {selectedElement ? selectedElement.type : 'A4 Document'}
          </span>
          {onToggleOpen && (
            <button
              type="button"
              onClick={onToggleOpen}
              className={`p-1 rounded transition-colors ${
                isDark ? 'hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]' : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
              title="Close Panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── MODE TABS (WHEN NO ELEMENT IS SELECTED) ── */}
      {!selectedElement && (
        <div className={`flex items-center border-b p-1.5 gap-1 shrink-0 ${subtleBorder} ${headerClasses}`}>
          <button
            type="button"
            onClick={() => setGlobalTab('content')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-mono text-xs font-bold transition-all ${
              globalTab === 'content'
                ? 'bg-[#FF6B4A] text-white shadow-xs'
                : isDark
                ? 'text-[#A1A1AA] hover:text-[#F5F5F5]'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Edit3 size={13} />
            <span>Edit Content ({items.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setGlobalTab('style')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-mono text-xs font-bold transition-all ${
              globalTab === 'style'
                ? 'bg-[#FF6B4A] text-white shadow-xs'
                : isDark
                ? 'text-[#A1A1AA] hover:text-[#F5F5F5]'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Palette size={13} />
            <span>Canvas Style</span>
          </button>
        </div>
      )}

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* ═══════════════════════════════════════════════════════ */}
        {/* CASE A: AN ELEMENT IS SELECTED                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        {selectedElement ? (
          <div className="space-y-4">
            {/* Quick Actions Bar: Lock, Duplicate, Delete */}
            <div className={`flex items-center justify-between p-2.5 rounded-lg border ${cardClasses}`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF6B4A] animate-pulse" />
                <span className="font-mono text-[11px] font-bold truncate max-w-[130px]">
                  {selectedElement.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSelectedElement({ isLocked: !selectedElement.isLocked })
                  }
                  className={`p-1.5 rounded transition-colors ${
                    selectedElement.isLocked
                      ? 'bg-[#FF6B4A] text-white'
                      : isDark
                      ? 'hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]'
                      : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
                  }`}
                  title={selectedElement.isLocked ? 'Unlock Element' : 'Lock Element Position'}
                >
                  {selectedElement.isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>

                <button
                  type="button"
                  onClick={onDuplicateSelectedElement}
                  className={`p-1.5 rounded transition-colors ${
                    isDark
                      ? 'hover:bg-zinc-800 text-[#A1A1AA] hover:text-[#F5F5F5]'
                      : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
                  }`}
                  title="Duplicate Element (Ctrl+D)"
                >
                  <Copy size={13} />
                </button>

                <button
                  type="button"
                  onClick={onDeleteSelectedElement}
                  disabled={selectedElement.isLocked}
                  className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
                    isDark
                      ? 'hover:bg-zinc-800 text-[#A1A1AA] hover:text-red-400'
                      : 'hover:bg-zinc-200 text-zinc-600 hover:text-red-600'
                  }`}
                  title="Delete Element (Delete)"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* ── 1. ELEMENT-SPECIFIC EDITABLE FORM ── */}

            {/* 1A: LINE ITEMS TABLE (data-items-table) */}
            {selectedElement.type === 'data-items-table' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                    <FileText size={13} className="text-[#FF6B4A]" />
                    <span>Line Items & Rates ({items.length})</span>
                  </span>
                  {onAddItem && (
                    <button
                      type="button"
                      onClick={onAddItem}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#FF6B4A] hover:underline"
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {items.map((it, idx) => {
                    const rowSub = it.quantity * it.rate - (it.discount || 0);
                    const rowTax = rowSub * ((it.tax_rate || 0) / 100);
                    const rowTotal = rowSub + rowTax;

                    return (
                      <div key={it.id} className={`p-2.5 rounded-lg border space-y-2 ${cardClasses}`}>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-mono text-[#FF6B4A] font-bold">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            placeholder="Deliverable or item description..."
                            value={it.description}
                            onChange={(e) =>
                              onUpdateItem && onUpdateItem(it.id, 'description', e.target.value)
                            }
                            className={`flex-1 px-2 py-1 rounded text-xs border font-medium focus:outline-none ${inputClasses}`}
                          />
                          {onRemoveItem && (
                            <button
                              type="button"
                              onClick={() => onRemoveItem(it.id)}
                              disabled={items.length <= 1}
                              className="text-zinc-400 hover:text-red-400 disabled:opacity-20 p-1 transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                          <div>
                            <label className={`text-[9px] block mb-0.5 ${labelClasses}`}>Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) =>
                                onUpdateItem &&
                                onUpdateItem(it.id, 'quantity', parseFloat(e.target.value) || 1)
                              }
                              className={`w-full px-1.5 py-1 rounded border text-right focus:outline-none ${inputClasses}`}
                            />
                          </div>

                          <div>
                            <label className={`text-[9px] block mb-0.5 ${labelClasses}`}>Rate ({currency})</label>
                            <input
                              type="number"
                              step="0.01"
                              value={it.rate}
                              onChange={(e) =>
                                onUpdateItem &&
                                onUpdateItem(it.id, 'rate', parseFloat(e.target.value) || 0)
                              }
                              className={`w-full px-1.5 py-1 rounded border text-right focus:outline-none ${inputClasses}`}
                            />
                          </div>

                          <div>
                            <label className={`text-[9px] block mb-0.5 ${labelClasses}`}>Tax (%)</label>
                            <input
                              type="number"
                              value={it.tax_rate}
                              onChange={(e) =>
                                onUpdateItem &&
                                onUpdateItem(it.id, 'tax_rate', parseFloat(e.target.value) || 0)
                              }
                              className={`w-full px-1.5 py-1 rounded border text-right focus:outline-none ${inputClasses}`}
                            />
                          </div>
                        </div>

                        <div className={`flex justify-between items-center text-[10px] font-mono pt-1 border-t ${subtleBorder}`}>
                          <span className={labelClasses}>Row Total:</span>
                          <span className="font-bold text-[#FF6B4A]">
                            {currency} {rowTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Summary Footprint */}
                <div className={`p-3 rounded-lg border font-mono text-xs space-y-1 ${cardClasses}`}>
                  <div className={`flex justify-between ${labelClasses}`}>
                    <span>Subtotal:</span>
                    <span>{currency} {subtotal.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between ${labelClasses}`}>
                    <span>Tax:</span>
                    <span>{currency} {totalTax.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between font-bold pt-1.5 border-t text-sm ${subtleBorder}`}>
                    <span>Grand Total:</span>
                    <span className="text-[#FF6B4A]">{currency} {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </section>
            )}

            {/* 1B: CLIENT ACCOUNT (data-client) */}
            {selectedElement.type === 'data-client' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                    <User size={13} className="text-[#FF6B4A]" />
                    <span>Client Details & Account</span>
                  </span>
                  {onOpenCreateClientModal && (
                    <button
                      type="button"
                      onClick={onOpenCreateClientModal}
                      className="text-[11px] font-bold text-[#FF6B4A] hover:underline flex items-center gap-0.5"
                    >
                      <Plus size={11} /> New Client
                    </button>
                  )}
                </div>

                <div>
                  <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Select Client Account
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => onClientChange && onClientChange(e.target.value)}
                    className={`w-full rounded-lg px-2.5 py-2 text-xs border focus:outline-none ${inputClasses}`}
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

                {/* Display client metadata card */}
                {selectedClient ? (
                  <div className={`p-3 rounded-lg border text-xs space-y-2 ${cardClasses}`}>
                    <div>
                      <span className={`text-[10px] font-mono block ${labelClasses}`}>Contact Name</span>
                      <span className="font-semibold">{selectedClient.name}</span>
                    </div>
                    {selectedClient.company_name && (
                      <div>
                        <span className={`text-[10px] font-mono block ${labelClasses}`}>Company</span>
                        <span className="font-semibold">{selectedClient.company_name}</span>
                      </div>
                    )}
                    {selectedClient.email && (
                      <div>
                        <span className={`text-[10px] font-mono block ${labelClasses}`}>Email</span>
                        <span className="font-mono text-[11px]">{selectedClient.email}</span>
                      </div>
                    )}
                    {selectedClient.gst_number && (
                      <div>
                        <span className={`text-[10px] font-mono block ${labelClasses}`}>GSTIN / Tax ID</span>
                        <span className="font-mono text-[11px] font-bold text-[#FF6B4A]">
                          {selectedClient.gst_number}
                        </span>
                      </div>
                    )}
                    {selectedClient.address && (
                      <div>
                        <span className={`text-[10px] font-mono block ${labelClasses}`}>Billing Address</span>
                        <span className="text-[11px] leading-relaxed block">{selectedClient.address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-3 rounded-lg border text-xs text-amber-500/90 bg-amber-500/10 border-amber-500/30`}>
                    Previewing with sample client details. Select or register an official client account above to issue invoices.
                  </div>
                )}
              </section>
            )}

            {/* 1C: DATES & REFERENCE (data-dates) */}
            {selectedElement.type === 'data-dates' && (
              <section className="space-y-3">
                <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                  <Calendar size={13} className="text-[#FF6B4A]" />
                  <span>Dates, Due Term & Currency</span>
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => onIssueDateChange && onIssueDateChange(e.target.value)}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono border focus:outline-none ${inputClasses}`}
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => onDueDateChange && onDueDateChange(e.target.value)}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono border focus:outline-none ${inputClasses}`}
                    />
                  </div>
                </div>

                {/* Quick Payment Terms */}
                <div>
                  <span className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Quick Payment Terms
                  </span>
                  <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                    {[
                      { label: 'Receipt', days: 0 },
                      { label: 'Net 15', days: 15 },
                      { label: 'Net 30', days: 30 },
                      { label: 'Net 60', days: 60 },
                    ].map((term) => (
                      <button
                        key={term.label}
                        type="button"
                        onClick={() => handleSetQuickTerm(term.days)}
                        className={`p-1.5 rounded border text-center transition-colors ${
                          isDark
                            ? 'bg-[#12131A] border-zinc-800 hover:border-[#FF6B4A] text-zinc-300'
                            : 'bg-zinc-100 border-zinc-200 hover:border-[#FF6B4A] text-zinc-700'
                        }`}
                      >
                        {term.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Invoice Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => onCurrencyChange && onCurrencyChange(e.target.value)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputClasses}`}
                  >
                    <option value="USD">USD ($ - United States Dollar)</option>
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                    <option value="CAD">CAD ($ - Canadian Dollar)</option>
                    <option value="AUD">AUD ($ - Australian Dollar)</option>
                  </select>
                </div>
              </section>
            )}

            {/* 1D: HEADER & BRANDING (data-header) */}
            {selectedElement.type === 'data-header' && (
              <section className="space-y-3">
                <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                  <FileText size={13} className="text-[#FF6B4A]" />
                  <span>Invoice Title & Organization</span>
                </span>

                <div>
                  <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Invoice Serial Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => onInvoiceNumberChange && onInvoiceNumberChange(e.target.value)}
                    placeholder="INV-0001"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold border focus:outline-none ${inputClasses}`}
                  />
                </div>

                {seller && (
                  <div className={`p-3 rounded-lg border text-xs space-y-2 ${cardClasses}`}>
                    <div>
                      <span className={`text-[10px] font-mono block ${labelClasses}`}>Organization / Seller</span>
                      <span className="font-semibold">{seller.name || 'Your Business Name'}</span>
                    </div>
                    {seller.address && (
                      <div>
                        <span className={`text-[10px] font-mono block ${labelClasses}`}>Business Address</span>
                        <span className="text-[11px]">{seller.address}</span>
                      </div>
                    )}
                    {seller.gst && (
                      <div>
                        <span className={`text-[10px] font-mono block ${labelClasses}`}>GSTIN / Tax ID</span>
                        <span className="font-mono text-[11px] font-bold text-[#FF6B4A]">{seller.gst}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* 1E: NOTES & TERMS (data-notes-terms) */}
            {selectedElement.type === 'data-notes-terms' && (
              <section className="space-y-3">
                <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                  <FileText size={13} className="text-[#FF6B4A]" />
                  <span>Custom Notes & Payment Terms</span>
                </span>

                <div>
                  <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Client Notes / Greeting
                  </label>
                  <textarea
                    rows={3}
                    value={properties.customNotes}
                    onChange={(e) => onUpdateProperties({ customNotes: e.target.value })}
                    placeholder="Thank you for your business. Please reach out with any questions..."
                    className={`w-full rounded-lg p-2 text-xs border focus:outline-none resize-none ${inputClasses}`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Terms & Payment Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={properties.paymentTerms}
                    onChange={(e) => onUpdateProperties({ paymentTerms: e.target.value })}
                    placeholder="Payment is due within 30 days of issue date..."
                    className={`w-full rounded-lg p-2 text-xs border focus:outline-none resize-none ${inputClasses}`}
                  />
                </div>
              </section>
            )}

            {/* 1F: SETTLEMENT & REMITTANCE (data-remittance) */}
            {selectedElement.type === 'data-remittance' && (
              <section className="space-y-3">
                <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                  <CreditCard size={13} className="text-[#FF6B4A]" />
                  <span>Bank Details & UPI Remittance</span>
                </span>

                <div>
                  <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Beneficiary Bank Name
                  </label>
                  <input
                    type="text"
                    value={properties.bankName}
                    onChange={(e) => onUpdateProperties({ bankName: e.target.value })}
                    placeholder="e.g. Silicon Valley Bank / HDFC Bank"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputClasses}`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={properties.accountNumber}
                    onChange={(e) => onUpdateProperties({ accountNumber: e.target.value })}
                    placeholder="e.g. 9876543210123"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none ${inputClasses}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                      IFSC / Swift
                    </label>
                    <input
                      type="text"
                      value={properties.ifscCode}
                      onChange={(e) => onUpdateProperties({ ifscCode: e.target.value })}
                      placeholder="HDFC0001234"
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase border focus:outline-none ${inputClasses}`}
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                      UPI ID / VPA
                    </label>
                    <input
                      type="text"
                      value={properties.upiId}
                      onChange={(e) => onUpdateProperties({ upiId: e.target.value })}
                      placeholder="business@upi"
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none ${inputClasses}`}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 1G: TOTALS & TAX BREAKDOWN (data-totals) */}
            {selectedElement.type === 'data-totals' && (
              <section className="space-y-3">
                <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                  <CreditCard size={13} className="text-[#FF6B4A]" />
                  <span>Financial Breakdown</span>
                </span>

                <div className={`p-3 rounded-lg border font-mono text-xs space-y-2 ${cardClasses}`}>
                  <div className={`flex justify-between ${labelClasses}`}>
                    <span>Subtotal:</span>
                    <span>{currency} {subtotal.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between ${labelClasses}`}>
                    <span>Tax (GST/VAT):</span>
                    <span>{currency} {totalTax.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between font-bold text-sm pt-2 border-t ${subtleBorder}`}>
                    <span>Total Amount:</span>
                    <span className="text-[#FF6B4A]">{currency} {totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={properties.showGstBreakdown}
                      onChange={(e) => onUpdateProperties({ showGstBreakdown: e.target.checked })}
                      className="rounded accent-[#FF6B4A]"
                    />
                    <span className="text-xs font-medium">Show Detailed CGST / SGST breakdown</span>
                  </label>
                </div>
              </section>
            )}

            {/* 1H: CUSTOM TEXT ELEMENT (text) */}
            {selectedElement.type === 'text' && (
              <section className="space-y-3">
                <span className={`font-mono font-bold uppercase text-[10px] block ${labelClasses}`}>
                  Text Content & Style
                </span>
                <textarea
                  rows={2}
                  value={selectedElement.content}
                  onChange={(e) => onUpdateSelectedElement({ content: e.target.value })}
                  className={`w-full rounded p-2 text-xs border focus:outline-none resize-none ${inputClasses}`}
                  placeholder="Text contents..."
                />

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className={`text-[10px] block mb-1 ${labelClasses}`}>Font Size</span>
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
                      className={`w-full rounded px-2 py-1 text-xs border focus:outline-none ${inputClasses}`}
                    />
                  </div>
                  <div>
                    <span className={`text-[10px] block mb-1 ${labelClasses}`}>Font Style</span>
                    <select
                      value={selectedElement.fontFamily}
                      onChange={(e) =>
                        onUpdateSelectedElement({
                          fontFamily: e.target.value as any,
                        })
                      }
                      className={`w-full rounded px-1.5 py-1 text-xs border focus:outline-none ${inputClasses}`}
                    >
                      <option value="sans">Inter (Sans)</option>
                      <option value="serif">Playfair (Serif)</option>
                      <option value="mono">JetBrains (Mono)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className={`text-[10px] font-mono ${labelClasses}`}>Color:</span>
                  <input
                    type="color"
                    value={selectedElement.color || '#FFFFFF'}
                    onChange={(e) => onUpdateSelectedElement({ color: e.target.value })}
                    className="w-7 h-7 rounded border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selectedElement.color || ''}
                    onChange={(e) => onUpdateSelectedElement({ color: e.target.value })}
                    className={`flex-1 rounded px-2 py-1 text-xs font-mono uppercase border focus:outline-none ${inputClasses}`}
                  />
                </div>
              </section>
            )}

            {/* 1I: SHAPE ELEMENT (shape) */}
            {selectedElement.type === 'shape' && (
              <section className="space-y-3">
                <span className={`font-mono font-bold uppercase text-[10px] block ${labelClasses}`}>
                  Shape Styling
                </span>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono ${labelClasses}`}>Fill:</span>
                  <input
                    type="color"
                    value={selectedElement.fillColor || '#FF6B4A'}
                    onChange={(e) =>
                      onUpdateSelectedElement({ fillColor: e.target.value })
                    }
                    className="w-7 h-7 rounded border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selectedElement.fillColor || ''}
                    onChange={(e) =>
                      onUpdateSelectedElement({ fillColor: e.target.value })
                    }
                    className={`flex-1 rounded px-2 py-1 text-xs font-mono uppercase border focus:outline-none ${inputClasses}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className={`text-[10px] block mb-1 ${labelClasses}`}>Border W</span>
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
                      className={`w-full rounded px-2 py-1 text-xs border focus:outline-none ${inputClasses}`}
                    />
                  </div>
                  <div>
                    <span className={`text-[10px] block mb-1 ${labelClasses}`}>Radius</span>
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
                      className={`w-full rounded px-2 py-1 text-xs border focus:outline-none ${inputClasses}`}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ── 2. COLLAPSIBLE GEOMETRY & LAYERING CONTROLS ── */}
            <div className={`pt-3 border-t ${subtleBorder}`}>
              <button
                type="button"
                onClick={() => setShowTransform(!showTransform)}
                className={`w-full flex items-center justify-between py-1 text-[11px] font-mono font-bold uppercase transition-colors ${labelClasses} hover:text-[#FF6B4A]`}
              >
                <span className="flex items-center gap-1.5">
                  <Sliders size={12} />
                  <span>Transform Coordinates & Layering</span>
                </span>
                {showTransform ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showTransform && (
                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className={`border rounded p-1.5 flex items-center justify-between ${cardClasses}`}>
                      <span className={`text-[10px] ${labelClasses}`}>X</span>
                      <input
                        type="number"
                        disabled={selectedElement.isLocked}
                        value={selectedElement.x}
                        onChange={(e) =>
                          onUpdateSelectedElement({ x: parseInt(e.target.value) || 0 })
                        }
                        className="w-16 bg-transparent text-right focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div className={`border rounded p-1.5 flex items-center justify-between ${cardClasses}`}>
                      <span className={`text-[10px] ${labelClasses}`}>Y</span>
                      <input
                        type="number"
                        disabled={selectedElement.isLocked}
                        value={selectedElement.y}
                        onChange={(e) =>
                          onUpdateSelectedElement({ y: parseInt(e.target.value) || 0 })
                        }
                        className="w-16 bg-transparent text-right focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div className={`border rounded p-1.5 flex items-center justify-between ${cardClasses}`}>
                      <span className={`text-[10px] ${labelClasses}`}>W</span>
                      <input
                        type="number"
                        min="20"
                        disabled={selectedElement.isLocked}
                        value={selectedElement.width}
                        onChange={(e) =>
                          onUpdateSelectedElement({ width: parseInt(e.target.value) || 20 })
                        }
                        className="w-16 bg-transparent text-right focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div className={`border rounded p-1.5 flex items-center justify-between ${cardClasses}`}>
                      <span className={`text-[10px] ${labelClasses}`}>H</span>
                      <input
                        type="number"
                        min="10"
                        disabled={selectedElement.isLocked}
                        value={selectedElement.height}
                        onChange={(e) =>
                          onUpdateSelectedElement({ height: parseInt(e.target.value) || 10 })
                        }
                        className="w-16 bg-transparent text-right focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Rotation & Opacity */}
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div className={`border rounded p-1.5 flex items-center justify-between ${cardClasses}`}>
                      <span className={`text-[10px] ${labelClasses}`}>Rot°</span>
                      <input
                        type="number"
                        disabled={selectedElement.isLocked}
                        value={selectedElement.rotation}
                        onChange={(e) =>
                          onUpdateSelectedElement({ rotation: parseInt(e.target.value) || 0 })
                        }
                        className="w-16 bg-transparent text-right focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div className={`border rounded p-1.5 flex items-center justify-between ${cardClasses}`}>
                      <span className={`text-[10px] ${labelClasses}`}>Opacity</span>
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
                        className="w-16 bg-transparent text-right focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Layer Ordering Controls */}
                  <div className="space-y-1.5 pt-1">
                    <span className={`font-mono font-bold uppercase text-[10px] flex items-center gap-1.5 ${labelClasses}`}>
                      <Layers size={11} className="text-[#FF6B4A]" />
                      <span>Layer Stacking</span>
                    </span>
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => onReorderElementLayer('front')}
                        className={`p-1.5 rounded border text-center transition-colors ${
                          isDark ? 'border-zinc-800 bg-[#12131A] hover:bg-zinc-800' : 'border-zinc-200 bg-zinc-100 hover:bg-zinc-200'
                        }`}
                        title="Bring to Front"
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorderElementLayer('up')}
                        className={`p-1.5 rounded border flex items-center justify-center transition-colors ${
                          isDark ? 'border-zinc-800 bg-[#12131A] hover:bg-zinc-800' : 'border-zinc-200 bg-zinc-100 hover:bg-zinc-200'
                        }`}
                        title="Forward"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorderElementLayer('down')}
                        className={`p-1.5 rounded border flex items-center justify-center transition-colors ${
                          isDark ? 'border-zinc-800 bg-[#12131A] hover:bg-zinc-800' : 'border-zinc-200 bg-zinc-100 hover:bg-zinc-200'
                        }`}
                        title="Backward"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorderElementLayer('back')}
                        className={`p-1.5 rounded border text-center transition-colors ${
                          isDark ? 'border-zinc-800 bg-[#12131A] hover:bg-zinc-800' : 'border-zinc-200 bg-zinc-100 hover:bg-zinc-200'
                        }`}
                        title="Send to Back"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════ */
          /* CASE B: NO ELEMENT SELECTED                             */
          /* ═══════════════════════════════════════════════════════ */
          <>
            {/* SUB-TAB 1: LIVE EDITABLE INVOICE CONTENT */}
            {globalTab === 'content' && (
              <div className="space-y-5">
                {/* 1. INVOICE META & DATES */}
                <section className="space-y-3">
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                    <Calendar size={13} className="text-[#FF6B4A]" />
                    <span>Invoice Details & Dates</span>
                  </span>

                  <div>
                    <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                      Invoice Serial Number
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => onInvoiceNumberChange && onInvoiceNumberChange(e.target.value)}
                      placeholder="INV-0001"
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold border focus:outline-none ${inputClasses}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => onIssueDateChange && onIssueDateChange(e.target.value)}
                        className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono border focus:outline-none ${inputClasses}`}
                      />
                    </div>

                    <div>
                      <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => onDueDateChange && onDueDateChange(e.target.value)}
                        className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono border focus:outline-none ${inputClasses}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => onCurrencyChange && onCurrencyChange(e.target.value)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputClasses}`}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                    </select>
                  </div>
                </section>

                {/* 2. CLIENT ACCOUNT */}
                <section className={`space-y-3 pt-4 border-t ${subtleBorder}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                      <User size={13} className="text-[#FF6B4A]" />
                      <span>Client Account</span>
                    </span>
                    {onOpenCreateClientModal && (
                      <button
                        type="button"
                        onClick={onOpenCreateClientModal}
                        className="text-[11px] font-bold text-[#FF6B4A] hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={11} /> New Client
                      </button>
                    )}
                  </div>

                  <select
                    value={clientId}
                    onChange={(e) => onClientChange && onClientChange(e.target.value)}
                    className={`w-full rounded-lg px-2.5 py-2 text-xs border focus:outline-none ${inputClasses}`}
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
                </section>

                {/* 3. LINE ITEMS (EDITABLE LIST) */}
                <section className={`space-y-3 pt-4 border-t ${subtleBorder}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                      <FileText size={13} className="text-[#FF6B4A]" />
                      <span>Line Items ({items.length})</span>
                    </span>
                    {onAddItem && (
                      <button
                        type="button"
                        onClick={onAddItem}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#FF6B4A] hover:underline"
                      >
                        <Plus size={12} /> Add Item
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div key={it.id} className={`p-2.5 rounded-lg border space-y-2 ${cardClasses}`}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono font-bold text-[#FF6B4A]">#{idx + 1}</span>
                          <input
                            type="text"
                            placeholder="Description..."
                            value={it.description}
                            onChange={(e) => onUpdateItem && onUpdateItem(it.id, 'description', e.target.value)}
                            className={`flex-1 px-2 py-1 rounded text-xs border font-medium focus:outline-none ${inputClasses}`}
                          />
                          {onRemoveItem && (
                            <button
                              type="button"
                              onClick={() => onRemoveItem(it.id)}
                              disabled={items.length <= 1}
                              className="text-zinc-400 hover:text-red-400 disabled:opacity-20 p-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                          <div>
                            <span className={`text-[9px] block ${labelClasses}`}>Qty</span>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => onUpdateItem && onUpdateItem(it.id, 'quantity', parseFloat(e.target.value) || 1)}
                              className={`w-full px-1.5 py-1 rounded border text-right focus:outline-none ${inputClasses}`}
                            />
                          </div>
                          <div>
                            <span className={`text-[9px] block ${labelClasses}`}>Rate</span>
                            <input
                              type="number"
                              step="0.01"
                              value={it.rate}
                              onChange={(e) => onUpdateItem && onUpdateItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                              className={`w-full px-1.5 py-1 rounded border text-right focus:outline-none ${inputClasses}`}
                            />
                          </div>
                          <div>
                            <span className={`text-[9px] block ${labelClasses}`}>Tax%</span>
                            <input
                              type="number"
                              value={it.tax_rate}
                              onChange={(e) => onUpdateItem && onUpdateItem(it.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                              className={`w-full px-1.5 py-1 rounded border text-right focus:outline-none ${inputClasses}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Footprint */}
                  <div className={`p-3 rounded-lg border font-mono text-xs space-y-1 ${cardClasses}`}>
                    <div className={`flex justify-between ${labelClasses}`}>
                      <span>Subtotal:</span>
                      <span>{currency} {subtotal.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between ${labelClasses}`}>
                      <span>Tax:</span>
                      <span>{currency} {totalTax.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between font-bold pt-1 border-t text-sm ${subtleBorder}`}>
                      <span>Total:</span>
                      <span className="text-[#FF6B4A]">{currency} {totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </section>

                {/* 4. SETTLEMENT DETAILS */}
                <section className={`space-y-3 pt-4 border-t ${subtleBorder}`}>
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                    <CreditCard size={13} className="text-[#FF6B4A]" />
                    <span>Payment Remittance Details</span>
                  </span>

                  <div>
                    <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={properties.bankName}
                      onChange={(e) => onUpdateProperties({ bankName: e.target.value })}
                      placeholder="Bank name"
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${inputClasses}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                        Account No.
                      </label>
                      <input
                        type="text"
                        value={properties.accountNumber}
                        onChange={(e) => onUpdateProperties({ accountNumber: e.target.value })}
                        placeholder="Account number"
                        className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none ${inputClasses}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelClasses}`}>
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={properties.ifscCode}
                        onChange={(e) => onUpdateProperties({ ifscCode: e.target.value })}
                        placeholder="IFSC"
                        className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase border focus:outline-none ${inputClasses}`}
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* SUB-TAB 2: CANVAS STYLE & THEME */}
            {globalTab === 'style' && (
              <div className="space-y-5">
                {/* 1. COLOR & PALETTE SECTION */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                      <Palette size={13} className="text-[#FF6B4A]" />
                      <span>ACCENT COLOR</span>
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      isDark ? 'bg-zinc-800 text-[#F5F5F5]' : 'bg-zinc-100 text-zinc-800'
                    }`}>
                      {properties.accentColor}
                    </span>
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
                              : 'hover:scale-102 border border-black/10'
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
                      className="w-7 h-7 rounded border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={properties.accentColor}
                      onChange={(e) => onUpdateProperties({ accentColor: e.target.value })}
                      placeholder="#FF6B4A"
                      className={`flex-1 rounded px-2 py-1 text-xs font-mono uppercase border focus:outline-none ${inputClasses}`}
                    />
                  </div>
                </section>

                {/* 2. TYPOGRAPHY SECTION */}
                <section className={`space-y-3 pt-4 border-t ${subtleBorder}`}>
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
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
                              : isDark
                              ? 'border-zinc-800 bg-[#12131A] hover:border-zinc-700'
                              : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                          }`}
                        >
                          <span className={`text-base font-bold block ${f.fontClass} ${
                            isSelected ? 'text-[#FF6B4A]' : isDark ? 'text-[#D4D4D8]' : 'text-zinc-800'
                          }`}>
                            Aa
                          </span>
                          <span className={`text-[10px] font-mono block mt-0.5 ${
                            isSelected ? 'font-bold text-[#FF6B4A]' : labelClasses
                          }`}>
                            {f.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 3. PRINT & CANVAS THEME */}
                <section className={`space-y-3 pt-4 border-t ${subtleBorder}`}>
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
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
                          : isDark
                          ? 'border-zinc-800 bg-[#12131A] hover:border-zinc-700'
                          : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                      }`}
                    >
                      <span className="font-bold text-xs block">Classic Paper</span>
                      <span className={`text-[10px] block mt-0.5 ${labelClasses}`}>High-contrast white</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateProperties({ printTheme: 'dark' })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        properties.printTheme === 'dark'
                          ? 'border-[#FF6B4A] bg-[#FF6B4A]/15 ring-1 ring-[#FF6B4A]/40'
                          : isDark
                          ? 'border-zinc-800 bg-[#12131A] hover:border-zinc-700'
                          : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                      }`}
                    >
                      <span className="font-bold text-xs block">Obsidian Dark</span>
                      <span className={`text-[10px] block mt-0.5 ${labelClasses}`}>Sleek dark canvas</span>
                    </button>
                  </div>
                </section>

                {/* 4. LAYOUT DENSITY */}
                <section className={`space-y-3 pt-4 border-t ${subtleBorder}`}>
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
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
                              : isDark
                              ? 'border-zinc-800 bg-[#12131A] text-[#A1A1AA] hover:text-[#F5F5F5]'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          {density}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 5. DOCUMENT FEATURE TOGGLES */}
                <section className={`space-y-2.5 pt-4 border-t ${subtleBorder}`}>
                  <span className={`font-mono font-bold uppercase text-[11px] flex items-center gap-1.5 ${labelClasses}`}>
                    <Sparkles size={13} className="text-[#FF6B4A]" />
                    <span>Document Sections</span>
                  </span>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={properties.showBankDetails}
                        onChange={(e) => onUpdateProperties({ showBankDetails: e.target.checked })}
                        className="rounded accent-[#FF6B4A]"
                      />
                      <span>Show Bank & Remittance details</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={properties.showNotesTerms}
                        onChange={(e) => onUpdateProperties({ showNotesTerms: e.target.checked })}
                        className="rounded accent-[#FF6B4A]"
                      />
                      <span>Show Terms & Notes block</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={properties.showSignatureBlock}
                        onChange={(e) => onUpdateProperties({ showSignatureBlock: e.target.checked })}
                        className="rounded accent-[#FF6B4A]"
                      />
                      <span>Show Authorized Signature block</span>
                    </label>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
