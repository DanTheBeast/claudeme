import * as Sentry from "@sentry/capacitor";

let initialized = false;

/**
 * Initialize Sentry once at app start.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initSentry() {
  if (initialized) return;
  initialized = true;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Capture 100% of errors always.
    // Only trace 10% of sessions for performance — adjust up if needed.
    tracesSampleRate: 0.1,
    // Tag every event with the release so you can filter by version.
    // Falls back to a literal only if the env var isn't set at build time.
    release: process.env.NEXT_PUBLIC_APP_VERSION
      ? `callme@${process.env.NEXT_PUBLIC_APP_VERSION}`
      : "callme@unknown",
    // "production" vs "development" — lets you filter noise in the dashboard.
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    // Don't send events in development so you don't pollute the dashboard.
    enabled: process.env.NODE_ENV === "production",
  });
}

/**
 * Tag the current Sentry scope with the logged-in user.
 * Called after fetchProfile succeeds so every error includes who was affected.
 */
export function setSentryUser(id: string, username?: string | null) {
  Sentry.setUser({ id, username: username ?? undefined });
}

/**
 * Clear the Sentry user on sign-out.
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Manually capture an error with optional context.
 * Use this in catch blocks where you want visibility but don't want to crash.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
