import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

/**
 * Request permission, register for APNs, and return the device token.
 * Saves the token to Supabase push_tokens table.
 */
export async function registerPushNotifications(
  userId: string,
  supabase: ReturnType<typeof import("./supabase-browser").createClient>
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.register();

  // Listen for the token once
  PushNotifications.addListener("registration", async (token) => {
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token: token.value,
        platform: Capacitor.getPlatform(), // "ios" | "android"
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );
    if (error) console.error("[CallMe] push token save error:", error.message);
    else console.log("[CallMe] push token registered");
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[CallMe] push registration error:", err.error);
  });

  // Handle notification tap — deep link into the app
  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      const deepLink = action.notification.data?.deepLink as string | undefined;
      if (deepLink && typeof window !== "undefined") {
        window.location.href = deepLink;
      }
    }
  );
}
