import { forwardRef } from 'react';
import type { StudioDesignProperties, StudioLineItem } from '../../types/invoiceStudio';
import { formatCurrency } from '../../lib/currency';

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

    return (
      <div
        ref={ref}
        id="auvryn-invoice-canvas"
        className={`w-full max-w-[800px] min-h-[1050px] p-8 sm:p-12 shadow-2xl transition-all duration-200 select-text flex flex-col justify-between ${bgClass} ${fontClass}`}
        style={{
          boxSizing: 'border-box',
        }}
      >
        <div className="space-y-6">
          {/* ── HEADER VARIANTS ── */}
          {properties.templateId === 'executive_bold' ? (
            <div className="rounded-xl p-6 text-white mb-6 shadow-md" style={{ backgroundColor: accent }}>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-wider">{seller.name || 'Skavelon Technologies'}</h1>
                  <p className="text-xs text-white/80 mt-1">Enterprise Billing & Performance Statement</p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] tracking-widest uppercase bg-white/20 px-2 py-0.5 rounded text-white font-bold block mb-1">
                    TAX INVOICE
                  </span>
                  <span className="text-base font-extrabold">{invoiceNumber}</span>
                </div>
              </div>
            </div>
          ) : properties.templateId === 'creative_studio' ? (
            <div className="border-l-4 pl-4 pb-2 mb-6" style={{ borderColor: accent }}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: accent }}>
                    Verified Creative Studio
                  </span>
                  <h1 className="text-3xl font-extrabold tracking-tight mt-0.5">{seller.name || 'Skavelon Technologies'}</h1>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold block">{invoiceNumber}</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-500/10 text-muted">
                    Billed in {currency}
                  </span>
                </div>
              </div>
            </div>
          ) : properties.templateId === 'tech_developer' ? (
            <div className={`p-4 rounded-lg border font-mono text-xs mb-6 ${tableHeaderBg} ${borderClass}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
                  <span className="font-bold tracking-wider">{seller.name || 'Skavelon Technologies'}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    SYS_OK // 200
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted">ID: </span>
                  <span className="font-bold" style={{ color: accent }}>{invoiceNumber}</span>
                </div>
              </div>
            </div>
          ) : properties.templateId === 'gst_tax_invoice' ? (
            <div className={`pb-4 border-b-2 text-center mb-6 ${borderClass}`} style={{ borderBottomColor: accent }}>
              <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-muted block mb-1">
                FORM GST INV-1 // TAX INVOICE
              </span>
              <h1 className="text-2xl font-bold tracking-tight">{seller.name || 'Skavelon Technologies'}</h1>
              {seller.gstNumber && (
                <p className="text-xs font-mono font-bold mt-1" style={{ color: accent }}>
                  GSTIN / UIN: {seller.gstNumber}
                </p>
              )}
            </div>
          ) : (
            <div className={`flex flex-col sm:flex-row justify-between items-start pb-6 border-b ${borderClass}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: accent }} />
                  <h1 className="text-xl font-bold tracking-tight">{seller.name || 'Skavelon Technologies'}</h1>
                </div>
                <p className={`text-xs ${subtextClass}`}>{seller.address || 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13'}</p>
                {seller.gstNumber && (
                  <p className="text-[11px] font-mono mt-0.5">GSTIN: {seller.gstNumber}</p>
                )}
              </div>
              <div className="mt-4 sm:mt-0 text-left sm:text-right">
                <span
                  className="text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${accent}20`,
                    color: accent,
                  }}
                >
                  INVOICE
                </span>
                <span className="text-lg font-bold font-mono block mt-1">{invoiceNumber}</span>
              </div>
            </div>
          )}

          {/* ── CLIENT & DATES METADATA SECTION ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            {/* Bill To */}
            <div className={`p-4 rounded-lg border ${borderClass} ${tableHeaderBg} space-y-1`}>
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-muted block mb-1">
                Billed To
              </span>
              <div className="font-bold text-sm">
                {client?.companyName || client?.name || 'Selected Client Account'}
              </div>
              {client?.companyName && client?.name && (
                <div className={subtextClass}>{client.name}</div>
              )}
              {client?.email && <div className={subtextClass}>{client.email}</div>}
              {client?.phone && <div className={subtextClass}>{client.phone}</div>}
              {client?.address && <div className={subtextClass}>{client.address}</div>}
              {client?.gstNumber && (
                <div className="font-mono text-[11px] font-bold mt-1" style={{ color: accent }}>
                  Client GSTIN: {client.gstNumber}
                </div>
              )}
            </div>

            {/* Dates & Reference */}
            <div className={`p-4 rounded-lg border ${borderClass} ${tableHeaderBg} flex flex-col justify-between font-mono text-xs space-y-2`}>
              <div className="flex justify-between">
                <span className="text-muted">Issue Date:</span>
                <span className="font-semibold">{new Date(issueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Due Date:</span>
                <span className="font-semibold">{new Date(dueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Currency:</span>
                <span className="font-semibold">{currency}</span>
              </div>
              {properties.templateId === 'gst_tax_invoice' && (
                <div className="flex justify-between pt-1 border-t border-divider/50 text-[11px]">
                  <span className="text-muted">Place of Supply:</span>
                  <span className="font-semibold">State Code {client?.gstNumber ? client.gstNumber.slice(0, 2) : '27'}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── LINE ITEMS TABLE ── */}
          <div className={`border rounded-lg overflow-hidden ${borderClass}`}>
            <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-mono uppercase font-bold tracking-wider border-b ${tableHeaderBg} ${borderClass}`}>
              <div className="col-span-6">Description / Deliverable</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            <div className="divide-y divide-zinc-500/10">
              {items.map((it, idx) => {
                const lineAmount = it.quantity * it.rate - (it.discount || 0);
                return (
                  <div key={it.id || idx} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center font-mono">
                    <div className="col-span-6 font-sans">
                      <div className="font-medium">{it.description || 'Deliverable Item'}</div>
                      {it.hsn_code && (
                        <span className="text-[10px] font-mono text-muted block">HSN/SAC: {it.hsn_code}</span>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-muted">{it.quantity}</div>
                    <div className="col-span-2 text-right text-muted">{formatCurrency(it.rate, currency)}</div>
                    <div className="col-span-2 text-right font-bold">
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
              {properties.showBankDetails && (
                <div className={`p-3.5 rounded-lg border ${borderClass} ${tableHeaderBg} space-y-1 font-mono text-[11px]`}>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted block mb-1">
                    Settlement & Remittance
                  </span>
                  <div><span className="text-muted">Bank Name: </span><span className="font-semibold">{properties.bankName || 'HDFC Bank'}</span></div>
                  <div><span className="text-muted">Account No: </span><span className="font-semibold">{properties.accountNumber || '99820019284102'}</span></div>
                  <div><span className="text-muted">IFSC Code: </span><span className="font-semibold">{properties.ifscCode || 'HDFC0001242'}</span></div>
                  {properties.upiId && (
                    <div><span className="text-muted">UPI ID: </span><span className="font-semibold text-emerald-500">{properties.upiId}</span></div>
                  )}
                </div>
              )}

              {properties.showNotesTerms && (
                <div className="text-[11px] text-muted space-y-1">
                  <p className="font-semibold text-zinc-300">Notes & Terms:</p>
                  <p>{properties.customNotes || 'Payment due within 15 days of invoice date.'}</p>
                </div>
              )}
            </div>

            {/* Right Box: Calculation Breakdown */}
            <div className={`w-full sm:w-64 p-4 rounded-lg border ${borderClass} ${tableHeaderBg} space-y-2 font-mono text-xs`}>
              <div className="flex justify-between text-muted">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-500">
                  <span>Discount:</span>
                  <span>-{formatCurrency(totalDiscount, currency)}</span>
                </div>
              )}

              {properties.showGstBreakdown && totalTax > 0 ? (
                <>
                  <div className="flex justify-between text-muted text-[11px] pt-1 border-t border-divider/50">
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

              <div
                className="flex justify-between pt-2 border-t font-bold text-sm"
                style={{ borderTopColor: accent }}
              >
                <span>Total Due:</span>
                <span style={{ color: accent }}>{formatCurrency(totalAmount, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER / SIGNATURE ── */}
        <div className={`pt-6 mt-8 border-t flex justify-between items-end text-[10px] text-muted ${borderClass}`}>
          <div>
            <span>Generated electronically via Auvryn OS · Immutable audit ref.</span>
          </div>
          {properties.showSignatureBlock && (
            <div className="text-right">
              <div className="w-32 border-b border-zinc-400 mb-1" />
              <span className="uppercase font-mono tracking-wider font-semibold">Authorized Signatory</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
