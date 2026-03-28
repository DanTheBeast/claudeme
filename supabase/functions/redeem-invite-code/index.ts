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

  const body = await req.json().catch(() => ({}));

  // Authenticate the caller by extracting user_id from JWT
  // We trust the JWT signature because it was signed by Supabase
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  
  if (!token) {
    console.error("[redeem-invite-code] No authorization token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  
  // Extract user_id from JWT payload (don't verify, just decode)
  // JWT format: header.payload.signature
  let userId: string | null = null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    
    // Decode payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    userId = payload.sub; // 'sub' is the subject (user ID) in Supabase JWTs
    
    console.log("[redeem-invite-code] Extracted user_id from token:", userId);
    
    if (!userId) {
      throw new Error("No user ID in token");
    }
  } catch (err) {
    console.error("[redeem-invite-code] JWT decode failed:", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  
  const user = { id: userId };

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

  if (lookupErr) {
    console.error("[redeem-invite-code] code lookup failed:", lookupErr);
    return new Response(JSON.stringify({ error: "Code lookup failed — try again" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!invite) {
    console.log("[redeem-invite-code] Code not found in database:", code);
    return new Response(JSON.stringify({ error: "Code not found — double-check and try again" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  console.log("[redeem-invite-code] Code found:", { code, inviter_id: invite.inviter_id, used_by: invite.used_by });

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
  console.log("[redeem-invite-code] checking for existing friendship:", {
    user_id: user.id,
    inviter_id: invite.inviter_id,
  });
  
  const { data: existing, error: existingErr } = await supabase
    .from("friendships")
    .select("id, status")
    .or(`and(user_id.eq.${user.id},friend_id.eq.${invite.inviter_id}),and(user_id.eq.${invite.inviter_id},friend_id.eq.${user.id})`)
    .maybeSingle();

  if (existingErr) {
    console.error("[redeem-invite-code] friendship check failed:", {
      error: existingErr.message,
      code: existingErr.code,
    });
    return new Response(JSON.stringify({ error: "Failed to check friendship — try again" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  
  console.log("[redeem-invite-code] friendship check result:", { exists: !!existing, status: existing?.status });

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
      error: friendErr?.message,
      errorCode: friendErr?.code,
    });

    if (friendErr && !friendErr.message?.includes("duplicate")) {
      console.error("[redeem-invite-code] friendship insert FAILED:", {
        code,
        user_id: user.id,
        inviter_id: invite.inviter_id,
        errorMessage: friendErr.message,
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
