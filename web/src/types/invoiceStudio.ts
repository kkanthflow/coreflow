export type InvoiceTemplateId =
  | 'modern_minimalist'
  | 'enterprise_classic'
  | 'obsidian_dark'
  | 'corporate_formal'
  | 'gst_tax_invoice'
  | 'creative_studio'
  | 'tech_developer'
  | 'executive_bold';

export interface TemplateDefinition {
  id: InvoiceTemplateId;
  name: string;
  category: 'Modern' | 'Corporate' | 'Compliance' | 'Creative' | 'Tech';
  description: string;
  thumbnailColor: string;
  badge?: string;
  defaultAccent: string;
  defaultFont: 'sans' | 'serif' | 'mono';
  defaultPrintTheme: 'light' | 'dark';
}

export interface StudioLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  tax_rate: number;
  discount: number;
  hsn_code?: string;
}

export interface StudioDesignProperties {
  templateId: InvoiceTemplateId;
  accentColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  density: 'compact' | 'comfortable' | 'spacious';
  printTheme: 'light' | 'dark';
  showGstBreakdown: boolean;
  showBankDetails: boolean;
  showSignatureBlock: boolean;
  showNotesTerms: boolean;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  customNotes: string;
  paymentTerms: string;
  logoUrl?: string;
  logoPosition: 'left' | 'center' | 'right';
}

export interface InvoiceStudioDocV1 {
  version: 1;
  properties: StudioDesignProperties;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// PHASE 3: INTERACTIVE CANVAS ELEMENT SYSTEM & V2 DOCUMENT
// ─────────────────────────────────────────────────────────────

export type CanvasElementType =
  | 'text'
  | 'shape'
  | 'image'
  | 'data-header'
  | 'data-client'
  | 'data-dates'
  | 'data-items-table'
  | 'data-totals'
  | 'data-remittance'
  | 'data-signature'
  | 'data-notes-terms'
  | 'data-badge';

export interface CanvasElementBase {
  id: string; // Stable UUID/identifier
  type: CanvasElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // In degrees (-180 to 180 or 0 to 360)
  zIndex: number;
  opacity: number; // 0 to 1
  isLocked: boolean;
  isVisible: boolean;
}

export interface TextCanvasElement extends CanvasElementBase {
  type: 'text';
  content: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  fontSize: number;
  fontWeight: 'normal' | '500' | '600' | 'bold' | '800';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  lineHeight: number;
}

export interface ShapeCanvasElement extends CanvasElementBase {
  type: 'shape';
  shapeType: 'rectangle' | 'rounded-rect' | 'circle' | 'line' | 'pill';
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  borderStyle: 'solid' | 'dashed' | 'dotted';
}

export interface ImageCanvasElement extends CanvasElementBase {
  type: 'image';
  imageUrl: string;
  objectFit: 'contain' | 'cover' | 'fill';
  borderRadius: number;
  borderColor?: string;
  borderWidth?: number;
}

export interface DataBoundCanvasElement extends CanvasElementBase {
  type:
    | 'data-header'
    | 'data-client'
    | 'data-dates'
    | 'data-items-table'
    | 'data-totals'
    | 'data-remittance'
    | 'data-signature'
    | 'data-notes-terms'
    | 'data-badge';
  // Optional custom styling overrides
  customAccentColor?: string;
  customFontSize?: number;
  customFontFamily?: 'sans' | 'serif' | 'mono';
  customBorderRadius?: number;
  customBorderColor?: string;
  customBgColor?: string;
  showDividers?: boolean;
}

export type CanvasElement =
  | TextCanvasElement
  | ShapeCanvasElement
  | ImageCanvasElement
  | DataBoundCanvasElement;

export interface CanvasDimensions {
  width: number; // A4 Standard: 794px at 96 DPI
  height: number; // A4 Standard: 1123px at 96 DPI
  backgroundColor: string;
  theme: 'light' | 'dark';
}

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export interface InvoiceStudioDocV2 {
  version: 2;
  revision: number;
  canvas: CanvasDimensions;
  elements: CanvasElement[];
  properties: StudioDesignProperties;
  updatedAt: string;
}

export type AnyInvoiceStudioDoc = InvoiceStudioDocV1 | InvoiceStudioDocV2;

export interface StudioSaveState {
  status: 'saved' | 'saving' | 'dirty' | 'conflict';
  lastSavedAt: string | null;
  serverRevision?: number;
  conflictError?: string | null;
}
