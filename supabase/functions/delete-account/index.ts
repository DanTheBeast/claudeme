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

    // Delete all user data in order
    await supabaseAdmin.from("push_tokens").delete().eq("user_id", userId);
    await supabaseAdmin.from("availability_windows").delete().eq("user_id", userId);
    await supabaseAdmin.from("friendships").delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // Delete the auth user — this is irreversible
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError.message);
      return new Response("Failed to delete account", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
