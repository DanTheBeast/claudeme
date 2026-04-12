/**
 * Monitoring for invite code generation and sync success rates
 * Helps us identify if database sync issues are still happening
 */

interface InviteCodeEvent {
  code: string;
  userId: string;
  event: "generated" | "sync_attempt" | "sync_success" | "sync_failed" | "shared";
  timestamp: number;
  duration?: number; // Time taken for the operation
  error?: string;
}

const MAX_EVENTS = 100; // Keep last 100 events
const STORAGE_KEY = "callme_invite_code_events";

export function logInviteCodeEvent(event: Omit<InviteCodeEvent, "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const events: InviteCodeEvent[] = existing ? JSON.parse(existing) : [];
    events.push({
      ...event,
      timestamp: Date.now(),
    });
    // Keep only last 100 events
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch (e) {
    console.warn("[CallMe] Failed to log invite code event:", e);
  }
}

export function getInviteCodeEvents(): InviteCodeEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function calculateInviteCodeStats() {
  const events = getInviteCodeEvents();
  const now = Date.now();
  const last24h = events.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000);

  const generated = last24h.filter(e => e.event === "generated").length;
  const syncSucceeded = last24h.filter(e => e.event === "sync_success").length;
  const syncFailed = last24h.filter(e => e.event === "sync_failed").length;
  const shared = last24h.filter(e => e.event === "shared").length;

  return {
    generated,
    syncSucceeded,
    syncFailed,
    shared,
    syncSuccessRate: generated > 0 ? ((syncSucceeded / generated) * 100).toFixed(1) : "N/A",
    lastEvent: last24h[last24h.length - 1] || null,
  };
}

export function clearInviteCodeEvents(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("[CallMe] Failed to clear invite code events:", e);
  }
}
