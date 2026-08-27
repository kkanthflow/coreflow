import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export const causalityApi = {
  async getWhyDelivery(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/why/delivery?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Delivery causality');
    return res.json();
  },

  async getWhyCost(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/why/cost?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Cost causality');
    return res.json();
  },

  async getWhyProgress(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/why/progress?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Progress causality');
    return res.json();
  },

  async getWhyScope(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/why/scope?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Scope causality');
    return res.json();
  },

  async getProjectDNA(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/dna?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Project DNA');
    return res.json();
  },

  async getProof(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/proof?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Proof');
    return res.json();
  },

  async getCommitmentHistory(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/commitments?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Commitments');
    return res.json();
  },

  async createChangeRequest(payload: any) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/change-requests`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create Change Request');
    return res.json();
  },

  async decideChangeRequest(crId: string, decision: 'accepted' | 'rejected' | 'withdrawn', notes?: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/change-requests/${crId}/decide`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes }),
    });
    if (!res.ok) throw new Error('Failed to decide Change Request');
    return res.json();
  },

  async getReceipt(code: string) {
    const res = await fetch(`${API_BASE}/causality/receipts/${code}`);
    if (!res.ok) throw new Error('Receipt not found');
    return res.json();
  },

  async getResponsibility(projectId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/responsibility?projectId=${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch Responsibility state');
    return res.json();
  },

  async sealProject(projectId: string, notes?: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/seal`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, sealNotes: notes }),
    });
    if (!res.ok) throw new Error('Failed to seal Project');
    return res.json();
  },
};
