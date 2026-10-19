import type {
  CanvasElement,
  StudioDesignProperties,
  StudioLineItem,
} from '../../types/invoiceStudio';
import { formatCurrency } from '../../lib/currency';

interface CanvasElementRendererProps {
  element: CanvasElement;
  properties: StudioDesignProperties;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  seller: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  };
  client: {
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  } | null;
  items: StudioLineItem[];
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
}

export function CanvasElementRenderer({
  element,
  properties,
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  seller,
  client,
  items,
  subtotal,
  totalTax,
  totalDiscount,
  totalAmount,
}: CanvasElementRendererProps) {
  const isDark = properties.printTheme === 'dark';
  const defaultAccent = properties.accentColor || '#FF6B4A';

  const fontClass = (fontFamily?: 'sans' | 'serif' | 'mono') => {
    const f = fontFamily || properties.fontFamily;
    return f === 'mono' ? 'font-mono' : f === 'serif' ? 'font-serif' : 'font-sans';
  };

  const borderClass = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const cardBgClass = isDark ? 'bg-zinc-900/60' : 'bg-zinc-50/80';
  const textMutedClass = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const textMainClass = isDark ? 'text-zinc-100' : 'text-zinc-900';

  // ── 1. CUSTOM TEXT ELEMENT ──
  if (element.type === 'text') {
    return (
      <div
        className={`w-full h-full flex flex-col justify-center select-none overflow-hidden ${fontClass(
          element.fontFamily
        )}`}
        style={{
          fontSize: `${element.fontSize}px`,
          fontWeight: element.fontWeight,
          fontStyle: element.fontStyle,
          textAlign: element.textAlign,
          color: element.color,
          lineHeight: element.lineHeight || 1.3,
        }}
      >
        <span className="whitespace-pre-wrap break-words">{element.content || 'Text Box'}</span>
      </div>
    );
  }

  // ── 2. SHAPE ELEMENT ──
  if (element.type === 'shape') {
    let borderRadius = `${element.borderRadius || 0}px`;
    if (element.shapeType === 'circle') borderRadius = '9999px';
    if (element.shapeType === 'pill') borderRadius = '9999px';

    return (
      <div
        className="w-full h-full"
        style={{
          backgroundColor: element.fillColor,
          borderColor: element.borderColor,
          borderWidth: `${element.borderWidth || 0}px`,
          borderStyle: element.borderStyle || 'solid',
          borderRadius,
        }}
      />
    );
  }

  // ── 3. IMAGE ELEMENT ──
  if (element.type === 'image') {
    return (
      <div
        className="w-full h-full overflow-hidden flex items-center justify-center bg-zinc-500/10"
        style={{
          borderRadius: `${element.borderRadius || 0}px`,
          borderColor: element.borderColor,
          borderWidth: element.borderWidth ? `${element.borderWidth}px` : 0,
        }}
      >
        {element.imageUrl ? (
          <img
            src={element.imageUrl}
            alt="Canvas Element"
            className="w-full h-full"
            style={{ objectFit: element.objectFit || 'contain' }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="text-[10px] text-muted font-mono">Image Element</span>
        )}
      </div>
    );
  }

  // ── 4. DATA-BOUND: HEADER & BRANDING ──
  if (element.type === 'data-header') {
    const accent = element.customAccentColor || defaultAccent;
    const isExecutive = properties.templateId === 'executive_bold';

    return (
      <div
        className={`w-full h-full flex justify-between items-start select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <div className="flex items-start gap-3">
          {properties.logoUrl ? (
            <img
              src={properties.logoUrl}
              alt="Logo"
              className="max-h-14 max-w-32 object-contain rounded"
            />
          ) : (
            <span
              className="w-3.5 h-3.5 rounded mt-1.5 shrink-0 shadow-sm"
              style={{ backgroundColor: accent }}
            />
          )}

          <div>
            <h1 className={`text-2xl font-black tracking-tight ${isExecutive ? 'text-white' : textMainClass}`}>
              {seller.name || 'Skavelon Technologies'}
            </h1>
            <p className={`text-xs ${isExecutive ? 'text-white/80' : textMutedClass}`}>
              {seller.address || 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13'}
            </p>
            {seller.phone && (
              <p className={`text-[11px] ${isExecutive ? 'text-white/80' : textMutedClass}`}>
                Phone: {seller.phone}
              </p>
            )}
            {seller.email && (
              <p className={`text-[11px] ${isExecutive ? 'text-white/80' : textMutedClass}`}>
                Email: {seller.email}
              </p>
            )}
            {seller.gstNumber && (
              <p className={`text-[11px] font-mono mt-0.5 ${isExecutive ? 'text-white/90' : textMutedClass}`}>
                GSTIN: {seller.gstNumber}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <span
            className="text-[10px] font-mono uppercase tracking-widest font-bold px-2.5 py-0.5 rounded shadow-sm inline-block"
            style={{
              backgroundColor: isExecutive ? 'rgba(255,255,255,0.2)' : `${accent}20`,
              color: isExecutive ? '#ffffff' : accent,
            }}
          >
            TAX INVOICE
          </span>
          <span className={`text-base font-extrabold font-mono block mt-1 ${isExecutive ? 'text-white' : textMainClass}`}>
            {invoiceNumber}
          </span>
        </div>
      </div>
    );
  }

  // ── 5. DATA-BOUND: CLIENT CARD ──
  if (element.type === 'data-client') {
    const accent = element.customAccentColor || defaultAccent;

    return (
      <div
        className={`w-full h-full p-3.5 rounded-lg border ${borderClass} ${cardBgClass} flex flex-col justify-between select-none ${fontClass(
          element.customFontFamily
        )}`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div>
          <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-muted block mb-1">
            Billed To
          </span>
          <div className={`font-bold text-sm ${textMainClass}`}>
            {client?.companyName || client?.name || 'Selected Client Account'}
          </div>
          {client?.companyName && client?.name && (
            <div className={`text-xs ${textMutedClass}`}>{client.name}</div>
          )}
          {client?.email && <div className={`text-xs ${textMutedClass}`}>{client.email}</div>}
        </div>

        {client?.gstNumber && (
          <div className="font-mono text-[11px] font-bold" style={{ color: accent }}>
            Client GSTIN: {client.gstNumber}
          </div>
        )}
      </div>
    );
  }

  // ── 6. DATA-BOUND: DATES & REFERENCE CARD ──
  if (element.type === 'data-dates') {
    return (
      <div
        className={`w-full h-full p-3.5 rounded-lg border ${borderClass} ${cardBgClass} flex flex-col justify-between font-mono text-xs select-none ${fontClass(
          element.customFontFamily
        )}`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div className="flex justify-between items-center">
          <span className={textMutedClass}>Invoice Date:</span>
          <span className={`font-semibold ${textMainClass}`}>
            {new Date(issueDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className={textMutedClass}>Due Date:</span>
          <span className={`font-semibold ${textMainClass}`}>
            {new Date(dueDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className={textMutedClass}>Currency:</span>
          <span className={`font-bold ${textMainClass}`}>{currency}</span>
        </div>
        <div className={`flex justify-between items-center pt-1 border-t ${borderClass} text-[10px]`}>
          <span className={textMutedClass}>Place of Supply:</span>
          <span className={`font-semibold ${textMainClass}`}>
            State {client?.gstNumber ? client.gstNumber.slice(0, 2) : '27'}
          </span>
        </div>
      </div>
    );
  }

  // ── 7. DATA-BOUND: LINE ITEMS TABLE ──
  if (element.type === 'data-items-table') {
    return (
      <div
        className={`w-full h-full border rounded-lg overflow-hidden flex flex-col ${borderClass} select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <div
          className={`grid grid-cols-12 gap-2 px-3.5 py-2.5 text-[10px] font-mono uppercase font-bold tracking-wider border-b ${cardBgClass} ${borderClass}`}
        >
          <div className="col-span-6">Deliverable / Description</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-2 text-right">Rate</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-500/10">
          {items.map((it, idx) => {
            const lineAmount = it.quantity * it.rate - (it.discount || 0);
            return (
              <div
                key={it.id || idx}
                className="grid grid-cols-12 gap-2 px-3.5 py-2.5 text-xs items-center font-mono"
              >
                <div className="col-span-6 font-sans">
                  <span className={`font-medium block ${textMainClass}`}>
                    {it.description || 'Deliverable Service'}
                  </span>
                  {it.hsn_code && (
                    <span className="text-[10px] text-muted font-mono block">HSN: {it.hsn_code}</span>
                  )}
                </div>
                <div className={`col-span-2 text-right ${textMutedClass}`}>{it.quantity}</div>
                <div className={`col-span-2 text-right ${textMutedClass}`}>
                  {formatCurrency(it.rate, currency)}
                </div>
                <div className={`col-span-2 text-right font-bold ${textMainClass}`}>
                  {formatCurrency(lineAmount, currency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 8. DATA-BOUND: TOTALS & TAX ──
  if (element.type === 'data-totals') {
    const accent = element.customAccentColor || defaultAccent;
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;

    return (
      <div
        className={`w-full h-full p-4 rounded-lg border ${borderClass} ${cardBgClass} space-y-1.5 font-mono text-xs flex flex-col justify-between select-none ${fontClass(
          element.customFontFamily
        )}`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div className="space-y-1.5">
          <div className="flex justify-between text-muted">
            <span>Subtotal:</span>
            <span className={textMainClass}>{formatCurrency(subtotal, currency)}</span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-500">
              <span>Discount:</span>
              <span>-{formatCurrency(totalDiscount, currency)}</span>
            </div>
          )}

          {properties.showGstBreakdown && totalTax > 0 ? (
            <>
              <div className={`flex justify-between text-muted text-[11px] pt-1 border-t ${borderClass}`}>
                <span>CGST (9%):</span>
                <span>{formatCurrency(cgst, currency)}</span>
              </div>
              <div className="flex justify-between text-muted text-[11px]">
                <span>SGST (9%):</span>
                <span>{formatCurrency(sgst, currency)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-muted">
              <span>Tax Amount:</span>
              <span>{formatCurrency(totalTax, currency)}</span>
            </div>
          )}
        </div>

        <div
          className="flex justify-between pt-2 border-t font-bold text-sm"
          style={{ borderTopColor: accent }}
        >
          <span className={textMainClass}>Total Balance:</span>
          <span style={{ color: accent }}>{formatCurrency(totalAmount, currency)}</span>
        </div>
      </div>
    );
  }

  // ── 9. DATA-BOUND: REMITTANCE & BANK ──
  if (element.type === 'data-remittance') {
    const accent = element.customAccentColor || defaultAccent;

    return (
      <div
        className={`w-full h-full p-3.5 rounded-lg border ${borderClass} ${cardBgClass} font-mono text-[11px] flex flex-col justify-between select-none`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted block mb-1">
            Settlement & Remittance
          </span>
          <div className="space-y-0.5">
            <div>
              <span className={textMutedClass}>Bank: </span>
              <span className={`font-semibold ${textMainClass}`}>
                {properties.bankName || 'HDFC Bank'}
              </span>
            </div>
            <div>
              <span className={textMutedClass}>A/C: </span>
              <span className={`font-semibold ${textMainClass}`}>
                {properties.accountNumber || '99820019284102'}
              </span>
            </div>
            <div>
              <span className={textMutedClass}>IFSC: </span>
              <span className={`font-semibold ${textMainClass}`}>
                {properties.ifscCode || 'HDFC0001242'}
              </span>
            </div>
          </div>
        </div>

        {properties.upiId && (
          <div className="pt-1 border-t border-divider/50">
            <span className={textMutedClass}>UPI ID: </span>
            <span className="font-semibold" style={{ color: accent }}>
              {properties.upiId}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── 10. DATA-BOUND: NOTES & TERMS ──
  if (element.type === 'data-notes-terms') {
    return (
      <div
        className={`w-full h-full p-3 rounded-lg border ${borderClass} ${cardBgClass} flex flex-col justify-between text-[11px] select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <span className="font-bold text-muted uppercase font-mono text-[10px]">
          Notes & Payment Terms
        </span>
        <p className={`line-clamp-2 ${textMutedClass}`}>
          {properties.customNotes || 'Thank you for your business. Remit funds to designated account.'}
        </p>
        <p className="font-mono text-[10px] text-muted">
          Terms: {properties.paymentTerms || 'Net 15 Days'}
        </p>
      </div>
    );
  }

  // ── 11. DATA-BOUND: SIGNATURE LINE ──
  if (element.type === 'data-signature') {
    return (
      <div
        className={`w-full h-full flex flex-col justify-end items-end p-2 select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <div className={`w-40 border-b ${borderClass} mb-1`} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold">
          Authorized Signatory
        </span>
      </div>
    );
  }

  // ── 12. DATA-BOUND: BADGE / STAMP ──
  if (element.type === 'data-badge') {
    const accent = element.customAccentColor || defaultAccent;

    return (
      <div
        className="w-full h-full rounded-full flex items-center justify-center px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm select-none"
        style={{
          backgroundColor: `${accent}15`,
          color: accent,
          border: `1px solid ${accent}40`,
        }}
      >
        <span>ORIGINAL FOR RECIPIENT</span>
      </div>
    );
  }

  return <div className="w-full h-full border border-dashed border-zinc-500" />;
}
