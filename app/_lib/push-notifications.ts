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
