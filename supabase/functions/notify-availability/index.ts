/**
 * notify-availability
 *
 * Triggered via a Supabase Database Webhook on profiles UPDATE.
 * When a user flips is_available = true, notify all their friends
 * who have push tokens and have notify_availability_changes = true.
 *
 * Reliability improvements:
 * - Dedupe via DB insert with unique constraint (atomic, not a race condition)
 * - Stale/invalid tokens are deleted automatically on APNs rejection
 * - Tokens + profiles fetched in parallel
 * - Single APNs JWT generated once and reused for all sends
 * - apns-expiration set so offline devices get the notification when they wake
 * - apns-collapse-id so rapid toggles don't stack notifications
 * - 1 retry on transient APNs errors (429, 5xx)
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

// APNs errors that mean the token is permanently dead — delete it
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

async function getApnsJwt(): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${header}.${payload}`;

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

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${signature}`;
}

async function sendApns(
  token: string,
  title: string,
  body: string,
  deepLink: string,
  collapseId: string,
  jwt: string,
  retrying = false
): Promise<{ token: string; dead: boolean }> {
  const host = APNS_PROD ? "api.push.apple.com" : "api.sandbox.push.apple.com";

  // Expire after 1 hour — device will receive it when it wakes up
  const expiration = Math.floor(Date.now() / 1000) + 3600;

  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(expiration),
      "apns-collapse-id": collapseId,
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

  if (res.ok) return { token, dead: false };

  const text = await res.text();
  let reason = "";
  try { reason = JSON.parse(text).reason ?? ""; } catch {}

  // Permanent failure — token is dead
  if (DEAD_TOKEN_REASONS.has(reason)) {
    console.warn(`APNs dead token ${token.slice(0, 8)}…: ${reason} — will delete`);
    return { token, dead: true };
  }

  // Transient failure (rate limit, server error) — retry once after 1s
  if (!retrying && (res.status === 429 || res.status >= 500)) {
    console.warn(`APNs transient error ${res.status} for ${token.slice(0, 8)}…, retrying…`);
    await new Promise((r) => setTimeout(r, 1000));
    return sendApns(token, title, body, deepLink, collapseId, jwt, true);
  }

  console.error(`APNs error for token ${token.slice(0, 8)}…: ${res.status} ${text}`);
  return { token, dead: false };
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record  = payload.record     as Record<string, unknown>;
    const old     = payload.old_record as Record<string, unknown>;

    // Only fire when is_available flips true
    if (!record?.is_available || old?.is_available === true) {
      return new Response("skip", { status: 200 });
    }

    const userId      = record.id           as string;
    const displayName = (record.display_name as string) ?? "Your friend";

    // Atomic dedupe — insert a notification_log row with a unique constraint
    // on (user_id, window). If another invocation already inserted for this
    // user in the last 30s, the insert fails and we skip.
    const windowKey = `${userId}:${Math.floor(Date.now() / 30_000)}`;
    const { error: dedupeError } = await supabase
      .from("notification_log")
      .insert({ user_id: userId, window_key: windowKey })
      .select()
      .single();

    if (dedupeError) {
      // Unique constraint violation = duplicate webhook, skip
      console.log(`Dedupe skip for user ${userId.slice(0, 8)}…`);
      return new Response("dedupe", { status: 200 });
    }

    // Fetch friends, tokens, and profiles all in parallel
    const [friendshipsRes, tokensRes] = await Promise.all([
      supabase
        .from("friendships")
        .select("user_id, friend_id, is_muted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq("status", "accepted"),
      supabase
        .from("push_tokens")
        .select("token, user_id"),
    ]);

    const friendships = friendshipsRes.data ?? [];
    if (!friendships.length) return new Response("no friends", { status: 200 });

    const friendIds = friendships
      .filter((f) => !f.is_muted)
      .map((f) => f.user_id === userId ? f.friend_id : f.user_id);

    // Get notification preferences for these specific friends
    const { data: friendProfiles } = await supabase
      .from("profiles")
      .select("id, notify_availability_changes, enable_push_notifications")
      .in("id", friendIds);

    const notifySet = new Set(
      (friendProfiles ?? [])
        .filter((p) => p.enable_push_notifications && p.notify_availability_changes)
        .map((p) => p.id)
    );

    const targetTokens = (tokensRes.data ?? [])
      .filter((t) => friendIds.includes(t.user_id) && notifySet.has(t.user_id));

    if (!targetTokens.length) return new Response("no targets", { status: 200 });

    // Generate JWT once and reuse for all sends
    const jwt = await getApnsJwt();
    const collapseId = `avail-${userId}`; // collapse rapid re-toggles on device

    const results = await Promise.allSettled(
      targetTokens.map((t) =>
        sendApns(
          t.token,
          `${displayName} is free to talk 📞`,
          "Tap to call them now",
          "/friends/",
          collapseId,
          jwt
        )
      )
    );

    // Clean up dead tokens so they don't clog future sends
    const deadTokens = results
      .filter((r): r is PromiseFulfilledResult<{ token: string; dead: boolean }> =>
        r.status === "fulfilled" && r.value.dead
      )
      .map((r) => r.value.token);

    if (deadTokens.length) {
      await supabase
        .from("push_tokens")
        .delete()
        .in("token", deadTokens);
      console.log(`Deleted ${deadTokens.length} dead token(s)`);
    }

    const sent = results.filter(
      (r) => r.status === "fulfilled" && !r.value.dead
    ).length;

    return new Response(`ok: ${sent} sent, ${deadTokens.length} dead tokens removed`, { status: 200 });

  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
