import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

// Queue to prevent concurrent registerPushNotifications calls from racing.
// Multiple rapid calls (e.g., from layout's 1s defer + 3s fallback) would
// both try to remove listeners and add listeners simultaneously, causing
// duplicate listener registrations and memory leaks.
let registrationPromise: Promise<void> | null = null;

/**
 * Set the app icon badge number (iOS only).
 * On iOS: Shows a red badge with the number on the app icon
 * On Android: Not implemented (Android doesn't have app icon badges in the same way)
 * Pass 0 to clear the badge.
 */
export async function setAppBadge(count: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'ios') return; // Only works on iOS

  try {
    // Use Capacitor's plugin system to call native iOS code
    // This is done via the global window object in the iOS webview
    if (typeof (window as any).webkit !== 'undefined' && 
        typeof (window as any).webkit.messageHandlers !== 'undefined' &&
        typeof (window as any).webkit.messageHandlers.setAppBadge !== 'undefined') {
      (window as any).webkit.messageHandlers.setAppBadge.postMessage({ value: count });
      if (count > 0) {
        console.log("[CallMe] app badge set to:", count);
      } else {
        console.log("[CallMe] app badge cleared");
      }
    } else {
      // Fallback: try using direct Capacitor invoke
      const { App } = await import('@capacitor/app');
      // Note: This will fail gracefully if the method doesn't exist
      try {
        await (App as any).setAppBadge?.({ count });
      } catch {
        // Badge not supported on this version
      }
    }
  } catch (err) {
    // Badge setting may fail on some devices or Android, but it's not critical
    console.warn("[CallMe] failed to set app badge:", err);
  }
}

/**
 * Clear the app icon badge and dismiss all delivered notifications
 * from the notification center. Call this when the app comes to foreground.
 */
export async function clearNotificationBadge(): Promise<void> {
   if (!Capacitor.isNativePlatform()) return;
   try {
     await PushNotifications.removeAllDeliveredNotifications();
     // Also clear the app icon badge
     await setAppBadge(0);
   } catch {}
}

/**
 * Request permission, register for APNs, and return the device token.
 * Saves the token to Supabase push_tokens table.
 *
 * Safe to call once per app session — the caller guards with pushRegistered ref.
 * Uses a queue to ensure serial execution so listeners don't duplicate if
 * multiple concurrent calls occur (e.g. race between the 1s defer and 3s
 * fallback retry in layout).
 */
export async function registerPushNotifications(
   userId: string,
   supabase: ReturnType<typeof import("./supabase-browser").createClient>
 ): Promise<void> {
   if (!Capacitor.isNativePlatform()) return;

   // If a registration is already in-flight, wait for it to complete before
   // starting a new one. This prevents duplicate listeners and ensures only
   // the first successful registration matters.
   if (registrationPromise) {
     try { await registrationPromise; } catch {}
     return;
   }

    // Mark this call as in-flight with an async closure
    registrationPromise = (async () => {
      try {
        // Remove any previously registered listeners before adding new ones.
        // This prevents duplicate listeners if registerPushNotifications is ever
        // called more than once in a session (e.g. race between the 1s defer and
        // the 3s fallback retry in layout).
        try { await PushNotifications.removeAllListeners(); } catch {}

        // Add listeners BEFORE calling register()
        try {
          await PushNotifications.addListener("registration", async (token) => {
            try {
              console.log("[CallMe] push token received:", token.value.slice(0, 16));
              const { error } = await supabase.from("push_tokens").upsert(
                {
                  user_id: userId,
                  token: token.value,
                  platform: Capacitor.getPlatform(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,token" }
              );
              if (error) console.error("[CallMe] push token save error:", error.message);
              else console.log("[CallMe] push token registered successfully");
            } catch (err) {
              console.error("[CallMe] push token handler error:", err);
            }
          });
        } catch (err) {
          console.error("[CallMe] failed to add registration listener:", err);
        }

        try {
          await PushNotifications.addListener("registrationError", (err) => {
            console.error("[CallMe] push registration error:", JSON.stringify(err));
          });
        } catch (err) {
          console.error("[CallMe] failed to add registrationError listener:", err);
        }

        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted") {
          console.log("[CallMe] push permission denied:", permission.receive);
          return;
        }

        await PushNotifications.register();

        // Handle notification tap — deep link into the app.
        // Only added after permission is confirmed so it never accumulates on
        // devices where the user has denied notifications.
        // Only allow navigation to known internal paths to prevent open redirect.
        const ALLOWED_PATHS = ["/", "/friends", "/schedule", "/profile"];
        try {
          PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action) => {
              try {
                const deepLink = action.notification.data?.deepLink as string | undefined;
                if (!deepLink || typeof window === "undefined") return;
                try {
                  const url = new URL(deepLink, window.location.href);
                  // Must be same origin (capacitor://localhost or https://justcallme.app)
                  // and path must be in the allowed list
                  const isSameOrigin = url.origin === window.location.origin ||
                    url.origin === "https://justcallme.app";
                  const isAllowed = ALLOWED_PATHS.some(
                    (p) => url.pathname === p || url.pathname === p + "/"
                  );
                  if (isSameOrigin && isAllowed) {
                    window.location.href = url.pathname;
                  }
                } catch {
                  // Malformed URL — ignore
                }
              } catch (err) {
                console.error("[CallMe] notification action handler error:", err);
              }
            }
          );
        } catch (err) {
          console.error("[CallMe] failed to add pushNotificationActionPerformed listener:", err);
        }
      } catch (err) {
        console.error("[CallMe] push notification registration failed:", err);
        throw err;
      }
    })();

   await registrationPromise;
}
