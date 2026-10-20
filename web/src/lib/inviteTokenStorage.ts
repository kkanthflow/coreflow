/**
 * Invite Token Storage Utility
 * Persists project invite tokens across full authentication lifecycles:
 * email verification links, password redirects, and Google/OAuth flows.
 */

const STORAGE_KEY = 'auvryn_invite_token';
const COOKIE_NAME = 'auvryn_invite_token';

export function saveInviteToken(token: string): void {
  if (!token || typeof token !== 'string') return;
  const clean = token.trim();
  if (!clean) return;

  try {
    localStorage.setItem(STORAGE_KEY, clean);
  } catch (e) {
    console.warn('[inviteTokenStorage] localStorage unavailable:', e);
  }

  // Set cookie with 7-day expiration and Lax SameSite so it survives cross-origin OAuth returns
  try {
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(clean)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch (e) {
    console.warn('[inviteTokenStorage] Cookie write failed:', e);
  }
}

export function getStoredInviteToken(): string | null {
  // 1. Check URL parameters first
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token') || params.get('invite');
    if (urlToken && urlToken.trim()) {
      saveInviteToken(urlToken.trim());
      return urlToken.trim();
    }
  }

  // 2. Check localStorage
  try {
    const lsToken = localStorage.getItem(STORAGE_KEY);
    if (lsToken && lsToken.trim()) return lsToken.trim();
  } catch (e) {
    // Ignore error
  }

  // 3. Check Cookie
  if (typeof document !== 'undefined' && document.cookie) {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [name, val] = c.trim().split('=');
      if (name === COOKIE_NAME && val) {
        return decodeURIComponent(val.trim());
      }
    }
  }

  return null;
}

export function clearStoredInviteToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // Ignore error
  }
  try {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } catch (e) {
    // Ignore error
  }
}
