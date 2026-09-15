import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
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

  async getPlaybackState(projectId: string, targetDate: string) {
    const headers = await getAuthHeader();
    const res = await fetch(
      `${API_BASE}/causality/playback?projectId=${projectId}&targetDate=${encodeURIComponent(targetDate)}`,
      { headers }
    );
    if (!res.ok) throw new Error('Failed to fetch Playback state');
    return res.json();
  },

  async compareStates(projectId: string, dateA: string, dateB: string) {
    const headers = await getAuthHeader();
    const res = await fetch(
      `${API_BASE}/causality/compare?projectId=${projectId}&dateA=${encodeURIComponent(dateA)}&dateB=${encodeURIComponent(dateB)}`,
      { headers }
    );
    if (!res.ok) throw new Error('Failed to compare project states');
    return res.json();
  },

  async provisionClientUser(payload: {
    projectId: string;
    email: string;
    password: string;
    fullName?: string;
    canApprove?: boolean;
    canRequestChanges?: boolean;
    canViewFinancials?: boolean;
  }) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/provision-client`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create client user account');
    }
    return res.json();
  },

  async createProject(payload: any) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/causality/projects`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initialize project');
    }
    return res.json();
  },
};
