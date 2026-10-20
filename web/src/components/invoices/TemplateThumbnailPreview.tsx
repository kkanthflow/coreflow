import React from 'react';
import type { InvoiceTemplateId } from '../../types/invoiceStudio';

interface TemplateThumbnailPreviewProps {
  templateId: InvoiceTemplateId;
  accentColor: string;
  isDark?: boolean;
}

export function TemplateThumbnailPreview({
  templateId,
  accentColor,
  isDark = false,
}: TemplateThumbnailPreviewProps) {
  const isDarkModeTemplate = templateId === 'obsidian_dark';
  const bg = isDarkModeTemplate ? '#090A0F' : isDark ? '#181920' : '#FFFFFF';
  const paperBorder = isDarkModeTemplate ? 'border-zinc-800' : isDark ? 'border-zinc-700' : 'border-zinc-200';
  const textMuted = isDarkModeTemplate ? 'rgba(255,255,255,0.2)' : isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';
  const textDark = isDarkModeTemplate ? '#FFFFFF' : isDark ? '#F5F5F5' : '#111827';

  return (
    <div
      className={`w-full h-24 rounded-lg border overflow-hidden relative shadow-xs select-none transition-transform group-hover:scale-[1.02] ${paperBorder}`}
      style={{ backgroundColor: bg }}
    >
      {/* ── 1. BOLD HEADER BAND TEMPLATE ── */}
      {templateId === 'bold_header_band' && (
        <div className="w-full h-full flex flex-col">
          <div className="w-full h-7 px-2 flex items-center justify-between" style={{ backgroundColor: accentColor }}>
            <div className="w-8 h-1.5 rounded-xs bg-white/90" />
            <div className="w-5 h-1.5 rounded-xs bg-white/70" />
          </div>
          <div className="p-2 flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="h-3 rounded-xs" style={{ backgroundColor: textMuted }} />
              <div className="h-3 rounded-xs" style={{ backgroundColor: textMuted }} />
            </div>
            <div className="space-y-1">
              <div className="h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
              <div className="h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
              <div className="h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            </div>
            <div className="flex justify-end">
              <div className="w-8 h-2 rounded-xs" style={{ backgroundColor: accentColor }} />
            </div>
          </div>
        </div>
      )}

      {/* ── 2. SIDEBAR LAYOUT TEMPLATE ── */}
      {templateId === 'sidebar_layout' && (
        <div className="w-full h-full flex">
          {/* Left Vertical Accent Sidebar */}
          <div className="w-9 h-full p-1.5 flex flex-col justify-between" style={{ backgroundColor: accentColor }}>
            <div className="space-y-1">
              <div className="w-4 h-4 rounded-full bg-white/80" />
              <div className="w-6 h-1 rounded-xs bg-white/70" />
              <div className="w-5 h-1 rounded-xs bg-white/60" />
            </div>
            <div className="w-6 h-1 rounded-xs bg-white/50" />
          </div>
          {/* Right Main Content */}
          <div className="flex-1 p-2 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="w-10 h-1.5 rounded-xs" style={{ backgroundColor: textDark }} />
              <div className="w-6 h-1.5 rounded-xs" style={{ backgroundColor: textMuted }} />
            </div>
            <div className="space-y-1">
              <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
              <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
              <div className="h-1 rounded-xs w-3/4" style={{ backgroundColor: textMuted }} />
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-zinc-200/40">
              <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
              <div className="w-7 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
            </div>
          </div>
        </div>
      )}

      {/* ── 3. COMPACT RETAIL / THERMAL TEMPLATE ── */}
      {templateId === 'compact_retail' && (
        <div className="w-full h-full p-2 flex flex-col items-center justify-between text-center">
          <div className="space-y-1 w-full flex flex-col items-center">
            <div className="w-12 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
            <div className="w-16 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-full border-b border-dashed border-zinc-400/50 my-1" />
          </div>
          <div className="w-full space-y-1 px-1">
            <div className="flex justify-between">
              <div className="w-10 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
              <div className="w-4 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            </div>
            <div className="flex justify-between">
              <div className="w-8 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
              <div className="w-4 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            </div>
          </div>
          <div className="w-full border-t border-dashed border-zinc-400/50 pt-1 flex justify-between items-center">
            <div className="w-6 h-1.5 rounded-xs" style={{ backgroundColor: textDark }} />
            <div className="w-8 h-2 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 4. GST TAX INVOICE TEMPLATE ── */}
      {templateId === 'gst_tax_invoice' && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="text-center pb-1 border-b" style={{ borderColor: accentColor }}>
            <div className="w-16 h-1.5 rounded-xs mx-auto" style={{ backgroundColor: accentColor }} />
            <div className="w-20 h-1 rounded-xs mx-auto mt-0.5" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="grid grid-cols-2 gap-1 text-[8px]">
            <div className="h-3 border rounded-xs p-0.5" style={{ borderColor: textMuted }}>
              <div className="w-6 h-0.5" style={{ backgroundColor: textMuted }} />
            </div>
            <div className="h-3 border rounded-xs p-0.5" style={{ borderColor: textMuted }}>
              <div className="w-6 h-0.5" style={{ backgroundColor: textMuted }} />
            </div>
          </div>
          {/* Mini Table with HSN split */}
          <div className="border rounded-xs overflow-hidden" style={{ borderColor: textMuted }}>
            <div className="h-2 flex" style={{ backgroundColor: `${accentColor}25` }}>
              <div className="w-1/3 border-r" style={{ borderColor: textMuted }} />
              <div className="w-1/3 border-r" style={{ borderColor: textMuted }} />
              <div className="w-1/3" />
            </div>
            <div className="h-1.5 border-t" style={{ borderColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center">
            <div className="w-10 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-7 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 5. QUOTATION / ESTIMATE TEMPLATE ── */}
      {templateId === 'quotation_estimate' && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <div className="w-10 h-1.5 rounded-xs" style={{ backgroundColor: textDark }} />
              <div className="w-7 h-1 rounded-xs mt-0.5" style={{ backgroundColor: textMuted }} />
            </div>
            <div className="px-1.5 py-0.5 rounded-xs text-[7px] font-mono font-bold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
              ESTIMATE
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="h-2.5 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="h-2.5 rounded-xs border border-amber-500/40 bg-amber-500/10" />
          </div>
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: textMuted }}>
            <div className="w-8 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-8 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 6. PROFORMA INVOICE TEMPLATE ── */}
      {templateId === 'proforma_invoice' && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-8 h-1.5 rounded-xs" style={{ backgroundColor: textDark }} />
            <div className="px-1.5 py-0.5 rounded-xs text-[7px] font-mono font-bold border" style={{ borderColor: accentColor, color: accentColor }}>
              PROFORMA
            </div>
          </div>
          <div className="p-1 rounded-xs border border-dashed border-zinc-400/50 flex justify-between items-center">
            <div className="w-8 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-5 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-3/4" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center">
            <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-8 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 7. PROFESSIONAL SERVICES TEMPLATE ── */}
      {templateId === 'professional_services' && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between items-center pb-1 border-b" style={{ borderColor: textMuted }}>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-xs" style={{ backgroundColor: accentColor }} />
              <div className="w-10 h-1.5 rounded-xs" style={{ backgroundColor: textDark }} />
            </div>
            <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="grid grid-cols-3 gap-1 py-1">
            <div className="h-2 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="h-2 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="h-2 rounded-xs" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-end">
            <div className="w-9 h-2 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 8. ELEGANT SERIF TEMPLATE ── */}
      {templateId === 'elegant_serif' && (
        <div className="w-full h-full p-2 flex flex-col justify-between border-2 border-double m-0.5" style={{ borderColor: accentColor }}>
          <div className="text-center">
            <div className="w-14 h-1.5 rounded-xs mx-auto" style={{ backgroundColor: textDark }} />
            <div className="w-8 h-0.5 mx-auto mt-1" style={{ backgroundColor: accentColor }} />
          </div>
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-double" style={{ borderColor: accentColor }}>
            <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-7 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 9. FREELANCER SIMPLE TEMPLATE ── */}
      {templateId === 'freelancer_simple' && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div>
            <div className="w-8 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
            <div className="w-12 h-1 rounded-xs mt-1" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="space-y-1 my-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center">
            <div className="w-5 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-6 h-1.5 rounded-xs font-bold" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 10. OBSIDIAN DARK TEMPLATE ── */}
      {templateId === 'obsidian_dark' && (
        <div className="w-full h-full p-2 flex flex-col justify-between bg-[#0B0C10]">
          <div className="flex justify-between items-center pb-1 border-b border-zinc-800">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <div className="w-8 h-1.5 rounded-xs bg-white" />
            </div>
            <div className="w-6 h-1 rounded-xs bg-zinc-700" />
          </div>
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full bg-zinc-800" />
            <div className="h-1 rounded-xs w-full bg-zinc-800" />
            <div className="h-1 rounded-xs w-3/4 bg-zinc-800" />
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-zinc-800">
            <div className="w-5 h-1 rounded-xs bg-zinc-700" />
            <div className="w-7 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 11. ENTERPRISE CLASSIC TEMPLATE ── */}
      {templateId === 'enterprise_classic' && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between items-center border-b-2 border-zinc-300 pb-1">
            <div className="w-10 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
            <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="h-3 border border-zinc-300 rounded-xs" />
            <div className="h-3 border border-zinc-300 rounded-xs" />
          </div>
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center border-t border-zinc-300 pt-1">
            <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-7 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── 12. MODERN MINIMALIST (DEFAULT) ── */}
      {templateId === 'modern_minimalist' && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="w-10 h-1.5 rounded-xs" style={{ backgroundColor: textDark }} />
            <div className="w-5 h-1 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
          <div className="w-full h-0.5" style={{ backgroundColor: `${accentColor}30` }} />
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-2/3" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center">
            <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-7 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* ── FALLBACK FOR OTHER TEMPLATES ── */}
      {!['bold_header_band', 'sidebar_layout', 'compact_retail', 'gst_tax_invoice', 'quotation_estimate', 'proforma_invoice', 'professional_services', 'elegant_serif', 'freelancer_simple', 'obsidian_dark', 'enterprise_classic', 'modern_minimalist'].includes(templateId) && (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="w-10 h-1.5 rounded-xs" style={{ backgroundColor: textDark }} />
            <div className="w-5 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
          <div className="space-y-1">
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
            <div className="h-1 rounded-xs w-full" style={{ backgroundColor: textMuted }} />
          </div>
          <div className="flex justify-between items-center">
            <div className="w-6 h-1 rounded-xs" style={{ backgroundColor: textMuted }} />
            <div className="w-7 h-1.5 rounded-xs" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}
    </div>
  );
}
