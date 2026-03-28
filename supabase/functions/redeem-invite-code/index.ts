/**
 * redeem-invite-code
 *
 * Called by the app when a new user enters an invite code (or taps "Add"
 * from the invite banner after opening a callme://invite deep link).
 *
 * Validates the code, marks it as used, and creates a pending friendship
 * so the inviter gets a friend request from the new user.
 *
 * Idempotent — safe to call multiple times with the same code + user pair.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  
  console.log("[redeem-invite-code] Auth attempt:", {
    hasAuthHeader: !!authHeader,
    tokenLength: token.length,
  });
  
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  
  if (authErr) {
    console.error("[redeem-invite-code] Auth error:", {
      message: authErr.message,
      code: authErr.code,
      status: authErr.status,
    });
  }
  
  if (authErr || !user) {
    console.error("[redeem-invite-code] Authentication failed", { authErr, user });
    return new Response(JSON.stringify({ error: "Unauthorized", detail: authErr?.message }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  
  console.log("[redeem-invite-code] User authenticated:", user.id);

  const body = await req.json().catch(() => ({}));
  const code = (body.code as string ?? "").trim().toLowerCase();

  if (!code || code.length < 4) {
    return new Response(JSON.stringify({ error: "Invalid code" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Look up the code
  console.log("[redeem-invite-code] Looking up code:", code);
  
  const { data: invite, error: lookupErr } = await supabase
    .from("invite_codes")
    .select("code, inviter_id, inviter_username, used_by")
    .eq("code", code)
    .maybeSingle();

  console.log("[redeem-invite-code] Code lookup result:", {
    found: !!invite,
    error: lookupErr?.message,
    errorCode: lookupErr?.code,
  });

  if (lookupErr) {
    console.error("[redeem-invite-code] code lookup failed:", {
      message: lookupErr.message,
      code: lookupErr.code,
      details: (lookupErr as any).details,
      hint: (lookupErr as any).hint,
    });
    return new Response(JSON.stringify({ 
      error: "Code lookup failed — try again",
      detail: lookupErr.message,
    }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!invite) {
    console.log("[redeem-invite-code] Code not found:", code);
    return new Response(JSON.stringify({ error: "Code not found — double-check and try again" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  
  console.log("[redeem-invite-code] Code validated, inviter:", invite.inviter_id);

  // Can't redeem your own code
  if (invite.inviter_id === user.id) {
    return new Response(JSON.stringify({ error: "That's your own invite code!" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // If already used by someone else, reject
  if (invite.used_by && invite.used_by !== user.id) {
    return new Response(JSON.stringify({ error: "This code has already been used" }), {
      status: 409, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Check if a friendship already exists in either direction — don't duplicate
  const { data: existing, error: existingErr } = await supabase
    .from("friendships")
    .select("id, status")
    .or(`and(user_id.eq.${user.id},friend_id.eq.${invite.inviter_id}),and(user_id.eq.${invite.inviter_id},friend_id.eq.${user.id})`)
    .maybeSingle();

  if (existingErr) {
    console.error("[redeem-invite-code] friendship check failed:", existingErr);
    return new Response(JSON.stringify({ error: "Failed to check friendship — try again" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!existing) {
    // Create a pending friend request from the redeemer to the inviter
    console.log("[redeem-invite-code] attempting friendship insert:", {
      user_id: user.id,
      friend_id: invite.inviter_id,
      status: "pending",
    });
    
    const { data: insertData, error: friendErr } = await supabase
      .from("friendships")
      .insert({ user_id: user.id, friend_id: invite.inviter_id, status: "pending" });

    console.log("[redeem-invite-code] friendship insert result:", {
      data: insertData,
      error: friendErr,
    });

    if (friendErr && !friendErr.message?.includes("duplicate")) {
      console.error("[redeem-invite-code] friendship insert failed:", {
        code,
        user_id: user.id,
        inviter_id: invite.inviter_id,
        error: friendErr.message,
        errorCode: friendErr.code,
        details: friendErr.details,
        hint: friendErr.hint,
      });
      return new Response(JSON.stringify({ error: "Failed to send friend request — try again" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // Mark code as used (idempotent — if already used_by this user, upsert is a no-op)
  await supabase
    .from("invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("code", code);

  return new Response(
    JSON.stringify({
      success: true,
      inviter_username: invite.inviter_username,
      already_friends: existing?.status === "accepted",
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
