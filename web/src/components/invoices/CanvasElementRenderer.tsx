import type {
  CanvasElement,
  StudioDesignProperties,
  StudioLineItem,
} from '../../types/invoiceStudio';
import { formatCurrency } from '../../lib/currency';
import { getPlaceOfSupplyDisplay, numberToWords } from './gstStateCodes';

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

  // Compute numeric logo height
  const logoHeight =
    typeof properties.logoSize === 'number'
      ? properties.logoSize
      : properties.logoSize === 'sm'
      ? 48
      : properties.logoSize === 'lg'
      ? 110
      : 72;

  const isQuotation = properties.templateId === 'quotation_estimate';
  const isProforma = properties.templateId === 'proforma_invoice';
  const isGstInvoice = properties.templateId === 'gst_tax_invoice';
  const isProfessional = properties.templateId === 'professional_services';

  const docTitle = isQuotation ? 'QUOTATION / ESTIMATE' : isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE';
  const dateDueLabel = isQuotation ? 'Valid Until:' : 'Due Date:';

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
          <span className="text-xs text-muted font-mono">Image Element</span>
        )}
      </div>
    );
  }

  // ── 4. DATA-BOUND: HEADER & BRANDING ──
  if (element.type === 'data-header') {
    const accent = element.customAccentColor || defaultAccent;
    const isExecutive = properties.templateId === 'executive_bold' || properties.templateId === 'bold_header_band';

    // Logo alignment container styling
    const logoAlign = properties.logoPosition || 'left';
    const logoContainerClass =
      logoAlign === 'center'
        ? 'justify-center'
        : logoAlign === 'right'
        ? 'justify-end'
        : 'justify-start';

    return (
      <div
        className={`w-full h-full flex justify-between items-start select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <div className={`flex items-start gap-4 ${logoContainerClass}`}>
          {/* Brand Logo - No placeholder square if absent */}
          {properties.logoUrl ? (
            <img
              src={properties.logoUrl}
              alt="Brand Logo"
              style={{
                height: `${logoHeight}px`,
                maxWidth: '220px',
                objectFit: 'contain',
              }}
              className="rounded shrink-0 drop-shadow-xs"
            />
          ) : null}

          <div>
            <h1 className={`text-2xl font-black tracking-tight ${isExecutive ? 'text-white' : textMainClass}`}>
              {seller.name || 'Skavelon Technologies'}
            </h1>
            <p className={`text-xs mt-0.5 ${isExecutive ? 'text-white/80' : textMutedClass}`}>
              {seller.address || 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13'}
            </p>
            {seller.phone && (
              <p className={`text-xs ${isExecutive ? 'text-white/80' : textMutedClass}`}>
                Phone: {seller.phone}
              </p>
            )}
            {seller.email && (
              <p className={`text-xs ${isExecutive ? 'text-white/80' : textMutedClass}`}>
                Email: {seller.email}
              </p>
            )}
            {seller.gstNumber && (
              <p className={`text-xs font-mono font-bold mt-0.5 ${isExecutive ? 'text-white/90' : textMutedClass}`}>
                GSTIN: {seller.gstNumber}
              </p>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <span
            className="text-xs font-mono uppercase tracking-widest font-bold px-2.5 py-1 rounded shadow-xs inline-block"
            style={{
              backgroundColor: isExecutive ? 'rgba(255,255,255,0.2)' : `${accent}20`,
              color: isExecutive ? '#ffffff' : accent,
            }}
          >
            {docTitle}
          </span>
          <span className={`text-base font-extrabold font-mono block mt-1.5 ${isExecutive ? 'text-white' : textMainClass}`}>
            {invoiceNumber}
          </span>
        </div>
      </div>
    );
  }

  // ── 5. DATA-BOUND: CLIENT CARD ──
  if (element.type === 'data-client') {
    const accent = element.customAccentColor || defaultAccent;
    const hasValidGst =
      client?.gstNumber &&
      client.gstNumber.trim().toUpperCase() !== 'NIL' &&
      client.gstNumber.trim().length > 0;

    return (
      <div
        className={`w-full h-full p-4 rounded-lg border ${borderClass} ${cardBgClass} flex flex-col justify-between select-none ${fontClass(
          element.customFontFamily
        )}`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div>
          <span className="text-xs font-mono uppercase font-bold tracking-wider text-muted block mb-1.5">
            BILLED TO
          </span>
          {/* Real case for client name/company/email/address - NO UPPERCASE TRANSFORM */}
          <div className={`font-bold text-sm ${textMainClass}`}>
            {client?.companyName || client?.name || 'Selected Client Account'}
          </div>
          {client?.companyName && client?.name && (
            <div className={`text-xs mt-0.5 ${textMutedClass}`}>{client.name}</div>
          )}
          {client?.email && <div className={`text-xs mt-0.5 ${textMutedClass}`}>{client.email}</div>}
          {client?.address && <div className={`text-xs mt-0.5 ${textMutedClass}`}>{client.address}</div>}
        </div>

        {/* GSTIN only rendered if present and not NIL */}
        {hasValidGst && (
          <div className="font-mono text-xs font-bold pt-1.5 border-t border-divider/40" style={{ color: accent }}>
            Client GSTIN: {client.gstNumber}
          </div>
        )}
      </div>
    );
  }

  // ── 6. DATA-BOUND: DATES & REFERENCE CARD ──
  if (element.type === 'data-dates') {
    const placeOfSupplyText = getPlaceOfSupplyDisplay(client?.gstNumber, properties.placeOfSupply);

    return (
      <div
        className={`w-full h-full p-4 rounded-lg border ${borderClass} ${cardBgClass} flex flex-col justify-between font-mono text-xs select-none ${fontClass(
          element.customFontFamily
        )}`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div className="flex justify-between items-center">
          <span className={`text-xs font-medium ${textMutedClass}`}>Issue Date:</span>
          <span className={`font-semibold text-xs ${textMainClass}`}>
            {new Date(issueDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className={`text-xs font-medium ${textMutedClass}`}>{dateDueLabel}</span>
          <span className={`font-semibold text-xs ${textMainClass}`}>
            {new Date(dueDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className={`text-xs font-medium ${textMutedClass}`}>Currency:</span>
          <span className={`font-bold text-xs ${textMainClass}`}>{currency}</span>
        </div>
        {/* Place of supply full text - font size matches other rows */}
        <div className={`flex justify-between items-center pt-1.5 border-t ${borderClass}`}>
          <span className={`text-xs font-medium ${textMutedClass}`}>Place of Supply:</span>
          <span className={`font-semibold text-xs ${textMainClass}`}>
            {placeOfSupplyText}
          </span>
        </div>
      </div>
    );
  }

  // ── 7. DATA-BOUND: LINE ITEMS TABLE ──
  if (element.type === 'data-items-table') {
    const qtyColLabel = isProfessional ? 'Hours' : 'Qty';
    const rateColLabel = isProfessional ? 'Hourly Rate' : 'Rate';

    return (
      <div
        className={`w-full h-full border rounded-lg overflow-hidden flex flex-col ${borderClass} select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <div
          className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-mono uppercase font-bold tracking-wider border-b ${cardBgClass} ${borderClass}`}
        >
          <div className={isGstInvoice ? 'col-span-5' : 'col-span-6'}>
            DELIVERABLE / DESCRIPTION
          </div>
          {isGstInvoice && <div className="col-span-2 text-center">HSN/SAC</div>}
          <div className="col-span-2 text-right">{qtyColLabel}</div>
          <div className={isGstInvoice ? 'col-span-1 text-right' : 'col-span-2 text-right'}>{rateColLabel}</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-500/10">
          {items.map((it, idx) => {
            const lineAmount = it.quantity * it.rate - (it.discount || 0);
            return (
              <div
                key={it.id || idx}
                className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center font-mono"
              >
                <div className={isGstInvoice ? 'col-span-5 font-sans' : 'col-span-6 font-sans'}>
                  <span className={`font-medium block text-xs ${textMainClass}`}>
                    {it.description || 'Deliverable Service'}
                  </span>
                  {!isGstInvoice && it.hsn_code && (
                    <span className="text-[11px] text-muted font-mono block">HSN: {it.hsn_code}</span>
                  )}
                </div>
                {isGstInvoice && (
                  <div className={`col-span-2 text-center text-xs font-mono ${textMutedClass}`}>
                    {it.hsn_code || '998314'}
                  </div>
                )}
                <div className={`col-span-2 text-right text-xs ${textMutedClass}`}>
                  {it.quantity} {isProfessional ? 'hrs' : ''}
                </div>
                <div className={isGstInvoice ? `col-span-1 text-right text-xs ${textMutedClass}` : `col-span-2 text-right text-xs ${textMutedClass}`}>
                  {formatCurrency(it.rate, currency)}
                </div>
                <div className={`col-span-2 text-right font-bold text-xs ${textMainClass}`}>
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
    const showSplit = properties.showGstBreakdown || isGstInvoice;

    return (
      <div
        className={`w-full h-full p-4 rounded-lg border ${borderClass} ${cardBgClass} space-y-2 font-mono text-xs flex flex-col justify-between select-none ${fontClass(
          element.customFontFamily
        )}`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div className="space-y-1.5">
          <div className="flex justify-between text-muted text-xs">
            <span>Subtotal:</span>
            <span className={textMainClass}>{formatCurrency(subtotal, currency)}</span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-500 text-xs">
              <span>Discount:</span>
              <span>-{formatCurrency(totalDiscount, currency)}</span>
            </div>
          )}

          {showSplit && totalTax > 0 ? (
            <>
              <div className={`flex justify-between text-muted text-xs pt-1 border-t ${borderClass}`}>
                <span>CGST (9%):</span>
                <span>{formatCurrency(cgst, currency)}</span>
              </div>
              <div className="flex justify-between text-muted text-xs">
                <span>SGST (9%):</span>
                <span>{formatCurrency(sgst, currency)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-muted text-xs">
              <span>Tax Amount:</span>
              <span>{formatCurrency(totalTax, currency)}</span>
            </div>
          )}
        </div>

        <div>
          <div
            className="flex justify-between pt-2 border-t font-bold text-sm"
            style={{ borderTopColor: accent }}
          >
            <span className={textMainClass}>Total Balance:</span>
            <span style={{ color: accent }}>{formatCurrency(totalAmount, currency)}</span>
          </div>

          {/* Amount in words for compliance tax invoices */}
          {isGstInvoice && (
            <div className="pt-1.5 text-[11px] text-muted italic font-sans leading-tight">
              <strong>In Words:</strong> {numberToWords(totalAmount, currency)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 9. DATA-BOUND: REMITTANCE & BANK ──
  if (element.type === 'data-remittance') {
    const accent = element.customAccentColor || defaultAccent;
    const hasBank = Boolean(properties.bankName?.trim());
    const hasAccount = Boolean(properties.accountNumber?.trim());
    const hasIfsc = Boolean(properties.ifscCode?.trim());
    const hasUpi = Boolean(properties.upiId?.trim());
    const hasAnyBankData = hasBank || hasAccount || hasIfsc || hasUpi;

    return (
      <div
        className={`w-full h-full p-4 rounded-lg border ${borderClass} ${cardBgClass} font-mono text-xs flex flex-col justify-between select-none`}
        style={{ borderRadius: `${element.customBorderRadius || 8}px` }}
      >
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-muted block mb-2">
            SETTLEMENT & REMITTANCE
          </span>

          {!hasAnyBankData ? (
            <div className="py-2 px-2.5 rounded border border-dashed border-zinc-500/30 text-xs text-muted italic">
              Add bank details in the properties panel to display remittance info.
            </div>
          ) : (
            <div className="space-y-1">
              {hasBank && (
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${textMutedClass}`}>Bank:</span>
                  <span className={`font-semibold text-xs ${textMainClass}`}>{properties.bankName}</span>
                </div>
              )}
              {hasAccount && (
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${textMutedClass}`}>A/C:</span>
                  <span className={`font-semibold text-xs ${textMainClass}`}>{properties.accountNumber}</span>
                </div>
              )}
              {hasIfsc && (
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${textMutedClass}`}>IFSC:</span>
                  <span className={`font-semibold text-xs ${textMainClass}`}>{properties.ifscCode}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasUpi && (
          <div className="pt-2 border-t border-divider/50 flex items-center gap-1.5">
            <span className={`text-xs ${textMutedClass}`}>UPI ID:</span>
            <span className="font-semibold text-xs" style={{ color: accent }}>
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
        className={`w-full h-full p-3.5 rounded-lg border ${borderClass} ${cardBgClass} flex flex-col justify-between text-xs select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <span className="font-bold text-muted uppercase font-mono text-xs">
          NOTES & PAYMENT TERMS
        </span>
        <p className={`line-clamp-2 text-xs ${textMutedClass}`}>
          {properties.customNotes || 'Thank you for your business. Remit funds to designated account.'}
        </p>
        <p className="font-mono text-xs text-muted">
          Terms: {properties.paymentTerms || 'Net 15 Days'}
        </p>
      </div>
    );
  }

  // ── 11. DATA-BOUND: SIGNATURE LINE ──
  if (element.type === 'data-signature') {
    // If Authorized Signature Line toggle is unchecked, render nothing!
    if (!properties.showSignatureBlock) return null;

    return (
      <div
        className={`w-full h-full flex flex-col justify-end items-end p-2 select-none ${fontClass(
          element.customFontFamily
        )}`}
      >
        <div className={`w-44 border-b ${borderClass} mb-1.5`} />
        <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
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
        className="w-full h-full rounded-full flex items-center justify-center px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider shadow-xs select-none"
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
