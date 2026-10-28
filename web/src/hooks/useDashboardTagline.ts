import { useState, useEffect } from 'react';

/**
 * 10 Motivational Taglines for Auvryn Dashboard Inspiration Banner
 */
export const AUVRYN_MOTIVATIONAL_TAGLINES = [
  "Turn today's plans into tomorrow's progress.",
  "Your vision. One workspace. Endless momentum.",
  "Less busywork. More breakthrough moments.",
  "Build better. Grow smarter.",
  "Make every move meaningful.",
  "Your next big idea starts here.",
  "Bring your business into its best rhythm.",
  "Small steps. Remarkable growth.",
  "One workspace. A world of progress.",
  "Big goals. Brighter possibilities."
] as const;

const STORAGE_KEY_TAGLINE_INDEX = 'auvryn_active_tagline_index';
const STORAGE_KEY_SESSION_DATE = 'auvryn_tagline_session_date';
const SESSION_KEY_TAGLINE = 'auvryn_session_tagline';

/**
 * Deterministically retrieves or rotates the tagline for a new session or day.
 * Ensures the tagline stays completely stable during user navigation across dashboard components.
 */
export function getOrRotateTagline(): string {
  if (typeof window === 'undefined') {
    return AUVRYN_MOTIVATIONAL_TAGLINES[0];
  }

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lastDate = localStorage.getItem(STORAGE_KEY_SESSION_DATE);
    const sessionTagline = sessionStorage.getItem(SESSION_KEY_TAGLINE);

    // If already initialized for this active session on the current day, preserve it
    if (sessionTagline && lastDate === today) {
      return sessionTagline;
    }

    // Determine next sequential index
    const savedIndexStr = localStorage.getItem(STORAGE_KEY_TAGLINE_INDEX);
    let nextIndex = 0;

    if (savedIndexStr !== null) {
      const parsed = parseInt(savedIndexStr, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        nextIndex = (parsed + 1) % AUVRYN_MOTIVATIONAL_TAGLINES.length;
      }
    } else {
      // Seed with current day of month so different days start nicely
      nextIndex = new Date().getDate() % AUVRYN_MOTIVATIONAL_TAGLINES.length;
    }

    const selectedTagline = AUVRYN_MOTIVATIONAL_TAGLINES[nextIndex];

    // Persist to localStorage (for day/index tracking) and sessionStorage (for in-session stability)
    localStorage.setItem(STORAGE_KEY_TAGLINE_INDEX, nextIndex.toString());
    localStorage.setItem(STORAGE_KEY_SESSION_DATE, today);
    sessionStorage.setItem(SESSION_KEY_TAGLINE, selectedTagline);

    return selectedTagline;
  } catch {
    return AUVRYN_MOTIVATIONAL_TAGLINES[0];
  }
}

/**
 * Hook providing the stable, dynamic daily/session tagline for Auvryn dashboard
 */
export function useDashboardTagline(): string {
  const [tagline, setTagline] = useState<string>(() => getOrRotateTagline());

  useEffect(() => {
    const current = getOrRotateTagline();
    if (current !== tagline) {
      setTagline(current);
    }
  }, []);

  return tagline;
}
