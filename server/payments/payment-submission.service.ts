import { supabaseAdmin } from '../_core/supabase';
import crypto from 'crypto';

export interface PaymentSubmissionPayload {
  invoice_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  transaction_reference?: string;
  notes?: string;
  receipt_base64?: string;
  receipt_url?: string;
  filename?: string;
  mime_type?: string;
}

export class PaymentSubmissionService {
  /**
   * Magic bytes header inspection to prevent spoofed file extensions
   */
  static validateMagicBytes(buf: Buffer): { valid: boolean; mime: string } {
    if (!buf || buf.length < 4) return { valid: false, mime: '' };

    // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
      return { valid: true, mime: 'application/pdf' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf.length >= 8 && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
    ) {
      return { valid: true, mime: 'image/png' };
    }

    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return { valid: true, mime: 'image/jpeg' };
    }

    // WEBP: 'RIFF' at 0 and 'WEBP' at 8
    if (
      buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return { valid: true, mime: 'image/webp' };
    }

    return { valid: false, mime: '' };
  }

  /**
   * Submit manual payment proof
   */
  static async submitProof(userId: string, payload: PaymentSubmissionPayload) {
    const {
      invoice_id,
      amount,
      payment_method,
      payment_date,
      transaction_reference,
      notes,
      receipt_base64,
      receipt_url: rawReceiptUrl,
      filename = 'receipt',
      mime_type
    } = payload;

    if (!invoice_id) throw new Error('Invoice ID is required');
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Settlement amount must be greater than zero');
    }

    if (!payment_method) throw new Error('Payment method is required');
    if (!payment_date) throw new Error('Payment date is required');

    // Bank transfer & UPI require reference / UTR
    if (['bank_transfer', 'upi'].includes(payment_method) && !transaction_reference?.trim()) {
      throw new Error(`Transaction reference / UTR is mandatory for ${payment_method === 'upi' ? 'UPI' : 'Bank Transfer'}`);
    }

    // 1. Fetch invoice
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .select('id, organization_id, owner_id, client_id, total_amount, paid_amount, balance_due, currency, status, is_deleted')
      .eq('id', invoice_id)
      .single();

    if (invErr || !invoice || invoice.is_deleted) {
      throw new Error('Invoice not found or no longer active');
    }

    if (['draft', 'cancelled'].includes(invoice.status)) {
      throw new Error('Payments cannot be submitted for draft or cancelled invoices');
    }

    const currentBal = Number(invoice.balance_due != null ? invoice.balance_due : Math.max(0, invoice.total_amount - (invoice.paid_amount || 0)));
    if (currentBal <= 0) {
      throw new Error('This invoice is already fully settled');
    }

    if (parsedAmount > currentBal + 0.01) {
      throw new Error(`Submitted amount (${parsedAmount}) cannot exceed balance due (${currentBal})`);
    }

    // 2. Validate client association or staff
    const { data: clientObj } = await supabaseAdmin
      .from('clients')
      .select('id, user_id, email, organization_id, owner_id')
      .eq('id', invoice.client_id)
      .single();

    if (!clientObj) {
      throw new Error('Associated client record not found');
    }

    // 3. Prevent duplicate active submission with identical transaction reference
    if (transaction_reference?.trim()) {
      const cleanRef = transaction_reference.trim().toLowerCase();
      let dupQuery = supabaseAdmin
        .from('payment_submissions')
        .select('id')
        .neq('status', 'rejected')
        .ilike('transaction_reference', cleanRef);

      if (invoice.organization_id) {
        dupQuery = dupQuery.eq('organization_id', invoice.organization_id);
      } else {
        dupQuery = dupQuery.eq('owner_id', invoice.owner_id);
      }

      const { data: duplicates } = await dupQuery;
      if (duplicates && duplicates.length > 0) {
        throw new Error(`Transaction reference "${transaction_reference}" has already been submitted for this business`);
      }
    }

    // 4. Handle receipt file
    let finalReceiptUrl = rawReceiptUrl || '';
    let storedFilename = filename;
    let detectedMime = mime_type || '';
    let fileSize = 0;

    if (receipt_base64) {
      // Decode base64 buffer
      const base64Data = receipt_base64.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      fileSize = fileBuffer.length;

      // 5 MB max
      const maxBytes = 5 * 1024 * 1024;
      if (fileSize > maxBytes) {
        throw new Error('Receipt file size exceeds maximum 5 MB limit');
      }

      // Inspect magic bytes
      const magicCheck = this.validateMagicBytes(fileBuffer);
      if (!magicCheck.valid) {
        throw new Error('Unsupported or corrupted receipt format. Accepted: JPG, PNG, WEBP, PDF');
      }
      detectedMime = magicCheck.mime;

      // Generate cryptographically unique safe path
      const ext = detectedMime === 'application/pdf' ? 'pdf' : detectedMime.split('/')[1] || 'bin';
      const safeUUID = crypto.randomUUID();
      const storagePath = `${invoice.id}/${safeUUID}.${ext}`;

      const { error: uploadErr } = await supabaseAdmin
        .storage
        .from('payment_receipts')
        .upload(storagePath, fileBuffer, {
          contentType: detectedMime,
          upsert: true
        });

      if (uploadErr) {
        console.error('[PaymentSubmission] Storage upload error:', uploadErr);
        throw new Error('Failed to save receipt file to storage');
      }

      finalReceiptUrl = storagePath;
      storedFilename = `${safeUUID}.${ext}`;
    }

    if (!finalReceiptUrl) {
      throw new Error('Receipt proof file is required');
    }

    // 5. Insert payment submission
    const { data: submission, error: subErr } = await supabaseAdmin
      .from('payment_submissions')
      .insert({
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        submitted_by: userId,
        organization_id: invoice.organization_id,
        owner_id: invoice.owner_id,
        amount: parsedAmount,
        currency: invoice.currency || 'USD',
        payment_method,
        payment_date,
        transaction_reference: transaction_reference?.trim() || null,
        notes: notes?.trim() || null,
        receipt_url: finalReceiptUrl,
        receipt_filename: storedFilename,
        receipt_mime: detectedMime,
        receipt_size_bytes: fileSize,
        status: 'pending'
      })
      .select()
      .single();

    if (subErr) {
      console.error('[PaymentSubmission] Insert error:', subErr);
      throw subErr;
    }

    return {
      success: true,
      submission,
      message: 'Payment proof submitted. Our team will verify and reconcile your invoice.'
    };
  }

  /**
   * List submissions for staff or client
   */
  static async listSubmissions(userId: string, orgId?: string, query?: { status?: string; invoice_id?: string }) {
    // Check if user is client
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    const isClient = userProfile?.role === 'client';

    let q = supabaseAdmin
      .from('payment_submissions')
      .select(`
        *,
        invoices:invoice_id (
          id, invoice_number, total_amount, paid_amount, balance_due, currency, status
        ),
        clients:client_id (
          id, name, company_name, email
        ),
        submitter:submitted_by (
          id, full_name, email
        ),
        verifier:verified_by (
          id, full_name, email
        )
      `)
      .order('created_at', { ascending: false });

    if (query?.status) {
      q = q.eq('status', query.status);
    }

    if (query?.invoice_id) {
      q = q.eq('invoice_id', query.invoice_id);
    }

    if (isClient) {
      // Find client IDs for this user
      const { data: userClients } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('user_id', userId);

      const clientIds = (userClients || []).map(c => c.id);
      if (clientIds.length > 0) {
        q = q.or(`submitted_by.eq.${userId},client_id.in.(${clientIds.join(',')})`);
      } else {
        q = q.eq('submitted_by', userId);
      }
    } else if (orgId) {
      q = q.eq('organization_id', orgId);
    } else {
      q = q.eq('owner_id', userId);
    }

    const { data, error } = await q;
    if (error) throw error;
    return { success: true, submissions: data || [] };
  }

  /**
   * Confirm submission atomically (Staff only)
   */
  static async confirmSubmission(staffId: string, submissionId: string) {
    if (!submissionId) throw new Error('Submission ID is required');

    // Check staff permissions
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', staffId)
      .single();

    if (userProfile?.role === 'client') {
      throw new Error('Forbidden: Clients cannot confirm their own payment submissions');
    }

    // Call atomic stored procedure
    const { data, error } = await supabaseAdmin.rpc('confirm_payment_submission', {
      p_submission_id: submissionId,
      p_staff_id: staffId
    });

    if (error) {
      console.error('[PaymentSubmission.confirmSubmission] RPC error:', error);
      throw new Error(error.message || 'Failed to confirm payment submission');
    }

    return {
      success: true,
      result: data
    };
  }

  /**
   * Reject submission with reason (Staff only)
   */
  static async rejectSubmission(staffId: string, submissionId: string, reason: string) {
    if (!submissionId) throw new Error('Submission ID is required');
    if (!reason || !reason.trim()) throw new Error('Rejection reason is mandatory');

    // Check staff permissions
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', staffId)
      .single();

    if (userProfile?.role === 'client') {
      throw new Error('Forbidden: Clients cannot reject payment submissions');
    }

    const { data, error } = await supabaseAdmin.rpc('reject_payment_submission', {
      p_submission_id: submissionId,
      p_staff_id: staffId,
      p_reason: reason.trim()
    });

    if (error) {
      console.error('[PaymentSubmission.rejectSubmission] RPC error:', error);
      throw new Error(error.message || 'Failed to reject payment submission');
    }

    return {
      success: true,
      result: data
    };
  }

  /**
   * Generate temporary signed URL for receipt view/download
   */
  static async getReceiptSignedUrl(userId: string, submissionId: string) {
    const { data: submission, error } = await supabaseAdmin
      .from('payment_submissions')
      .select('id, receipt_url, organization_id, owner_id, submitted_by, client_id')
      .eq('id', submissionId)
      .single();

    if (error || !submission) {
      throw new Error('Submission not found');
    }

    const rawPath = submission.receipt_url;
    if (!rawPath) throw new Error('Receipt file path missing');

    // Clean bucket prefix if present
    const cleanPath = rawPath.replace(/^payment_receipts\//, '');

    const { data: signedData, error: signErr } = await supabaseAdmin
      .storage
      .from('payment_receipts')
      .createSignedUrl(cleanPath, 3600); // 1 hour

    if (signErr || !signedData?.signedUrl) {
      console.error('[PaymentSubmission] Failed to create signed URL:', signErr);
      throw new Error('Failed to generate secure receipt access link');
    }

    return {
      success: true,
      signedUrl: signedData.signedUrl
    };
  }
}
