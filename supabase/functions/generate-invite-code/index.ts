/**
 * generate-invite-code
 *
 * Called by the app when a user wants to share their invite link.
 * Returns a stable short code for the user — creates a new one if they
 * don't have one yet, or returns their existing unused one.
 *
 * Each user gets one reusable code. Once a code is redeemed (used_by is set),
 * a fresh code is generated for the next invite.
 *
 * Table: invite_codes (created by a migration, not this function)
 *   code             TEXT PRIMARY KEY
 *   inviter_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE
 *   inviter_username TEXT NOT NULL
 *   created_at       TIMESTAMPTZ DEFAULT NOW()
 *   used_by          UUID REFERENCES auth.users ON DELETE SET NULL
 *   used_at          TIMESTAMPTZ
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function generateCode(): string {
  // 8 chars from a 32-char alphabet — excludes 0/O and 1/I/l to avoid visual
  // confusion when a user reads a code aloud or types it manually.
  const chars = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Authenticate the caller via their JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch the inviter's username
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username) {
    return new Response(JSON.stringify({ error: "Set a username in your profile before inviting friends" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Return the user's existing unused code if one exists.
  // This ensures sharing the link multiple times gives the same URL.
  const { data: existing } = await supabase
    .from("invite_codes")
    .select("code")
    .eq("inviter_id", user.id)
    .is("used_by", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.code) {
    return new Response(JSON.stringify({ code: existing.code }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Generate a new unique code — retry on the extremely unlikely collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error: insertErr } = await supabase
      .from("invite_codes")
      .insert({ code, inviter_id: user.id, inviter_username: profile.username });
    if (!insertErr) {
      return new Response(JSON.stringify({ code }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    // Only retry on duplicate key — any other error should surface
    if (!insertErr.message?.includes("duplicate")) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Failed to generate code — please try again" }), {
    status: 500, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
