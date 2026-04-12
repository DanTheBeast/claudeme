/**
 * Simple localStorage cache for page data.
 * Allows pages to render immediately from cache while re-fetching in background.
 * Cache entries are keyed by a string and scoped to the user ID to prevent
 * stale data from a previous session leaking into a new one.
 */

const PREFIX = "callme_cache_";

// Availability status is time-sensitive — cache is only used to avoid skeletons
// on resume, not to serve as a long-term store. Keep it short so a friend's
// availability is never stale for more than a few minutes.
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

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
    // Reject if wrong user
    if (entry.userId !== userId) return null;
    // Reject if stale — availability data older than MAX_AGE_MS is misleading
    // for a real-time presence app (e.g. user left the app open overnight).
    if (Date.now() - entry.ts > MAX_AGE_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheWrite<T>(key: string, userId: string, data: T): void {
   if (typeof window === "undefined") return;
   // Defensive check: never cache data for an empty or invalid user ID
   if (!userId || typeof userId !== "string" || userId.length === 0) {
     console.warn("[CallMe] cache write rejected: invalid userId");
     return;
   }
   try {
     const entry: CacheEntry<T> = { data, userId, ts: Date.now() };
     localStorage.setItem(PREFIX + key, JSON.stringify(entry));
   } catch {
     // localStorage full or unavailable — silently ignore
   }
 }

/**
 * Wraps a promise (or PromiseLike, e.g. Supabase query builders) with a
 * timeout. If it doesn't resolve within `ms` milliseconds, rejects with a
 * TimeoutError. Use this to ensure every Supabase call that gates a UI
 * loading state has a guaranteed exit path even on a dead network.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
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

/**
 * CRITICAL FEATURE: Offline-first invite code management
 * Stores pending invite codes locally so the user can always share
 * even if the database insert fails. Syncs in background.
 */
const PENDING_CODES_KEY = "callme_pending_invite_codes_";

interface PendingInviteCode {
  code: string;
  inviter_id: string;
  inviter_username: string;
  created_at: string;
  synced: boolean; // Has this been successfully saved to DB?
}

export function savePendingInviteCode(userId: string, code: PendingInviteCode): void {
  if (typeof window === "undefined") return;
  try {
    const key = PENDING_CODES_KEY + userId;
    const existing = localStorage.getItem(key);
    const codes: PendingInviteCode[] = existing ? JSON.parse(existing) : [];
    codes.push(code);
    // Keep only last 50 pending codes
    localStorage.setItem(key, JSON.stringify(codes.slice(-50)));
  } catch (e) {
    console.warn("[CallMe] Failed to save pending invite code:", e);
  }
}

export function getPendingInviteCodes(userId: string): PendingInviteCode[] {
  if (typeof window === "undefined") return [];
  try {
    const key = PENDING_CODES_KEY + userId;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("[CallMe] Failed to get pending invite codes:", e);
    return [];
  }
}

export function markInviteCodeAsSynced(userId: string, code: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = PENDING_CODES_KEY + userId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const codes: PendingInviteCode[] = JSON.parse(raw);
    const updated = codes.map(c => c.code === code ? { ...c, synced: true } : c);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn("[CallMe] Failed to mark code as synced:", e);
  }
}

export function clearPendingInviteCodes(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = PENDING_CODES_KEY + userId;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn("[CallMe] Failed to clear pending invite codes:", e);
  }
}
