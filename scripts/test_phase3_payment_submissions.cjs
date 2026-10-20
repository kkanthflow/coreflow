const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ws = require('ws');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rltygdzldplkmwuqfadm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzk1NSwiZXhwIjoyMDk2Nzc5OTU1fQ.zsR3c5QISHMSo9MgsaWCLVaeEBs5gZIlQ8eue4eF12o';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  }
);

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL.replace(/^"|"$/g, ''),
  ssl: { rejectUnauthorized: false }
});

const ts = Date.now();

// 1x1 Transparent PNG buffer with valid magic bytes
const validPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAAElFTkSuQmCC', 'base64');
const validPngBase64 = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

// Corrupted file (not valid PNG/PDF)
const corruptedBuffer = Buffer.from('FAKE-CORRUPTED-EXE-DATA-STREAM', 'utf8');
const corruptedBase64 = `data:image/png;base64,${corruptedBuffer.toString('base64')}`;

// Fake 6MB buffer (exceeds 5MB limit)
const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0x25); // Starts with %
const oversizedBase64 = `data:application/pdf;base64,${oversizedBuffer.toString('base64')}`;

async function runTests() {
  await pgClient.connect();

  console.log('================================================================');
  console.log('   AUVRYN PHASE 3: MANUAL PAYMENT SUBMISSION & LEDGER TESTS     ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  // ── Setup Test Data ──
  console.log('1. Setting up Business Owner, Organization, Clients & Invoices...');

  // 1a. Business Owner
  const { data: ownerAuth, error: ownerAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email: `phase3_owner_${ts}@auvryntest.com`,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Phase 3 Staff Owner', role: 'owner' }
  });
  if (ownerAuthErr) throw ownerAuthErr;
  const ownerId = ownerAuth.user.id;

  await pgClient.query(`
    INSERT INTO public.users (id, email, full_name, role)
    VALUES ($1, $2, 'Phase 3 Staff Owner', 'owner')
    ON CONFLICT (id) DO UPDATE SET role = 'owner';
  `, [ownerId, `phase3_owner_${ts}@auvryntest.com`]);

  // 1b. Organization
  const orgRes = await pgClient.query(`
    INSERT INTO public.organizations (name, owner_id, industry)
    VALUES ($1, $2, 'Fintech Innovations Corp')
    RETURNING id;
  `, [`Phase 3 Fintech ${ts}`, ownerId]);
  const orgId = orgRes.rows[0].id;

  await pgClient.query(`
    INSERT INTO public.user_organizations (user_id, org_id, role)
    VALUES ($1, $2, 'owner')
    ON CONFLICT DO NOTHING;
  `, [ownerId, orgId]);

  // 1c. Client User A
  const clientAEmail = `clientA_phase3_${ts}@clientportal.com`;
  const { data: clientAAuth, error: clientAErr } = await supabaseAdmin.auth.admin.createUser({
    email: clientAEmail,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Client Alpha Lead', role: 'client' }
  });
  if (clientAErr) throw clientAErr;
  const clientAUserId = clientAAuth.user.id;

  await pgClient.query(`
    INSERT INTO public.users (id, email, full_name, role)
    VALUES ($1, $2, 'Client Alpha Lead', 'client')
    ON CONFLICT (id) DO UPDATE SET role = 'client';
  `, [clientAUserId, clientAEmail]);

  // Client Record A
  const clientARes = await pgClient.query(`
    INSERT INTO public.clients (organization_id, owner_id, name, company_name, email, portal_status, user_id)
    VALUES ($1, $2, 'Alpha Lead', 'Alpha Tech Enterprises', $3, 'active', $4)
    RETURNING id;
  `, [orgId, ownerId, clientAEmail, clientAUserId]);
  const clientAId = clientARes.rows[0].id;

  // 1d. Create Invoice for Client A ($1,500 total, balance $1,500)
  const futureDue = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
  const invRes = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency
    ) VALUES ($1, $2, $3, $4, 'sent', 1500.00, 0.00, 1500.00, $5, 'USD')
    RETURNING id;
  `, [orgId, ownerId, clientAId, `INV-P3-${ts}`, futureDue]);
  const invoiceId = invRes.rows[0].id;

  // Client User B (for cross-client isolation test)
  const clientBEmail = `clientB_phase3_${ts}@clientportal.com`;
  const { data: clientBAuth, error: clientBErr } = await supabaseAdmin.auth.admin.createUser({
    email: clientBEmail,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Client Beta Lead', role: 'client' }
  });
  if (clientBErr) throw clientBErr;
  const clientBUserId = clientBAuth.user.id;

  await pgClient.query(`
    INSERT INTO public.users (id, email, full_name, role)
    VALUES ($1, $2, 'Client Beta Lead', 'client')
    ON CONFLICT (id) DO UPDATE SET role = 'client';
  `, [clientBUserId, clientBEmail]);

  console.log(`  Created Org: ${orgId}, Client A: ${clientAId}, Invoice: ${invoiceId}\n`);

  // Import backend service directly to test service logic & DB RPC
  const { PaymentSubmissionService } = require('../server/payments/payment-submission.service.ts');

  console.log('2. Executing Automated Test Scenarios...\n');

  // ── TEST 1: File Validation (Magic Bytes & Size Check) ──
  console.log('--- TEST 1: File Validation & Magic Bytes Integrity ---');
  const validMagic = PaymentSubmissionService.validateMagicBytes(validPngBuffer);
  assert(validMagic.valid && validMagic.mime === 'image/png', 'PNG magic bytes correctly identified');

  const pdfMagic = PaymentSubmissionService.validateMagicBytes(Buffer.from('%PDF-1.4 file data'));
  assert(pdfMagic.valid && pdfMagic.mime === 'application/pdf', 'PDF magic bytes correctly identified');

  const corruptedMagic = PaymentSubmissionService.validateMagicBytes(corruptedBuffer);
  assert(!corruptedMagic.valid, 'Corrupted buffer rejected by magic bytes inspection');

  // Submit oversized file > 5MB
  let oversizedRejected = false;
  try {
    await PaymentSubmissionService.submitProof(clientAUserId, {
      invoice_id: invoiceId,
      amount: 500,
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      transaction_reference: `UTR-SIZE-${ts}`,
      receipt_base64: oversizedBase64,
      filename: 'huge_receipt.pdf',
      mime_type: 'application/pdf'
    });
  } catch (err) {
    if (err.message?.includes('5 MB limit')) oversizedRejected = true;
  }
  assert(oversizedRejected, 'Oversized file (> 5 MB) is rejected with clear error message');

  // ── TEST 2: Client Submits Valid Proof ──
  console.log('\n--- TEST 2: Client Payment Proof Submission ---');
  const submissionRes = await PaymentSubmissionService.submitProof(clientAUserId, {
    invoice_id: invoiceId,
    amount: 600.00,
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    transaction_reference: `UTR-TXN-${ts}`,
    notes: 'Transferred from Chase checking account',
    receipt_base64: validPngBase64,
    filename: 'deposit_slip.png',
    mime_type: 'image/png'
  });

  assert(submissionRes.success, 'Payment proof successfully submitted');
  const submissionId = submissionRes.submission?.id;
  assert(submissionRes.submission?.status === 'pending', 'Submission status defaults to "pending"');
  assert(submissionRes.submission?.amount === 600, 'Claimed amount recorded accurately');

  // Verify non-destructive status: Invoice balance must NOT change upon submission
  const { data: invAfterSubmit } = await supabaseAdmin
    .from('invoices')
    .select('paid_amount, balance_due, status')
    .eq('id', invoiceId)
    .single();

  assert(
    Number(invAfterSubmit.paid_amount) === 0 && Number(invAfterSubmit.balance_due) === 1500,
    'Non-destructive: Invoice balance remains unchanged ($1500) while submission is pending'
  );
  assert(invAfterSubmit.status === 'sent', 'Invoice status remains "sent" (NOT marked paid)');

  // ── TEST 3: Duplicate Transaction Reference Prevention ──
  console.log('\n--- TEST 3: Duplicate Reference Shield ---');
  let dupRejected = false;
  try {
    await PaymentSubmissionService.submitProof(clientAUserId, {
      invoice_id: invoiceId,
      amount: 400.00,
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      transaction_reference: `UTR-TXN-${ts}`, // Exact duplicate
      receipt_base64: validPngBase64,
      filename: 'slip2.png',
      mime_type: 'image/png'
    });
  } catch (err) {
    if (err.message?.includes('already been submitted')) dupRejected = true;
  }
  assert(dupRejected, 'Duplicate transaction reference within same business is rejected');

  // ── TEST 4: RBAC & Permission Enforcement ──
  console.log('\n--- TEST 4: RBAC Security (Client Cannot Self-Confirm) ---');
  let clientConfirmRejected = false;
  try {
    // Client User A attempts to confirm their own payment submission
    await PaymentSubmissionService.confirmSubmission(clientAUserId, submissionId);
  } catch (err) {
    if (err.message?.includes('Forbidden') || err.message?.includes('Clients cannot confirm')) {
      clientConfirmRejected = true;
    }
  }
  assert(clientConfirmRejected, 'Client cannot self-confirm their payment submission (403 Forbidden)');

  // Cross-client submission isolation: Client B cannot view Client A's submission
  const clientBSubmissions = await PaymentSubmissionService.listSubmissions(clientBUserId);
  const clientBSubIds = (clientBSubmissions.submissions || []).map(s => s.id);
  assert(!clientBSubIds.includes(submissionId), 'Client B cannot view Client A payment submission');

  // ── TEST 5: Atomic Staff Confirmation (Ledger & Invoice Reconciliation) ──
  console.log('\n--- TEST 5: Atomic Staff Confirmation & Reconciliation ---');
  const confirmRes = await PaymentSubmissionService.confirmSubmission(ownerId, submissionId);

  assert(confirmRes.success, 'Staff confirmed payment submission successfully');
  const rpcResult = confirmRes.result;
  assert(Number(rpcResult.new_paid) === 600, `New paid amount is 600 (got: ${rpcResult.new_paid})`);
  assert(Number(rpcResult.new_balance) === 900, `New balance due is 900 (got: ${rpcResult.new_balance})`);
  assert(rpcResult.new_status === 'partially_paid', `Invoice status transitioned to 'partially_paid' (got: ${rpcResult.new_status})`);

  // Verify immutable row in invoice_payments table
  const { data: pmtRow } = await supabaseAdmin
    .from('invoice_payments')
    .select('id, amount, submission_id, confirmed_by, confirmed_at, receipt_url, transaction_reference')
    .eq('submission_id', submissionId)
    .single();

  assert(Boolean(pmtRow), 'Immutable payment record created in invoice_payments');
  assert(Number(pmtRow.amount) === 600, 'Ledger payment amount matches confirmed submission ($600)');
  assert(pmtRow.confirmed_by === ownerId, 'Confirmed_by staff ID stamped in ledger row');
  assert(Boolean(pmtRow.confirmed_at), 'Confirmed_at timestamp recorded in ledger row');
  assert(pmtRow.transaction_reference === `UTR-TXN-${ts}`, 'Transaction reference preserved in ledger');

  // Verify submission status updated to 'confirmed'
  const { data: subAfterConfirm } = await supabaseAdmin
    .from('payment_submissions')
    .select('status, verified_by, verified_at')
    .eq('id', submissionId)
    .single();

  assert(subAfterConfirm.status === 'confirmed', 'Payment submission status updated to "confirmed"');
  assert(subAfterConfirm.verified_by === ownerId, 'Verified_by stamped on submission row');

  // ── TEST 6: Staff Rejection Flow ──
  console.log('\n--- TEST 6: Staff Rejection Workflow ---');
  // Submit second payment proof to test rejection
  const sub2Res = await PaymentSubmissionService.submitProof(clientAUserId, {
    invoice_id: invoiceId,
    amount: 300.00,
    payment_method: 'upi',
    payment_date: new Date().toISOString().split('T')[0],
    transaction_reference: `UPI-REJECT-${ts}`,
    receipt_base64: validPngBase64,
    filename: 'upi_slip.png',
    mime_type: 'image/png'
  });
  const sub2Id = sub2Res.submission?.id;

  // Staff rejects sub2 with mandatory reason
  const rejectionReason = 'UTR not visible in corporate bank statement. Please verify with your bank.';
  const rejectRes = await PaymentSubmissionService.rejectSubmission(ownerId, sub2Id, rejectionReason);
  assert(rejectRes.success, 'Staff successfully rejected invalid payment proof');

  const { data: sub2AfterReject } = await supabaseAdmin
    .from('payment_submissions')
    .select('status, rejection_reason, verified_by')
    .eq('id', sub2Id)
    .single();

  assert(sub2AfterReject.status === 'rejected', 'Submission marked as "rejected"');
  assert(sub2AfterReject.rejection_reason === rejectionReason, 'Rejection reason stored for client display');

  // Verify invoice balance did NOT change upon rejection
  const { data: invAfterReject } = await supabaseAdmin
    .from('invoices')
    .select('paid_amount, balance_due, status')
    .eq('id', invoiceId)
    .single();

  assert(Number(invAfterReject.balance_due) === 900, 'Invoice balance remains unchanged at $900 after rejection');
  assert(Number(invAfterReject.paid_amount) === 600, 'Invoice paid amount remains $600');

  // ── TEST 7: Full Settlement (Reaching $0 Balance) ──
  console.log('\n--- TEST 7: Full Settlement ($0 Balance & Paid Status) ---');
  const subFinalRes = await PaymentSubmissionService.submitProof(clientAUserId, {
    invoice_id: invoiceId,
    amount: 900.00, // Exact remaining balance
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    transaction_reference: `UTR-FINAL-${ts}`,
    receipt_base64: validPngBase64,
    filename: 'final_slip.png',
    mime_type: 'image/png'
  });
  const subFinalId = subFinalRes.submission?.id;

  const confirmFinalRes = await PaymentSubmissionService.confirmSubmission(ownerId, subFinalId);
  assert(Number(confirmFinalRes.result.new_balance) === 0, 'New balance reaches 0 upon full settlement');
  assert(confirmFinalRes.result.new_status === 'paid', 'Invoice status transitioned to "paid"');

  // ── Clean Up Test Artifacts ──
  console.log('\n3. Cleaning up test data...');
  await pgClient.query('DELETE FROM public.invoice_payments WHERE invoice_id = $1', [invoiceId]);
  await pgClient.query('DELETE FROM public.payment_submissions WHERE invoice_id = $1', [invoiceId]);
  await pgClient.query('DELETE FROM public.invoices WHERE id = $1', [invoiceId]);
  await pgClient.query('DELETE FROM public.clients WHERE id = $1', [clientAId]);
  await pgClient.query('DELETE FROM public.user_organizations WHERE org_id = $1', [orgId]);
  await pgClient.query('DELETE FROM public.organizations WHERE id = $1', [orgId]);
  await pgClient.query('DELETE FROM public.users WHERE id = ANY($1)', [[ownerId, clientAUserId, clientBUserId]]);
  await supabaseAdmin.auth.admin.deleteUser(ownerId);
  await supabaseAdmin.auth.admin.deleteUser(clientAUserId);
  await supabaseAdmin.auth.admin.deleteUser(clientBUserId);

  await pgClient.end();

  console.log('\n================================================================');
  console.log(`PHASE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
