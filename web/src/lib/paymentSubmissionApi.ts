import { supabase } from './supabase';

const API_BASE = '/api/payment-submissions';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('User is not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export interface PaymentSubmission {
  id: string;
  invoice_id: string;
  client_id: string;
  submitted_by: string;
  organization_id?: string;
  owner_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  transaction_reference?: string;
  notes?: string;
  receipt_url: string;
  receipt_filename?: string;
  receipt_mime?: string;
  receipt_size_bytes?: number;
  status: 'pending' | 'confirmed' | 'rejected';
  rejection_reason?: string;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
  invoices?: {
    id: string;
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    balance_due: number;
    currency: string;
    status: string;
  };
  clients?: {
    id: string;
    name: string;
    company_name: string;
    email?: string;
  };
  submitter?: {
    id: string;
    full_name?: string;
    email?: string;
  };
  verifier?: {
    id: string;
    full_name?: string;
    email?: string;
  };
}

export const paymentSubmissionApi = {
  /**
   * Submit manual payment proof
   */
  async submitProof(payload: {
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
  }): Promise<{ success: boolean; submission: PaymentSubmission; message: string }> {
    const headers = await getAuthHeader();
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit payment proof');
    }
    return data;
  },

  /**
   * List payment submissions
   */
  async listSubmissions(params?: {
    status?: string;
    invoice_id?: string;
    orgId?: string;
  }): Promise<PaymentSubmission[]> {
    const headers = await getAuthHeader();
    if (params?.orgId) {
      (headers as any)['x-organization-id'] = params.orgId;
    }

    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.append('status', params.status);
    if (params?.invoice_id) query.append('invoice_id', params.invoice_id);

    const url = `${API_BASE}${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, { method: 'GET', headers });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch payment submissions');
    }
    return data.submissions || [];
  },

  /**
   * Confirm submission (Staff only)
   */
  async confirmSubmission(id: string): Promise<any> {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/${id}/confirm`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to confirm payment submission');
    }
    return data;
  },

  /**
   * Reject submission with reason (Staff only)
   */
  async rejectSubmission(id: string, reason: string): Promise<any> {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/${id}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reject payment submission');
    }
    return data;
  },

  /**
   * Get signed URL to view/download receipt
   */
  async getReceiptUrl(id: string): Promise<string> {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/${id}/receipt-url`, {
      method: 'GET',
      headers,
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.signedUrl) {
      throw new Error(data.error || 'Failed to retrieve receipt URL');
    }
    return data.signedUrl;
  },
};
