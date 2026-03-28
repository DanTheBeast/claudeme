/**
 * delete-account
 *
 * Deletes the authenticated user's account and all associated data.
 * Must be called with a valid user JWT — we use it to verify identity
 * before using the service role key to perform the actual deletion.
 *
 * Deletion order (to satisfy FK constraints):
 *   1. push_tokens
 *   2. availability_windows
 *   3. friendships (both directions)
 *   4. profile
 *   5. auth.users (via admin API — cascades storage objects etc.)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Deno.serve(async (req) => {
  try {
    // Verify the caller is authenticated — use their JWT to get their user ID
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = user.id;

    // Delete all user data in order — each must succeed before proceeding
    console.log("[delete-account] Starting account deletion for user:", userId);

    const { error: pushTokenErr } = await supabaseAdmin.from("push_tokens").delete().eq("user_id", userId);
    if (pushTokenErr) {
      console.error("[delete-account] Failed to delete push tokens:", pushTokenErr);
      return new Response(JSON.stringify({ error: "Failed to delete push tokens" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { error: windowErr } = await supabaseAdmin.from("availability_windows").delete().eq("user_id", userId);
    if (windowErr) {
      console.error("[delete-account] Failed to delete availability windows:", windowErr);
      return new Response(JSON.stringify({ error: "Failed to delete availability windows" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { error: friendshipErr } = await supabaseAdmin.from("friendships").delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (friendshipErr) {
      console.error("[delete-account] Failed to delete friendships:", friendshipErr);
      return new Response(JSON.stringify({ error: "Failed to delete friendships" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { error: profileErr } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (profileErr) {
      console.error("[delete-account] Failed to delete profile:", profileErr);
      return new Response(JSON.stringify({ error: "Failed to delete profile" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Delete the auth user — this is irreversible
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[delete-account] Failed to delete auth user:", {
        userId,
        message: deleteError.message,
        status: deleteError.status,
      });
      return new Response(JSON.stringify({ error: "Failed to delete auth user" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("[delete-account] Account deleted successfully for user:", userId);
    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("[delete-account] Unexpected error:", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
