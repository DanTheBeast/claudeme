/**
 * notify-schedule-matches
 *
 * Runs on a cron every minute via Supabase pg_cron (or scheduled via
 * Supabase Dashboard → Edge Functions → Schedule).
 *
 * For every pair of friends who both have an availability_windows slot
 * that covers the current day + time, send each a push notification
 * (once per slot, tracked in notified_schedule_matches).
 *
 * Recommended cron schedule: every 5 minutes
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const APNS_KEY_ID    = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID   = Deno.env.get("APNS_TEAM_ID")!;
const APNS_KEY_P8    = Deno.env.get("APNS_KEY_P8")!;
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "com.danfields5454.callme";
const APNS_PROD      = Deno.env.get("APNS_PRODUCTION") === "true";

async function getApnsJwt(): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${header}.${payload}`;

  const pemBody = APNS_KEY_P8
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/[\s|]/g, "");  // strip whitespace and pipe chars from tr newline workaround

  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyData, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${signature}`;
}

async function sendApns(token: string, title: string, body: string, deepLink: string) {
  const host = APNS_PROD ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const jwt = await getApnsJwt();

  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: { alert: { title, body }, sound: "default", badge: 1 },
      deepLink,
    }),
  });

  if (!res.ok) {
    console.error(`APNs ${res.status}:`, await res.text());
  }
}

Deno.serve(async () => {
  const now = new Date();
  // day_of_week: 0=Sunday .. 6=Saturday (matches JS getDay())
  const dayOfWeek = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
  const todayDate = now.toISOString().slice(0, 10);   // "YYYY-MM-DD"

  // Find all availability windows active right now
  const { data: activeWindows } = await supabase
    .from("availability_windows")
    .select("user_id, start_time, end_time")
    .eq("day_of_week", dayOfWeek)
    .lte("start_time", currentTime)
    .gt("end_time", currentTime);

  if (!activeWindows?.length) return new Response("no active windows", { status: 200 });

  // Index active users
  const activeUserIds = [...new Set(activeWindows.map((w) => w.user_id))];

  // Find friend pairs where BOTH are active right now
  const { data: friendships } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .eq("status", "accepted")
    .in("user_id", activeUserIds)
    .in("friend_id", activeUserIds);

  if (!friendships?.length) return new Response("no matching pairs", { status: 200 });

  // Load profiles for notification prefs
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, enable_push_notifications, notify_call_suggestions")
    .in("id", activeUserIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Load tokens for active users
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", activeUserIds);

  const tokenMap: Record<string, string[]> = {};
  for (const t of tokens ?? []) {
    tokenMap[t.user_id] = tokenMap[t.user_id] ?? [];
    tokenMap[t.user_id].push(t.token);
  }

  // Get the start_time for a given user's current window
  const windowStartFor = (uid: string) =>
    activeWindows.find((w) => w.user_id === uid)?.start_time ?? currentTime;

  const sends: Promise<void>[] = [];

  for (const { user_id, friend_id } of friendships) {
    for (const [recipient, sender] of [[user_id, friend_id], [friend_id, user_id]]) {
      const profile = profileMap[recipient];
      if (!profile?.enable_push_notifications || !profile?.notify_call_suggestions) continue;
      if (!tokenMap[recipient]?.length) continue;

      const senderProfile = profileMap[sender];
      const senderName = senderProfile?.display_name ?? "Your friend";
      const startTime = windowStartFor(recipient);

      // Check if already notified for this slot today
      const { data: existing } = await supabase
        .from("notified_schedule_matches")
        .select("id")
        .eq("user_id", recipient)
        .eq("friend_id", sender)
        .eq("window_date", todayDate)
        .eq("start_time", startTime)
        .maybeSingle();

      if (existing) continue;

      // Mark as notified
      await supabase.from("notified_schedule_matches").insert({
        user_id: recipient,
        friend_id: sender,
        window_date: todayDate,
        start_time: startTime,
      });

      for (const token of tokenMap[recipient]) {
        sends.push(
          sendApns(
            token,
            `${senderName} is free to chat! 📞`,
            "You both have time right now — give them a call!",
            "/schedule/"
          )
        );
      }
    }
  }

  await Promise.allSettled(sends);
  return new Response(`sent ${sends.length} notifications`, { status: 200 });
});
