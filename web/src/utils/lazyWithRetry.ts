import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy with automatic recovery for chunk loading errors.
 * When a new deployment occurs, older chunk filenames on the CDN are replaced.
 * If fetching a dynamically imported module fails, this helper automatically reloads
 * the page once to pull the fresh index.html and modern chunks, preventing the user
 * from ever seeing "Failed to fetch dynamically imported module".
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError' ||
        (typeof error === 'string' && error.includes('dynamically imported module'));

      if (isChunkError && typeof window !== 'undefined') {
        const key = 'auvryn_last_chunk_reload';
        const lastReload = sessionStorage.getItem(key);
        const now = Date.now();

        // Prevent infinite reload loops: allow 1 reload per 10 seconds
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem(key, String(now));
          window.location.reload();
          // Return an unresolved promise to suspend rendering until reload completes
          return new Promise<{ default: T }>(() => {});
        }
      }

      throw error;
    }
  });
}
