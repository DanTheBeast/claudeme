/**
 * Simple localStorage cache for page data.
 * Allows pages to render immediately from cache while re-fetching in background.
 * Cache entries are keyed by a string and scoped to the user ID to prevent
 * stale data from a previous session leaking into a new one.
 */

const PREFIX = "callme_cache_";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — stale after this, ignore

interface CacheEntry<T> {
  data: T;
  userId: string;
  ts: number;
}

export function cacheRead<T>(key: string, userId: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    // Reject if wrong user or too old
    if (entry.userId !== userId) return null;
    if (Date.now() - entry.ts > MAX_AGE_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheWrite<T>(key: string, userId: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { data, userId, ts: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function cacheClear(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) return;
          const entry = JSON.parse(raw) as CacheEntry<unknown>;
          if (entry.userId === userId) localStorage.removeItem(k);
        } catch {}
      });
  } catch {}
}
