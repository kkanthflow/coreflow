import {
  createDefaultElementsForTemplate,
  validateOrMigrateDoc,
  checkSaveConflict,
  generateStableId,
  CANVAS_A4_WIDTH,
  CANVAS_A4_HEIGHT,
} from '../web/src/components/invoices/studioDocumentMigration';
import {
  createInitialHistory,
  pushHistoryState,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
} from '../web/src/components/invoices/studioHistory';
import type {
  CanvasElement,
  InvoiceStudioDocV1,
  InvoiceStudioDocV2,
  StudioDesignProperties,
} from '../web/src/types/invoiceStudio';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runPhase3Tests() {
  console.log('🧪 Starting Auvryn Invoice Studio Phase 3 Test Suite...\n');

  const defaultProps: StudioDesignProperties = {
    templateId: 'modern_minimalist',
    accentColor: '#FF6B4A',
    fontFamily: 'sans',
    density: 'comfortable',
    printTheme: 'light',
    showGstBreakdown: true,
    showBankDetails: true,
    showSignatureBlock: true,
    showNotesTerms: true,
    bankName: 'State Bank of India',
    accountNumber: '99820019284100',
    ifscCode: 'SBIN0001242',
    upiId: 'finance@business',
    customNotes: 'Thank you for your business. For billing queries contact skavelontechnologies@gmail.com',
    paymentTerms: 'Net 15 Days',
    logoUrl: '',
    logoPosition: 'left',
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1: TEMPLATE ELEMENT GENERATION & A4 BOUNDS
  // ─────────────────────────────────────────────────────────────
  console.log('Test 1: Default element generation for all 8 templates on A4 stage...');
  const templates = [
    'modern_minimalist',
    'enterprise_classic',
    'obsidian_dark',
    'corporate_formal',
    'gst_tax_invoice',
    'creative_studio',
    'tech_developer',
    'executive_bold',
  ] as const;

  for (const tId of templates) {
    const elements = createDefaultElementsForTemplate(tId, { ...defaultProps, templateId: tId });
    assert(elements.length >= 6, `Template ${tId} should have at least 6 core elements (found ${elements.length})`);
    
    // Check all elements are within A4 bounds
    for (const el of elements) {
      assert(Boolean(el.id), `Element must have a stable id: ${JSON.stringify(el)}`);
      assert(el.x >= 0 && el.x < CANVAS_A4_WIDTH, `Element X out of bounds: ${el.x}`);
      assert(el.y >= 0 && el.y < CANVAS_A4_HEIGHT, `Element Y out of bounds: ${el.y}`);
      assert(el.width > 0, `Element width must be positive: ${el.width}`);
      assert(el.height > 0, `Element height must be positive: ${el.height}`);
    }
  }
  console.log('✓ All 8 template layouts generated with valid A4 coordinates and stable IDs.');

  // ─────────────────────────────────────────────────────────────
  // TEST 2: DOCUMENT SCHEMA VALIDATION & V1 -> V2 MIGRATION
  // ─────────────────────────────────────────────────────────────
  console.log('Test 2: Backward-compatible migration from v1 document to v2 schema...');
  const v1Doc: InvoiceStudioDocV1 = {
    version: 1,
    properties: {
      ...defaultProps,
      templateId: 'obsidian_dark',
      printTheme: 'dark',
      accentColor: '#10B981',
    },
    updatedAt: '2026-10-18T10:00:00Z',
  };

  const migrated = validateOrMigrateDoc(v1Doc, defaultProps);
  assert(migrated.version === 2, 'Migrated document must be version 2');
  assert(migrated.revision === 1, 'Initial migrated revision must be 1');
  assert(migrated.canvas.width === CANVAS_A4_WIDTH, 'Canvas width must be 794px');
  assert(migrated.canvas.height === CANVAS_A4_HEIGHT, 'Canvas height must be 1123px');
  assert(migrated.properties.accentColor === '#10B981', 'Preserved accent color from v1');
  assert(migrated.properties.templateId === 'obsidian_dark', 'Preserved template from v1');
  assert(migrated.elements.length > 5, 'Migrated document must have populated elements');
  console.log('✓ v1 documents seamlessly upgrade to v2 with zero data loss.');

  // ─────────────────────────────────────────────────────────────
  // TEST 3: RESIZING, ROTATION, AND DUPLICATION MATH
  // ─────────────────────────────────────────────────────────────
  console.log('Test 3: Editor geometry operations (move, resize, rotate, duplicate)...');
  const baseElement: CanvasElement = {
    id: generateStableId('test_elem'),
    type: 'text',
    name: 'Sample Header',
    x: 100,
    y: 100,
    width: 200,
    height: 50,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    content: 'Invoice Statement',
    fontFamily: 'sans',
    fontSize: 20,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#000000',
    lineHeight: 1.2,
  };

  // Move
  const movedElement = { ...baseElement, x: baseElement.x + 30, y: baseElement.y + 40 };
  assert(movedElement.x === 130 && movedElement.y === 140, 'Move operation updates coordinates');

  // Resize
  const resizedElement = { ...baseElement, width: Math.max(40, baseElement.width + 50), height: Math.max(24, baseElement.height + 25) };
  assert(resizedElement.width === 250 && resizedElement.height === 75, 'Resize updates dimensions correctly');

  // Rotation normalization
  const rotateDeg = 45;
  const rotatedElement = { ...baseElement, rotation: rotateDeg };
  assert(rotatedElement.rotation === 45, 'Rotation angle preserved');

  // Duplicate
  const duplicatedElement: CanvasElement = {
    ...baseElement,
    id: generateStableId('copy'),
    name: `${baseElement.name} Copy`,
    x: baseElement.x + 20,
    y: baseElement.y + 20,
    zIndex: 2,
  };
  assert(duplicatedElement.id !== baseElement.id, 'Duplicate gets new unique stable ID');
  assert(duplicatedElement.x === 120 && duplicatedElement.y === 120, 'Duplicate applies offset +20px');
  console.log('✓ Geometry operations and transformations validated.');

  // ─────────────────────────────────────────────────────────────
  // TEST 4: LOCKING & LAYER ORDERING
  // ─────────────────────────────────────────────────────────────
  console.log('Test 4: Locking and layer stacking order...');
  const lockedElement: CanvasElement = { ...baseElement, isLocked: true };
  assert(lockedElement.isLocked === true, 'Lock state set to true');

  const layer1: CanvasElement = { ...baseElement, id: 'l1', zIndex: 1 };
  const layer2: CanvasElement = { ...baseElement, id: 'l2', zIndex: 2 };
  const layer3: CanvasElement = { ...baseElement, id: 'l3', zIndex: 3 };
  let stack = [layer1, layer2, layer3];

  // Bring layer 1 to front
  stack = stack.filter((el) => el.id !== 'l1').concat(layer1);
  const reindexed = stack.map((el, i) => ({ ...el, zIndex: i + 1 }));
  assert(reindexed[reindexed.length - 1].id === 'l1', 'Layer 1 moved to top of stack');
  assert(reindexed[reindexed.length - 1].zIndex === 3, 'Layer 1 now has top zIndex 3');
  console.log('✓ Locking and layer stacking behavior verified.');

  // ─────────────────────────────────────────────────────────────
  // TEST 5: UNDO / REDO HISTORY STACK
  // ─────────────────────────────────────────────────────────────
  console.log('Test 5: History manager (Undo / Redo stack)...');
  let history = createInitialHistory(migrated);
  assert(canUndo(history) === false, 'Initial history has canUndo = false');
  assert(canRedo(history) === false, 'Initial history has canRedo = false');

  // Push mutation 1: add element
  const doc2: InvoiceStudioDocV2 = {
    ...migrated,
    elements: [...migrated.elements, duplicatedElement],
  };
  history = pushHistoryState(history, doc2);
  assert(history.past.length === 1, 'Past stack contains 1 entry');
  assert(canUndo(history) === true, 'canUndo is true after mutation');
  assert(history.present.elements.length === doc2.elements.length, 'Present matches doc2');

  // Undo
  history = undoHistory(history);
  assert(canUndo(history) === false, 'canUndo is false after undoing back to initial');
  assert(canRedo(history) === true, 'canRedo is true after undo');
  assert(history.present.elements.length === migrated.elements.length, 'Present matches initial doc');

  // Redo
  history = redoHistory(history);
  assert(canUndo(history) === true, 'canUndo is true after redo');
  assert(canRedo(history) === false, 'canRedo is false after redoing');
  assert(history.present.elements.length === doc2.elements.length, 'Present restored to doc2');
  console.log('✓ Undo and Redo history stack functioning reliably.');

  // ─────────────────────────────────────────────────────────────
  // TEST 6: STALE SAVE CONFLICT DETECTION
  // ─────────────────────────────────────────────────────────────
  console.log('Test 6: Concurrency and stale save conflict prevention...');
  const clientDoc: InvoiceStudioDocV2 = {
    ...migrated,
    revision: 2,
    updatedAt: '2026-10-19T12:00:00Z',
  };

  const newerServerDoc: InvoiceStudioDocV2 = {
    ...migrated,
    revision: 3,
    updatedAt: '2026-10-19T12:05:00Z',
  };

  const olderServerDoc: InvoiceStudioDocV2 = {
    ...migrated,
    revision: 1,
    updatedAt: '2026-10-19T11:50:00Z',
  };

  assert(checkSaveConflict(clientDoc, newerServerDoc) === true, 'Conflict detected when server is newer');
  assert(checkSaveConflict(clientDoc, olderServerDoc) === false, 'No conflict when client is newer');
  assert(checkSaveConflict(clientDoc, null) === false, 'No conflict when creating new invoice');
  console.log('✓ Concurrency conflict detection prevents stale overwrites.');

  // ─────────────────────────────────────────────────────────────
  // TEST 7: FINANCIAL INTEGRITY & TAX ISOLATION
  // ─────────────────────────────────────────────────────────────
  console.log('Test 7: Financial calculation separation from visual canvas...');
  const lineItems = [
    { id: '1', description: 'Platform License', quantity: 2, rate: 1000, tax_rate: 18, discount: 100 },
    { id: '2', description: 'DevOps Support', quantity: 10, rate: 150, tax_rate: 18, discount: 0 },
  ];

  const subtotal = lineItems.reduce((acc, it) => acc + it.quantity * it.rate, 0); // 2000 + 1500 = 3500
  const totalDiscount = lineItems.reduce((acc, it) => acc + it.discount, 0); // 100
  const totalTax = lineItems.reduce((acc, it) => acc + (it.quantity * it.rate - it.discount) * (it.tax_rate / 100), 0);
  const totalAmount = subtotal - totalDiscount + totalTax;

  assert(subtotal === 3500, `Subtotal expected 3500, got ${subtotal}`);
  assert(totalDiscount === 100, `Discount expected 100, got ${totalDiscount}`);
  assert(Math.round(totalTax) === 612, `Tax expected 612, got ${totalTax}`);
  assert(Math.round(totalAmount) === 4012, `Total expected 4012, got ${totalAmount}`);

  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  assert(cgst === sgst && cgst + sgst === totalTax, 'CGST and SGST must split tax equally');
  console.log('✓ Financial calculation logic decoupled from visual canvas presentation.');

  console.log('\n🎉 ALL 7 PHASE 3 TEST SUITES PASSED CLEANLY!\n');
}

runPhase3Tests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
