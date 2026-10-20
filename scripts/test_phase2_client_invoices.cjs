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

// Pure derived status function (matching Invoices.tsx)
function deriveInvoiceStatus(inv) {
  if (inv.status === 'draft') return 'draft';
  if (inv.status === 'cancelled') return 'cancelled';

  const total = Number(inv.total_amount || 0);
  const paid = Number(inv.paid_amount || 0);
  const balance = Number(inv.balance_due != null ? inv.balance_due : Math.max(0, total - paid));

  if (balance <= 0 && total > 0) return 'paid';

  const isDuePassed = inv.due_date
    ? new Date(inv.due_date).setHours(23, 59, 59, 999) < Date.now()
    : false;

  if (isDuePassed) return 'overdue';
  if (paid > 0 && balance > 0) return 'partially_paid';

  return 'unpaid';
}

async function runTests() {
  await pgClient.connect();

  console.log('================================================================');
  console.log('   AUVRYN PHASE 2: CLIENT READ-ONLY "MY INVOICES" TEST SUITE    ');
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
  console.log('1. Setting up Test Users, Organization, Clients & Invoices...');

  // 1a. Business Owner
  const { data: ownerAuth, error: ownerAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email: `phase2_owner_${ts}@auvryntest.com`,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Phase 2 Business Owner', role: 'owner' }
  });
  if (ownerAuthErr) throw ownerAuthErr;
  const ownerId = ownerAuth.user.id;

  await pgClient.query(`
    INSERT INTO public.users (id, email, full_name, role)
    VALUES ($1, $2, 'Phase 2 Business Owner', 'owner')
    ON CONFLICT (id) DO UPDATE SET role = 'owner';
  `, [ownerId, `phase2_owner_${ts}@auvryntest.com`]);

  // 1b. Organization
  const orgRes = await pgClient.query(`
    INSERT INTO public.organizations (name, owner_id, industry, gst_number, address)
    VALUES ($1, $2, 'SaaS & Cloud Services', '27AABCU9603R1ZM', 'Cyber Towers, HITEC City, Hyderabad')
    RETURNING id;
  `, [`Phase 2 Apex Corp ${ts}`, ownerId]);
  const orgId = orgRes.rows[0].id;

  await pgClient.query(`
    INSERT INTO public.user_organizations (user_id, org_id, role)
    VALUES ($1, $2, 'owner')
    ON CONFLICT DO NOTHING;
  `, [ownerId, orgId]);

  // 1c. Client User A
  const clientAEmail = `clientA_${ts}@clientportal.com`;
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
    VALUES ($1, $2, 'Alpha Lead', 'Alpha Technologies Ltd', $3, 'active', $4)
    RETURNING id;
  `, [orgId, ownerId, clientAEmail, clientAUserId]);
  const clientAId = clientARes.rows[0].id;

  // 1d. Client User B
  const clientBEmail = `clientB_${ts}@clientportal.com`;
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

  // Client Record B
  const clientBRes = await pgClient.query(`
    INSERT INTO public.clients (organization_id, owner_id, name, company_name, email, portal_status, user_id)
    VALUES ($1, $2, 'Beta Lead', 'Beta Global Ventures', $3, 'active', $4)
    RETURNING id;
  `, [orgId, ownerId, clientBEmail, clientBUserId]);
  const clientBId = clientBRes.rows[0].id;

  console.log(`  Created Org: ${orgId}, Client A: ${clientAId}, Client B: ${clientBId}\n`);

  // 1e. Create Invoices for Client A:
  // Remittance metadata to test real saved payment instructions
  const remittanceDoc = {
    version: 1,
    properties: {
      templateId: 'modern_minimalist',
      accentColor: '#FF6B4A',
      bankName: 'HDFC Bank Ltd',
      accountNumber: '50200012345678',
      ifscCode: 'HDFC0001234',
      upiId: 'apexcorp@hdfcbank',
      paymentTerms: 'Due upon receipt within 15 days',
      customNotes: 'Thank you for choosing Apex Corp. For questions email accounts@apexcorp.io'
    }
  };

  const futureDue = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
  const pastDue = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];

  // Inv 1: Unpaid (Future due, balance = 1000)
  const inv1Res = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency, visual_recreation
    ) VALUES ($1, $2, $3, $4, 'sent', 1000.00, 0.00, 1000.00, $5, 'USD', $6)
    RETURNING id;
  `, [orgId, ownerId, clientAId, `INV-A1-${ts}`, futureDue, JSON.stringify(remittanceDoc)]);
  const inv1Id = inv1Res.rows[0].id;

  // Add line items to Inv 1
  await pgClient.query(`
    INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, amount)
    VALUES ($1, 'Cloud Architecture Consulting', 10, 100.00, 1000.00);
  `, [inv1Id]);

  // Inv 2: Partially Paid (Future due, paid = 400, balance = 600)
  const inv2Res = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency, visual_recreation
    ) VALUES ($1, $2, $3, $4, 'sent', 1000.00, 400.00, 600.00, $5, 'USD', $6)
    RETURNING id;
  `, [orgId, ownerId, clientAId, `INV-A2-${ts}`, futureDue, JSON.stringify(remittanceDoc)]);
  const inv2Id = inv2Res.rows[0].id;

  // Add payment record to Inv 2
  await pgClient.query(`
    INSERT INTO public.invoice_payments (invoice_id, amount, payment_method, transaction_reference, notes)
    VALUES ($1, 400.00, 'bank_transfer', 'WIRE-TX-99881', 'Partial milestone 1 payment');
  `, [inv2Id]);

  // Inv 3: Settled & Paid (paid = 1000, balance = 0)
  const inv3Res = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency, visual_recreation
    ) VALUES ($1, $2, $3, $4, 'paid', 1000.00, 1000.00, 0.00, $5, 'USD', $6)
    RETURNING id;
  `, [orgId, ownerId, clientAId, `INV-A3-${ts}`, futureDue, JSON.stringify(remittanceDoc)]);
  const inv3Id = inv3Res.rows[0].id;

  // Inv 4: Overdue (Past due date, paid = 0, balance = 1000)
  const inv4Res = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency, visual_recreation
    ) VALUES ($1, $2, $3, $4, 'sent', 1000.00, 0.00, 1000.00, $5, 'USD', $6)
    RETURNING id;
  `, [orgId, ownerId, clientAId, `INV-A4-${ts}`, pastDue, JSON.stringify(remittanceDoc)]);
  const inv4Id = inv4Res.rows[0].id;

  // Inv 5: Draft (MUST BE HIDDEN FROM CLIENT A)
  const inv5Res = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency, visual_recreation
    ) VALUES ($1, $2, $3, $4, 'draft', 5000.00, 0.00, 5000.00, $5, 'USD', $6)
    RETURNING id;
  `, [orgId, ownerId, clientAId, `INV-A5-DRAFT-${ts}`, futureDue, JSON.stringify(remittanceDoc)]);
  const inv5Id = inv5Res.rows[0].id;

  // Inv 6: Cancelled (MUST BE HIDDEN FROM CLIENT A)
  const inv6Res = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency, visual_recreation
    ) VALUES ($1, $2, $3, $4, 'cancelled', 3000.00, 0.00, 3000.00, $5, 'USD', $6)
    RETURNING id;
  `, [orgId, ownerId, clientAId, `INV-A6-CANCELLED-${ts}`, futureDue, JSON.stringify(remittanceDoc)]);
  const inv6Id = inv6Res.rows[0].id;

  // Inv 7: Client B Invoice (MUST BE HIDDEN FROM CLIENT A)
  const inv7Res = await pgClient.query(`
    INSERT INTO public.invoices (
      organization_id, owner_id, client_id, invoice_number, status,
      total_amount, paid_amount, balance_due, due_date, currency, visual_recreation
    ) VALUES ($1, $2, $3, $4, 'sent', 2500.00, 0.00, 2500.00, $5, 'USD', $6)
    RETURNING id;
  `, [orgId, ownerId, clientBId, `INV-B7-${ts}`, futureDue, JSON.stringify(remittanceDoc)]);
  const inv7Id = inv7Res.rows[0].id;

  // Create client session for Client A to test Supabase RLS
  const clientASupabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  });

  const { data: signInData, error: signInErr } = await clientASupabase.auth.signInWithPassword({
    email: clientAEmail,
    password: 'Password123!'
  });
  if (signInErr) throw signInErr;

  console.log('2. Executing Automated Test Scenarios...\n');

  // ── TEST 1: Tenant & Client Boundary Isolation ──
  console.log('--- TEST 1: Cross-Client Boundary Protection ---');
  const { data: clientAInvoices, error: listErr } = await clientASupabase
    .from('invoices')
    .select('id, invoice_number, client_id, status');

  assert(!listErr, 'Client A can successfully query invoices via Supabase RLS');
  const clientAInvoiceIds = (clientAInvoices || []).map(i => i.id);

  assert(
    !clientAInvoiceIds.includes(inv7Id),
    'Client A list query excludes Client B invoice (inv7Id)',
    `Returned IDs: ${clientAInvoiceIds}`
  );

  // Direct ID access (guessing / direct URL)
  const { data: directForeignInv } = await clientASupabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('id', inv7Id);

  assert(
    !directForeignInv || directForeignInv.length === 0,
    'Direct query for Client B invoice ID returns 0 rows (RLS blocks access)'
  );

  // ── TEST 2: Draft & Cancelled Protection (Strict Hiding) ──
  console.log('\n--- TEST 2: Draft & Cancelled Invoices Hidden from Clients ---');
  assert(
    !clientAInvoiceIds.includes(inv5Id),
    'Client A list excludes Draft invoice (inv5Id)'
  );
  assert(
    !clientAInvoiceIds.includes(inv6Id),
    'Client A list excludes Cancelled invoice (inv6Id)'
  );

  // Direct ID query for Draft invoice
  const { data: directDraftInv } = await clientASupabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('id', inv5Id);

  assert(
    !directDraftInv || directDraftInv.length === 0,
    'Client direct query for Draft invoice returns 0 rows (404/denied)'
  );

  // Direct ID query for Cancelled invoice
  const { data: directCancelledInv } = await clientASupabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('id', inv6Id);

  assert(
    !directCancelledInv || directCancelledInv.length === 0,
    'Client direct query for Cancelled invoice returns 0 rows (404/denied)'
  );

  // ── TEST 3: Derived Status Calculation Logic ──
  console.log('\n--- TEST 3: Derived Status Engine Evaluation ---');
  const status1 = deriveInvoiceStatus({ total_amount: 1000, paid_amount: 0, balance_due: 1000, due_date: futureDue, status: 'sent' });
  assert(status1 === 'unpaid', `Invoice 1 evaluates to 'unpaid' (got: ${status1})`);

  const status2 = deriveInvoiceStatus({ total_amount: 1000, paid_amount: 400, balance_due: 600, due_date: futureDue, status: 'sent' });
  assert(status2 === 'partially_paid', `Invoice 2 evaluates to 'partially_paid' (got: ${status2})`);

  const status3 = deriveInvoiceStatus({ total_amount: 1000, paid_amount: 1000, balance_due: 0, due_date: futureDue, status: 'sent' });
  assert(status3 === 'paid', `Invoice 3 evaluates to 'paid' when balance is 0 (got: ${status3})`);

  const status4 = deriveInvoiceStatus({ total_amount: 1000, paid_amount: 0, balance_due: 1000, due_date: pastDue, status: 'sent' });
  assert(status4 === 'overdue', `Invoice 4 evaluates to 'overdue' when due date passed (got: ${status4})`);

  // ── TEST 4: Sub-table RLS (Items & Payments) ──
  console.log('\n--- TEST 4: Invoice Items & Payments RLS ---');
  const { data: clientAItems, error: itemsErr } = await clientASupabase
    .from('invoice_items')
    .select('id, description, rate, amount')
    .eq('invoice_id', inv1Id);

  assert(!itemsErr && clientAItems?.length === 1, 'Client A can read line items for own visible invoice');
  assert(clientAItems?.[0]?.description === 'Cloud Architecture Consulting', 'Line item details match real data');

  const { data: clientAPayments, error: pmtsErr } = await clientASupabase
    .from('invoice_payments')
    .select('id, amount, payment_method, transaction_reference')
    .eq('invoice_id', inv2Id);

  assert(!pmtsErr && clientAPayments?.length === 1, 'Client A can read payment ledger records for own invoice');
  assert(clientAPayments?.[0]?.transaction_reference === 'WIRE-TX-99881', 'Payment reference matches recorded wire transaction');

  // Client A cannot read line items for Client B invoice
  const { data: clientBItems } = await clientASupabase
    .from('invoice_items')
    .select('id')
    .eq('invoice_id', inv7Id);

  assert(!clientBItems || clientBItems.length === 0, 'Client A cannot read line items for Client B invoice (0 rows returned)');

  // ── TEST 5: Saved Remittance Data Integrity (Zero Placeholders) ──
  console.log('\n--- TEST 5: Remittance / Payment Instructions Data Integrity ---');
  const { data: invDetail } = await clientASupabase
    .from('invoices')
    .select('id, invoice_number, visual_recreation')
    .eq('id', inv1Id)
    .single();

  const props = invDetail?.visual_recreation?.properties;
  assert(props?.bankName === 'HDFC Bank Ltd', `Remittance bank name preserved: ${props?.bankName}`);
  assert(props?.accountNumber === '50200012345678', `Remittance account number preserved: ${props?.accountNumber}`);
  assert(props?.ifscCode === 'HDFC0001234', `Remittance IFSC preserved: ${props?.ifscCode}`);
  assert(props?.upiId === 'apexcorp@hdfcbank', `Remittance UPI ID preserved: ${props?.upiId}`);
  assert(props?.paymentTerms?.includes('within 15 days'), 'Payment terms preserved without placeholders');

  // ── TEST 6: Business Owner Super-View (All Invoices Including Drafts) ──
  console.log('\n--- TEST 6: Business Owner Workspace Visibility ---');
  const ownerSupabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  });
  await ownerSupabase.auth.signInWithPassword({
    email: `phase2_owner_${ts}@auvryntest.com`,
    password: 'Password123!'
  });

  const { data: ownerInvoices } = await ownerSupabase
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('organization_id', orgId);

  const ownerInvIds = (ownerInvoices || []).map(i => i.id);
  assert(ownerInvIds.includes(inv5Id), 'Business Owner can view Draft invoices');
  assert(ownerInvIds.includes(inv6Id), 'Business Owner can view Cancelled invoices');
  assert(ownerInvIds.includes(inv7Id), 'Business Owner can view all client invoices across organization');

  // ── Clean Up Test Artifacts ──
  console.log('\n3. Cleaning up test data...');
  await pgClient.query('DELETE FROM public.invoice_payments WHERE invoice_id = ANY($1)', [[inv1Id, inv2Id, inv3Id, inv4Id, inv5Id, inv6Id, inv7Id]]);
  await pgClient.query('DELETE FROM public.invoice_items WHERE invoice_id = ANY($1)', [[inv1Id, inv2Id, inv3Id, inv4Id, inv5Id, inv6Id, inv7Id]]);
  await pgClient.query('DELETE FROM public.invoices WHERE id = ANY($1)', [[inv1Id, inv2Id, inv3Id, inv4Id, inv5Id, inv6Id, inv7Id]]);
  await pgClient.query('DELETE FROM public.clients WHERE id = ANY($1)', [[clientAId, clientBId]]);
  await pgClient.query('DELETE FROM public.user_organizations WHERE org_id = $1', [orgId]);
  await pgClient.query('DELETE FROM public.organizations WHERE id = $1', [orgId]);
  await pgClient.query('DELETE FROM public.users WHERE id = ANY($1)', [[ownerId, clientAUserId, clientBUserId]]);
  await supabaseAdmin.auth.admin.deleteUser(ownerId);
  await supabaseAdmin.auth.admin.deleteUser(clientAUserId);
  await supabaseAdmin.auth.admin.deleteUser(clientBUserId);

  await pgClient.end();

  console.log('\n================================================================');
  console.log(`PHASE 2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
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
