import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

/**
 * Clear the app icon badge and dismiss all delivered notifications
 * from the notification center. Call this when the app comes to foreground.
 */
export async function clearNotificationBadge(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch {}
}

/**
 * Request permission, register for APNs, and return the device token.
 * Saves the token to Supabase push_tokens table.
 */
export async function registerPushNotifications(
  userId: string,
  supabase: ReturnType<typeof import("./supabase-browser").createClient>
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Add listeners BEFORE calling register()
  await PushNotifications.addListener("registration", async (token) => {
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
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.error("[CallMe] push registration error:", JSON.stringify(err));
  });

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    console.log("[CallMe] push permission denied:", permission.receive);
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[CallMe] push registration error:", err.error);
  });

  // Handle notification tap — deep link into the app.
  // Only allow navigation to known internal paths to prevent open redirect.
  const ALLOWED_PATHS = ["/", "/friends", "/schedule", "/profile"];
  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
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
    }
  );
}
