import type {
  CanvasElement,
  InvoiceStudioDocV2,
  InvoiceTemplateId,
  StudioDesignProperties,
} from '../../types/invoiceStudio';

export const CANVAS_A4_WIDTH = 794;
export const CANVAS_A4_HEIGHT = 1123;

export function generateStableId(prefix: string = 'elem'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Generates an initial set of canvas elements for any of the 8 original templates.
 */
export function createDefaultElementsForTemplate(
  templateId: InvoiceTemplateId,
  properties: StudioDesignProperties
): CanvasElement[] {
  const accent = properties.accentColor || '#FF6B4A';

  const elements: CanvasElement[] = [];
  let z = 1;

  // 1. Accent Header Shape or Decorative Banner
  if (templateId === 'executive_bold' || templateId === 'bold_header_band') {
    elements.push({
      id: generateStableId('shape_header_banner'),
      type: 'shape',
      name: 'Executive Accent Banner',
      x: 0,
      y: 0,
      width: 794,
      height: 120,
      rotation: 0,
      zIndex: z++,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      shapeType: 'rectangle',
      fillColor: accent,
      borderColor: accent,
      borderWidth: 0,
      borderRadius: 0,
      borderStyle: 'solid',
    });
  } else if (templateId === 'sidebar_layout') {
    elements.push({
      id: generateStableId('shape_sidebar_band'),
      type: 'shape',
      name: 'Sidebar Accent Band',
      x: 0,
      y: 0,
      width: 200,
      height: 1123,
      rotation: 0,
      zIndex: z++,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      shapeType: 'rectangle',
      fillColor: accent,
      borderColor: accent,
      borderWidth: 0,
      borderRadius: 0,
      borderStyle: 'solid',
    });
  } else if (templateId === 'creative_studio') {
    elements.push({
      id: generateStableId('shape_creative_ribbon'),
      type: 'shape',
      name: 'Creative Accent Bar',
      x: 36,
      y: 36,
      width: 8,
      height: 100,
      rotation: 0,
      zIndex: z++,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      shapeType: 'rectangle',
      fillColor: accent,
      borderColor: accent,
      borderWidth: 0,
      borderRadius: 4,
      borderStyle: 'solid',
    });
  }

  // 2. Data Header (Seller / Company Branding & Invoice Title)
  elements.push({
    id: generateStableId('data_header'),
    type: 'data-header',
    name: 'Header & Organization',
    x: 48,
    y: 46,
    width: 698,
    height: 90,
    rotation: 0,
    zIndex: z++,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    customAccentColor: accent,
    customFontFamily: properties.fontFamily,
  });

  // 3. Client Account Box
  elements.push({
    id: generateStableId('data_client'),
    type: 'data-client',
    name: 'Client Details Card',
    x: 48,
    y: 156,
    width: 334,
    height: 126,
    rotation: 0,
    zIndex: z++,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    customAccentColor: accent,
    customFontFamily: properties.fontFamily,
    customBorderRadius: 8,
  });

  // 4. Dates & Metadata Box
  elements.push({
    id: generateStableId('data_dates'),
    type: 'data-dates',
    name: 'Dates & Reference Card',
    x: 412,
    y: 156,
    width: 334,
    height: 126,
    rotation: 0,
    zIndex: z++,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    customAccentColor: accent,
    customFontFamily: properties.fontFamily,
    customBorderRadius: 8,
  });

  // 5. Line Items Table Block
  elements.push({
    id: generateStableId('data_items_table'),
    type: 'data-items-table',
    name: 'Line Items Table',
    x: 48,
    y: 300,
    width: 698,
    height: 300,
    rotation: 0,
    zIndex: z++,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    customAccentColor: accent,
    customFontFamily: properties.fontFamily,
    showDividers: true,
  });

  // 6. Bank / Remittance Box (if enabled)
  if (properties.showBankDetails) {
    elements.push({
      id: generateStableId('data_remittance'),
      type: 'data-remittance',
      name: 'Settlement & Remittance',
      x: 48,
      y: 620,
      width: 380,
      height: 140,
      rotation: 0,
      zIndex: z++,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      customAccentColor: accent,
      customBorderRadius: 8,
    });
  }

  // 7. Totals & Tax Summary Box
  elements.push({
    id: generateStableId('data_totals'),
    type: 'data-totals',
    name: 'Financial Summary & Tax',
    x: 450,
    y: 620,
    width: 296,
    height: 160,
    rotation: 0,
    zIndex: z++,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    customAccentColor: accent,
    customFontFamily: properties.fontFamily,
    customBorderRadius: 8,
  });

  // 8. Custom Notes & Payment Terms
  if (properties.showNotesTerms) {
    elements.push({
      id: generateStableId('data_notes_terms'),
      type: 'data-notes-terms',
      name: 'Notes & Payment Terms',
      x: 48,
      y: 780,
      width: 380,
      height: 90,
      rotation: 0,
      zIndex: z++,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      customFontFamily: properties.fontFamily,
    });
  }

  // 9. Authorized Signature Box (if enabled)
  if (properties.showSignatureBlock) {
    elements.push({
      id: generateStableId('data_signature'),
      type: 'data-signature',
      name: 'Authorized Signatory',
      x: 490,
      y: 800,
      width: 256,
      height: 80,
      rotation: 0,
      zIndex: z++,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      customFontFamily: properties.fontFamily,
    });
  }

  // 10. GST Compliance Stamp / Verification Badge
  if (templateId === 'gst_tax_invoice' || properties.showGstBreakdown) {
    elements.push({
      id: generateStableId('data_badge'),
      type: 'data-badge',
      name: 'GST Tax Rule Badge',
      x: 560,
      y: 20,
      width: 186,
      height: 28,
      rotation: 0,
      zIndex: z++,
      opacity: 0.9,
      isLocked: false,
      isVisible: true,
      customAccentColor: accent,
    });
  }

  return elements;
}

/**
 * Validates any raw document or safely migrates v1 documents to v2 schema.
 */
export function validateOrMigrateDoc(
  rawDoc: any,
  defaultProperties: StudioDesignProperties
): InvoiceStudioDocV2 {
  const now = new Date().toISOString();

  // If no document exists, create default v2 document
  if (!rawDoc || typeof rawDoc !== 'object') {
    return {
      version: 2,
      revision: 1,
      canvas: {
        width: CANVAS_A4_WIDTH,
        height: CANVAS_A4_HEIGHT,
        backgroundColor: defaultProperties.printTheme === 'dark' ? '#090A0F' : '#ffffff',
        theme: defaultProperties.printTheme || 'light',
      },
      elements: createDefaultElementsForTemplate(defaultProperties.templateId, defaultProperties),
      properties: defaultProperties,
      updatedAt: now,
    };
  }

  // Backward compatibility: Migrate v1 to v2
  if (rawDoc.version === 1 || !rawDoc.elements) {
    const props = { ...defaultProperties, ...(rawDoc.properties || {}) };
    return {
      version: 2,
      revision: 1,
      canvas: {
        width: CANVAS_A4_WIDTH,
        height: CANVAS_A4_HEIGHT,
        backgroundColor: props.printTheme === 'dark' ? '#090A0F' : '#ffffff',
        theme: props.printTheme || 'light',
      },
      elements: createDefaultElementsForTemplate(props.templateId, props),
      properties: props,
      updatedAt: rawDoc.updatedAt || now,
    };
  }

  // Validate existing v2 document
  const validElements: CanvasElement[] = Array.isArray(rawDoc.elements)
    ? rawDoc.elements
        .filter((el: any) => el && typeof el === 'object' && el.type)
        .map((el: any, index: number) => ({
          ...el,
          id: el.id || generateStableId(`el_${index}`),
          x: typeof el.x === 'number' && !isNaN(el.x) ? Math.round(el.x) : 48,
          y: typeof el.y === 'number' && !isNaN(el.y) ? Math.round(el.y) : 48,
          width: typeof el.width === 'number' && el.width > 10 ? Math.round(el.width) : 200,
          height: typeof el.height === 'number' && el.height > 10 ? Math.round(el.height) : 60,
          rotation: typeof el.rotation === 'number' ? el.rotation : 0,
          zIndex: typeof el.zIndex === 'number' ? el.zIndex : index + 1,
          opacity: typeof el.opacity === 'number' ? Math.max(0, Math.min(1, el.opacity)) : 1,
          isLocked: Boolean(el.isLocked),
          isVisible: el.isVisible !== false,
        }))
    : createDefaultElementsForTemplate(defaultProperties.templateId, defaultProperties);

  return {
    version: 2,
    revision: typeof rawDoc.revision === 'number' ? rawDoc.revision : 1,
    canvas: {
      width: CANVAS_A4_WIDTH,
      height: CANVAS_A4_HEIGHT,
      backgroundColor:
        rawDoc.canvas?.backgroundColor ||
        (defaultProperties.printTheme === 'dark' ? '#090A0F' : '#ffffff'),
      theme: rawDoc.canvas?.theme || defaultProperties.printTheme || 'light',
    },
    elements: validElements,
    properties: { ...defaultProperties, ...(rawDoc.properties || {}) },
    updatedAt: rawDoc.updatedAt || now,
  };
}

/**
 * Checks for concurrent modification conflicts before saving.
 */
export function checkSaveConflict(
  clientDoc: InvoiceStudioDocV2,
  serverDoc: InvoiceStudioDocV2 | null
): boolean {
  if (!serverDoc) return false;
  if (serverDoc.revision > clientDoc.revision) {
    const serverTime = new Date(serverDoc.updatedAt).getTime();
    const clientTime = new Date(clientDoc.updatedAt).getTime();
    return serverTime > clientTime;
  }
  return false;
}
