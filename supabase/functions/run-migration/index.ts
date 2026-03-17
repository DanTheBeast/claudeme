import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "public" } }
);

Deno.serve(async (req) => {
  const secret = req.headers.get("x-migration-secret");
  if (secret !== "callme-migrate-2026") {
    return new Response("Forbidden", { status: 403 });
  }

  // Use pg directly via the connection string
  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1);
  const conn = await pool.connect();
  try {
    await conn.queryObject(`
      CREATE TABLE IF NOT EXISTS public.invite_codes (
        code TEXT PRIMARY KEY,
        inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        inviter_username TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        used_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS invite_codes_inviter_id_idx ON public.invite_codes(inviter_id);
      ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

      -- Anyone (including unauthenticated website visitors) can look up a code
      -- to display the inviter's name on the landing page.
      DROP POLICY IF EXISTS "public can read invite codes" ON public.invite_codes;
      CREATE POLICY "public can read invite codes"
        ON public.invite_codes FOR SELECT
        USING (true);
    `);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  } finally {
    conn.release();
    await pool.end();
  }
});
