/**
 * notify-friend-request
 *
 * Triggered via a Supabase Database Webhook on friendships INSERT.
 * When a new pending friend request is created, send:
 *   1. A push notification to the recipient (if they have a push token)
 *   2. An email to the recipient with the sender's name and a deep link
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
  const pemText = new TextDecoder().decode(
    Uint8Array.from(atob(APNS_KEY_P8), (c) => c.charCodeAt(0))
  );
  const pemBody = pemText
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
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

async function sendPush(token: string, senderName: string) {
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
      aps: {
        alert: {
          title: "New friend request 👋",
          body: `${senderName} wants to be your friend on CallMe`,
        },
        sound: "default",
        badge: 1,
      },
      deepLink: "/friends/",
    }),
  });
  if (!res.ok) {
    console.error(`APNs error: ${res.status} ${await res.text()}`);
  }
}

async function sendEmail(toEmail: string, toName: string, senderName: string): Promise<void> {
  const appUrl = "https://justcallme.app";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Friend Request on CallMe</title>
</head>
<body style="margin:0;padding:0;background:#FDFBF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDFBF9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${appUrl}/logo.png" alt="CallMe" width="64" height="64"
                style="border-radius:18px;display:block;" />
              <p style="margin:10px 0 0;font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">CallMe</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:22px;padding:36px 32px;border:1px solid #f0ede8;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#D46B50;text-transform:uppercase;letter-spacing:1px;">
                Friend Request
              </p>
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                ${senderName} wants to connect
              </h1>
              <p style="margin:0 0 28px;font-size:16px;color:#6b7280;line-height:1.6;">
                Hey ${toName}, <strong>${senderName}</strong> sent you a friend request on CallMe.
                Open the app to accept and start seeing when each other is free to talk.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${appUrl}"
                      style="display:inline-block;background:linear-gradient(135deg,#D46B50,#DE7F65);color:#ffffff;
                             text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;
                             border-radius:14px;letter-spacing:-0.2px;">
                      Open CallMe →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © 2026 CallMe &nbsp;·&nbsp;
                <a href="${appUrl}/privacy.html" style="color:#9ca3af;">Privacy Policy</a>
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#d1d5db;">
                You received this because someone sent you a friend request.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Use Resend API (configured via RESEND_API_KEY secret) to send the email
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set — skipping email");
    return;
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CallMe <hello@justcallme.app>",
      to: [toEmail],
      subject: `${senderName} wants to be your friend on CallMe`,
      html,
    }),
  });

  if (!emailRes.ok) {
    console.error(`Email send failed: ${emailRes.status} ${await emailRes.text()}`);
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record as Record<string, unknown>;

    // Only fire on new pending requests
    if (record?.status !== "pending") {
      return new Response("skip", { status: 200 });
    }

    const senderId   = record.user_id as string;
    const recipientId = record.friend_id as string;

    // Fetch sender and recipient profiles
    const [{ data: sender }, { data: recipient }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", senderId).single(),
      supabase.from("profiles").select("display_name, email, enable_push_notifications, enable_email_notifications, notify_friend_requests, enable_quiet_hours, timezone").eq("id", recipientId).single(),
    ]);

    if (!sender || !recipient) {
      return new Response("profiles not found", { status: 200 });
    }

    const senderName    = sender.display_name ?? "Someone";
    const recipientName = (recipient.display_name as string)?.split(" ")[0] ?? "there";
    const recipientEmail = recipient.email as string;

    const tasks: Promise<void>[] = [];

    // Check quiet hours for the recipient
    const inQuietHours = (() => {
      if (!recipient.enable_quiet_hours) return false;
      const tz = recipient.timezone || "UTC";
      const localHour = parseInt(new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }));
      return localHour >= 22 || localHour < 8;
    })();

    // Push notification
    if (recipient.enable_push_notifications && recipient.notify_friend_requests && !inQuietHours) {
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", recipientId);
      for (const { token } of tokens ?? []) {
        tasks.push(sendPush(token, senderName));
      }
    }

    // Email notification — only if recipient has email notifications enabled
    if (recipientEmail && recipient.enable_email_notifications !== false) {
      tasks.push(sendEmail(recipientEmail, recipientName, senderName));
    }

    await Promise.allSettled(tasks);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
