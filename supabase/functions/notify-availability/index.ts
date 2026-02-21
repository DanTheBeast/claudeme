/**
 * notify-availability
 *
 * Triggered via a Supabase Database Webhook on profiles UPDATE.
 * When a user flips is_available = true, notify all their friends
 * who have push tokens and have notify_availability_changes = true.
 *
 * Set up the webhook in Supabase Dashboard:
 *   Table: profiles  |  Event: UPDATE  |  URL: <this function URL>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const APNS_KEY_ID   = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID  = Deno.env.get("APNS_TEAM_ID")!;
const APNS_KEY_P8   = Deno.env.get("APNS_KEY_P8")!;   // full .p8 contents
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "com.danfields5454.callme";
const APNS_PROD     = Deno.env.get("APNS_PRODUCTION") === "true";

async function getApnsJwt(): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${header}.${payload}`;

  // APNS_KEY_P8 is stored as base64(full .p8 file contents) to avoid newline issues
  const pemText = new TextDecoder().decode(
    Uint8Array.from(atob(APNS_KEY_P8), (c) => c.charCodeAt(0))
  );
  const pemBody = pemText
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${signature}`;
}

async function sendApns(token: string, title: string, body: string, deepLink: string) {
  const host = APNS_PROD
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";

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
      aps: {
        alert: { title, body },
        sound: "default",
        badge: 1,
      },
      deepLink,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`APNs error for token ${token.slice(0, 8)}…: ${res.status} ${text}`);
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record as Record<string, unknown>;
    const old = payload.old_record as Record<string, unknown>;

    // Only fire when is_available flips true
    if (!record?.is_available || old?.is_available === true) {
      return new Response("skip", { status: 200 });
    }

    const userId = record.id as string;
    const displayName = (record.display_name as string) ?? "Your friend";

    // Get all accepted, non-muted friends of this user
    // is_muted=true means that friend muted the user who just went available,
    // so skip them — they don't want to be notified about this person.
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id, is_muted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    if (!friendships?.length) return new Response("no friends", { status: 200 });

    // Build friendId list, skipping rows where the recipient muted the sender
    const friendIds = friendships
      .filter((f) => {
        const recipientId = f.user_id === userId ? f.friend_id : f.user_id;
        // is_muted is set by the person who initiated the mute (the recipient side)
        // If the friendship row is from recipient's perspective, check is_muted
        return !f.is_muted;
      })
      .map((f) => f.user_id === userId ? f.friend_id : f.user_id);

    // Get tokens for friends who want availability notifications
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, user_id")
      .in("user_id", friendIds);

    // Check which friends have notifications enabled
    const { data: friendProfiles } = await supabase
      .from("profiles")
      .select("id, notify_availability_changes, enable_push_notifications")
      .in("id", friendIds);

    const notifySet = new Set(
      (friendProfiles ?? [])
        .filter((p) => p.enable_push_notifications && p.notify_availability_changes)
        .map((p) => p.id)
    );

    const sends = (tokens ?? [])
      .filter((t) => notifySet.has(t.user_id))
      .map((t) =>
        sendApns(
          t.token,
          `${displayName} is available! 📞`,
          "Tap to call them now",
          "/friends/"
        )
      );

    await Promise.allSettled(sends);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
