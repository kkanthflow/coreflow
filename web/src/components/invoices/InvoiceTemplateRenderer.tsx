import { forwardRef } from 'react';
import type { StudioDesignProperties, StudioLineItem } from '../../types/invoiceStudio';
import { formatCurrency } from '../../lib/currency';
import { getPlaceOfSupplyDisplay, numberToWords } from './gstStateCodes';

export interface InvoiceTemplateRendererProps {
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

export const InvoiceTemplateRenderer = forwardRef<HTMLDivElement, InvoiceTemplateRendererProps>(
  (
    {
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
    },
    ref
  ) => {
    const isDark = properties.printTheme === 'dark';
    const accent = properties.accentColor || '#FF6B4A';
    const fontClass =
      properties.fontFamily === 'mono'
        ? 'font-mono'
        : properties.fontFamily === 'serif'
        ? 'font-serif'
        : 'font-sans';

    const bgClass = isDark ? 'bg-[#090A0F] text-zinc-100' : 'bg-white text-zinc-900';
    const subtextClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
    const borderClass = isDark ? 'border-zinc-800' : 'border-zinc-200';
    const tableHeaderBg = isDark ? 'bg-zinc-900/80' : 'bg-zinc-50';

    const cgst = totalTax / 2;
    const sgst = totalTax / 2;

    const logoHeight =
      typeof properties.logoSize === 'number'
        ? properties.logoSize
        : properties.logoSize === 'sm'
        ? 48
        : properties.logoSize === 'lg'
        ? 110
        : 72;

    const logoAlign = properties.logoPosition || 'left';
    const logoContainerClass =
      logoAlign === 'center'
        ? 'justify-center'
        : logoAlign === 'right'
        ? 'justify-end'
        : 'justify-start';

    const isQuotation = properties.templateId === 'quotation_estimate';
    const isProforma = properties.templateId === 'proforma_invoice';
    const isGstInvoice = properties.templateId === 'gst_tax_invoice';
    const isProfessional = properties.templateId === 'professional_services';
    const isSidebar = properties.templateId === 'sidebar_layout';
    const isThermal = properties.templateId === 'compact_retail';
    const isBoldHeader = properties.templateId === 'bold_header_band' || properties.templateId === 'executive_bold';

    const docBadgeTitle = isQuotation ? 'QUOTATION / ESTIMATE' : isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE';
    const dateDueLabel = isQuotation ? 'Valid Until:' : 'Due Date:';

    const hasValidClientGst =
      client?.gstNumber &&
      client.gstNumber.trim().toUpperCase() !== 'NIL' &&
      client.gstNumber.trim().length > 0;

    const hasBank = Boolean(properties.bankName?.trim());
    const hasAccount = Boolean(properties.accountNumber?.trim());
    const hasIfsc = Boolean(properties.ifscCode?.trim());
    const hasUpi = Boolean(properties.upiId?.trim());
    const hasAnyBankData = hasBank || hasAccount || hasIfsc || hasUpi;

    const placeOfSupplyText = getPlaceOfSupplyDisplay(client?.gstNumber, properties.placeOfSupply);

    return (
      <div
        ref={ref}
        id="invoice-studio-canvas"
        className={`w-full max-w-[800px] min-h-[1050px] shadow-2xl transition-all duration-200 select-text flex flex-col justify-between ${bgClass} ${fontClass} ${
          isSidebar ? 'p-0' : isThermal ? 'p-6 sm:p-8 max-w-[600px] mx-auto' : 'p-8 sm:p-12'
        }`}
        style={{
          boxSizing: 'border-box',
        }}
      >
        {/* If Sidebar Layout, render side-by-side flex */}
        <div className={isSidebar ? 'flex flex-1' : 'space-y-6'}>
          {isSidebar && (
            <div
              className="w-56 p-8 text-white flex flex-col justify-between shrink-0"
              style={{ backgroundColor: accent }}
            >
              <div className="space-y-6">
                {properties.logoUrl ? (
                  <img
                    src={properties.logoUrl}
                    alt="Brand Logo"
                    style={{ maxHeight: `${logoHeight}px`, objectFit: 'contain' }}
                    className="max-w-full drop-shadow-sm rounded bg-white/10 p-1"
                  />
                ) : null}

                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">{seller.name || 'Skavelon Technologies'}</h1>
                  <p className="text-xs text-white/80 mt-1">{seller.address || 'No. 9, Kamaraj St, Puducherry – 13'}</p>
                  {seller.phone && <p className="text-xs text-white/80 mt-0.5">{seller.phone}</p>}
                  {seller.email && <p className="text-xs text-white/80 mt-0.5">{seller.email}</p>}
                  {seller.gstNumber && <p className="text-xs font-mono font-bold text-white/90 mt-1">GSTIN: {seller.gstNumber}</p>}
                </div>

                {properties.showBankDetails && hasAnyBankData && (
                  <div className="pt-4 border-t border-white/20 text-xs font-mono space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/70 block">
                      Bank Settlement
                    </span>
                    {hasBank && <div><span className="text-white/70">Bank: </span>{properties.bankName}</div>}
                    {hasAccount && <div><span className="text-white/70">A/C: </span>{properties.accountNumber}</div>}
                    {hasIfsc && <div><span className="text-white/70">IFSC: </span>{properties.ifscCode}</div>}
                    {hasUpi && <div><span className="text-white/70">UPI: </span>{properties.upiId}</div>}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-white/20 text-[11px] text-white/70">
                Contact: skavelontechnologies@gmail.com
              </div>
            </div>
          )}

          <div className={isSidebar ? 'flex-1 p-8 space-y-6' : 'space-y-6'}>
            {/* ── HEADER VARIANTS ── */}
            {isBoldHeader ? (
              <div className="rounded-xl p-6 text-white mb-6 shadow-md" style={{ backgroundColor: accent }}>
                <div className="flex justify-between items-start">
                  <div className={`flex items-start gap-4 ${logoContainerClass}`}>
                    {properties.logoUrl ? (
                      <img
                        src={properties.logoUrl}
                        alt="Brand Logo"
                        style={{ height: `${logoHeight}px`, maxWidth: '200px', objectFit: 'contain' }}
                        className="rounded drop-shadow-sm bg-white/10 p-1"
                      />
                    ) : null}
                    <div>
                      <h1 className="text-2xl font-black tracking-tight">{seller.name || 'Skavelon Technologies'}</h1>
                      <p className="text-xs text-white/80 mt-1">{seller.address || 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13'}</p>
                      {seller.gstNumber && (
                        <p className="text-xs font-mono font-bold mt-1 text-white/90">GSTIN: {seller.gstNumber}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="text-xs tracking-widest uppercase bg-white/20 px-2.5 py-1 rounded text-white font-bold block mb-1">
                      {docBadgeTitle}
                    </span>
                    <span className="text-base font-extrabold">{invoiceNumber}</span>
                  </div>
                </div>
              </div>
            ) : isGstInvoice ? (
              <div className={`pb-4 border-b-2 text-center mb-6 ${borderClass}`} style={{ borderBottomColor: accent }}>
                {properties.logoUrl ? (
                  <div className={`flex ${logoContainerClass} mb-3`}>
                    <img
                      src={properties.logoUrl}
                      alt="Brand Logo"
                      style={{ height: `${logoHeight}px`, maxWidth: '220px', objectFit: 'contain' }}
                      className="rounded drop-shadow-xs"
                    />
                  </div>
                ) : null}
                <span className="text-xs font-mono tracking-widest uppercase font-bold text-muted block mb-1">
                  FORM GST INV-1 // TAX INVOICE
                </span>
                <h1 className="text-2xl font-bold tracking-tight">{seller.name || 'Skavelon Technologies'}</h1>
                <p className={`text-xs mt-0.5 ${subtextClass}`}>{seller.address || 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13'}</p>
                {seller.gstNumber && (
                  <p className="text-xs font-mono font-bold mt-1" style={{ color: accent }}>
                    GSTIN / UIN: {seller.gstNumber}
                  </p>
                )}
                <div className="mt-2 inline-block px-3 py-0.5 rounded font-mono text-xs font-bold border" style={{ borderColor: accent, color: accent }}>
                  {invoiceNumber}
                </div>
              </div>
            ) : !isSidebar ? (
              <div className={`flex flex-col sm:flex-row justify-between items-start pb-6 border-b ${borderClass}`}>
                <div className={`flex items-start gap-4 ${logoContainerClass}`}>
                  {properties.logoUrl ? (
                    <img
                      src={properties.logoUrl}
                      alt="Brand Logo"
                      style={{ height: `${logoHeight}px`, maxWidth: '220px', objectFit: 'contain' }}
                      className="rounded drop-shadow-xs"
                    />
                  ) : null}

                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">{seller.name || 'Skavelon Technologies'}</h1>
                    <p className={`text-xs mt-1 ${subtextClass}`}>{seller.address || 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13'}</p>
                    {seller.phone && <p className={`text-xs ${subtextClass}`}>Phone: {seller.phone}</p>}
                    {seller.email && <p className={`text-xs ${subtextClass}`}>Email: {seller.email}</p>}
                    {seller.gstNumber && (
                      <p className="text-xs font-mono font-bold mt-0.5">GSTIN: {seller.gstNumber}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 sm:mt-0 text-left sm:text-right shrink-0">
                  <span
                    className="text-xs font-mono uppercase tracking-widest font-bold px-2.5 py-1 rounded"
                    style={{
                      backgroundColor: `${accent}20`,
                      color: accent,
                    }}
                  >
                    {docBadgeTitle}
                  </span>
                  <span className="text-lg font-bold font-mono block mt-1.5">{invoiceNumber}</span>
                </div>
              </div>
            ) : (
              /* For sidebar layout, title bar at top of right column */
              <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-mono uppercase tracking-widest font-bold px-2.5 py-1 rounded" style={{ backgroundColor: `${accent}20`, color: accent }}>
                  {docBadgeTitle}
                </span>
                <span className="text-base font-bold font-mono">{invoiceNumber}</span>
              </div>
            )}

            {/* ── CLIENT & DATES METADATA SECTION ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              {/* Billed To - Real Case, NO UPPERCASE TRANSFORM */}
              <div className={`p-4 rounded-lg border ${borderClass} ${tableHeaderBg} space-y-1.5`}>
                <span className="text-xs font-mono uppercase font-bold tracking-wider text-muted block mb-1">
                  BILLED TO
                </span>
                <div className="font-bold text-sm">
                  {client?.companyName || client?.name || 'Selected Client Account'}
                </div>
                {client?.companyName && client?.name && (
                  <div className={`text-xs ${subtextClass}`}>{client.name}</div>
                )}
                {client?.email && <div className={`text-xs ${subtextClass}`}>{client.email}</div>}
                {client?.phone && <div className={`text-xs ${subtextClass}`}>{client.phone}</div>}
                {client?.address && <div className={`text-xs ${subtextClass}`}>{client.address}</div>}
                {/* GSTIN only rendered if present and not NIL */}
                {hasValidClientGst && (
                  <div className="font-mono text-xs font-bold pt-1 border-t border-divider/40" style={{ color: accent }}>
                    Client GSTIN: {client.gstNumber}
                  </div>
                )}
              </div>

              {/* Dates & Reference */}
              <div className={`p-4 rounded-lg border ${borderClass} ${tableHeaderBg} flex flex-col justify-between font-mono text-xs space-y-2`}>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium text-muted`}>Issue Date:</span>
                  <span className="font-semibold text-xs">{new Date(issueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium text-muted`}>{dateDueLabel}</span>
                  <span className="font-semibold text-xs">{new Date(dueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium text-muted`}>Currency:</span>
                  <span className="font-semibold text-xs">{currency}</span>
                </div>
                {/* Place of Supply full text */}
                <div className={`flex justify-between items-center pt-1.5 border-t border-divider/50`}>
                  <span className={`text-xs font-medium text-muted`}>Place of Supply:</span>
                  <span className="font-semibold text-xs">{placeOfSupplyText}</span>
                </div>
              </div>
            </div>

            {/* ── LINE ITEMS TABLE ── */}
            <div className={`border rounded-lg overflow-hidden ${borderClass}`}>
              <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-mono uppercase font-bold tracking-wider border-b ${tableHeaderBg} ${borderClass}`}>
                <div className={isGstInvoice ? 'col-span-5' : 'col-span-6'}>
                  DELIVERABLE / DESCRIPTION
                </div>
                {isGstInvoice && <div className="col-span-2 text-center">HSN/SAC</div>}
                <div className="col-span-2 text-right">{isProfessional ? 'Hours' : 'Qty'}</div>
                <div className={isGstInvoice ? 'col-span-1 text-right' : 'col-span-2 text-right'}>
                  {isProfessional ? 'Rate/Hr' : 'Rate'}
                </div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              <div className="divide-y divide-zinc-500/10">
                {items.map((it, idx) => {
                  const lineAmount = it.quantity * it.rate - (it.discount || 0);
                  return (
                    <div key={it.id || idx} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center font-mono">
                      <div className={isGstInvoice ? 'col-span-5 font-sans' : 'col-span-6 font-sans'}>
                        <div className="font-medium text-xs">{it.description || 'Deliverable Item'}</div>
                        {!isGstInvoice && it.hsn_code && (
                          <span className="text-[11px] font-mono text-muted block">HSN/SAC: {it.hsn_code}</span>
                        )}
                      </div>
                      {isGstInvoice && (
                        <div className={`col-span-2 text-center text-xs font-mono ${subtextClass}`}>
                          {it.hsn_code || '998314'}
                        </div>
                      )}
                      <div className="col-span-2 text-right text-xs text-muted">
                        {it.quantity} {isProfessional ? 'hrs' : ''}
                      </div>
                      <div className={isGstInvoice ? 'col-span-1 text-right text-xs text-muted' : 'col-span-2 text-right text-xs text-muted'}>
                        {formatCurrency(it.rate, currency)}
                      </div>
                      <div className="col-span-2 text-right font-bold text-xs">
                        {formatCurrency(lineAmount, currency)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TOTALS & GST BREAKDOWN ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
              {/* Left Box: Bank Details / Notes */}
              <div className="w-full sm:w-1/2 space-y-3 text-xs">
                {/* Bank remittance: Render only real entered values. If empty, hide lines */}
                {properties.showBankDetails && !isSidebar && hasAnyBankData && (
                  <div className={`p-3.5 rounded-lg border ${borderClass} ${tableHeaderBg} space-y-1 font-mono text-xs`}>
                    <span className="text-xs uppercase font-bold tracking-wider text-muted block mb-1.5">
                      SETTLEMENT & REMITTANCE
                    </span>
                    {hasBank && <div><span className="text-muted">Bank Name: </span><span className="font-semibold">{properties.bankName}</span></div>}
                    {hasAccount && <div><span className="text-muted">Account No: </span><span className="font-semibold">{properties.accountNumber}</span></div>}
                    {hasIfsc && <div><span className="text-muted">IFSC Code: </span><span className="font-semibold">{properties.ifscCode}</span></div>}
                    {hasUpi && <div><span className="text-muted">UPI ID: </span><span className="font-semibold text-emerald-500">{properties.upiId}</span></div>}
                  </div>
                )}

                {properties.showNotesTerms && (
                  <div className="text-xs text-muted space-y-1">
                    <p className="font-semibold text-zinc-300">Notes & Terms:</p>
                    <p>{properties.customNotes || 'Thank you for your business. Remit funds to designated account.'}</p>
                    <p className="font-mono text-[11px] text-muted">Terms: {properties.paymentTerms || 'Net 15 Days'}</p>
                  </div>
                )}
              </div>

              {/* Right Box: Calculation Breakdown */}
              <div className={`w-full sm:w-64 p-4 rounded-lg border ${borderClass} ${tableHeaderBg} space-y-2 font-mono text-xs`}>
                <div className="flex justify-between text-muted text-xs">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>

                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-500 text-xs">
                    <span>Discount:</span>
                    <span>-{formatCurrency(totalDiscount, currency)}</span>
                  </div>
                )}

                {(properties.showGstBreakdown || isGstInvoice) && totalTax > 0 ? (
                  <>
                    <div className="flex justify-between text-muted text-xs pt-1 border-t border-divider/50">
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

                <div
                  className="flex justify-between pt-2 border-t font-bold text-sm"
                  style={{ borderTopColor: accent }}
                >
                  <span>Total Due:</span>
                  <span style={{ color: accent }}>{formatCurrency(totalAmount, currency)}</span>
                </div>

                {isGstInvoice && (
                  <div className="pt-2 text-[11px] text-muted italic font-sans leading-tight border-t border-divider/40">
                    <strong>In Words:</strong> {numberToWords(totalAmount, currency)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER / SIGNATURE (CLEAN BRANDING) ── */}
        <div className={`pt-6 mt-8 border-t flex justify-between items-end text-xs text-muted ${borderClass} ${isSidebar ? 'px-8 pb-8' : ''}`}>
          <div>
            <span>Generated electronically · For billing queries contact skavelontechnologies@gmail.com</span>
          </div>
          {properties.showSignatureBlock && (
            <div className="text-right">
              <div className="w-40 border-b border-zinc-400 mb-1.5" />
              <span className="uppercase font-mono tracking-wider font-semibold text-xs">Authorized Signatory</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
