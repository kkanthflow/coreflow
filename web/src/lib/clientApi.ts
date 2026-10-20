import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function getAuthHeaders(orgId?: string | null): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }
  return headers;
}

export interface SaveClientPortalPayload {
  id?: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  gstNumber?: string | null;
  address?: string | null;
  notes?: string | null;
  enablePortal?: boolean;
  projectIds?: string[];
}

export const clientApi = {
  async saveClientWithPortal(payload: SaveClientPortalPayload, orgId?: string | null) {
    const headers = await getAuthHeaders(orgId);
    const res = await fetch(`${API_BASE}/clients/portal-account`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save client');
    }
    return data;
  },

  async togglePortalAccess(clientId: string, enabled: boolean, orgId?: string | null) {
    const headers = await getAuthHeaders(orgId);
    const res = await fetch(`${API_BASE}/clients/${clientId}/toggle-portal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to toggle portal access');
    }
    return data;
  },

  async resendAccessLink(clientId: string, orgId?: string | null) {
    const headers = await getAuthHeaders(orgId);
    const res = await fetch(`${API_BASE}/clients/${clientId}/resend-access`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to resend access link');
    }
    return data;
  },

  async resetPassword(clientId: string, orgId?: string | null) {
    const headers = await getAuthHeaders(orgId);
    const res = await fetch(`${API_BASE}/clients/${clientId}/reset-password`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to trigger password reset');
    }
    return data;
  },

  async syncProjects(clientId: string, projectIds: string[], orgId?: string | null) {
    const headers = await getAuthHeaders(orgId);
    const res = await fetch(`${API_BASE}/clients/${clientId}/sync-projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sync client projects');
    }
    return data;
  },

  async getClientDetails(clientId: string, orgId?: string | null) {
    const headers = await getAuthHeaders(orgId);
    const res = await fetch(`${API_BASE}/clients/${clientId}/details`, {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch client details');
    }
    return data;
  },
};
