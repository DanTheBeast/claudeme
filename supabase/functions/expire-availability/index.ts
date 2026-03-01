/**
 * expire-availability
 *
 * Scheduled every 5 minutes via Supabase cron (pg_cron).
 * Sweeps all profiles where available_until < now() and is_available = true,
 * and sets them offline. This is the final safety net for cases where:
 *   - The user's phone was backgrounded/killed before it could write the update
 *   - The client-side countdown timer never fired (app crash, no foreground)
 *   - Realtime missed the event on the observer's phone
 *
 * Schedule via SQL:
 *   select cron.schedule('expire-availability', '* /5 * * * *',
 *     'select net.http_post(url:=''https://ibirrcmamficofgdsnvt.supabase.co/functions/v1/expire-availability'',
 *      headers:=''{\"Authorization\": \"Bearer <SERVICE_ROLE_KEY>\"}''::jsonb) as request_id'
 *   );
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (_req) => {
  try {
    // Find all profiles that are marked available but whose timer has expired
    const { data: expired, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, display_name, available_until")
      .eq("is_available", true)
      .not("available_until", "is", null)
      .lt("available_until", new Date().toISOString());

    if (fetchErr) {
      console.error("Failed to fetch expired profiles:", fetchErr.message);
      return new Response("error", { status: 500 });
    }

    if (!expired || expired.length === 0) {
      return new Response("ok: nothing to expire", { status: 200 });
    }

    const ids = expired.map((p: { id: string }) => p.id);
    console.log(`Expiring ${ids.length} profile(s):`, ids);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        is_available: false,
        available_until: null,
        last_seen: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateErr) {
      console.error("Failed to expire profiles:", updateErr.message);
      return new Response("error", { status: 500 });
    }

    return new Response(`ok: expired ${ids.length} profile(s)`, { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
