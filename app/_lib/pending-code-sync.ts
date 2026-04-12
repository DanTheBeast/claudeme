/**
 * Sync pending invite codes when connection is restored
 * This ensures codes always get saved to the database eventually
 */

import { getPendingInviteCodes, markInviteCodeAsSynced } from "./cache";
import { logInviteCodeEvent } from "./invite-code-monitor";

export async function syncPendingInviteCodes(
  supabase: any,
  userId: string,
  withTimeout: <T>(promise: PromiseLike<T>, ms?: number) => Promise<T>
): Promise<{ synced: number; failed: number }> {
  const pendingCodes = getPendingInviteCodes(userId);
  const unsynced = pendingCodes.filter(c => !c.synced);

  if (unsynced.length === 0) {
    console.log("[CallMe] No pending codes to sync");
    return { synced: 0, failed: 0 };
  }

  console.log(`[CallMe] Syncing ${unsynced.length} pending codes...`);
  let synced = 0;
  let failed = 0;

  for (const code of unsynced) {
    try {
      const response = await withTimeout(
        supabase
          .from("invite_codes")
          .insert({
            code: code.code,
            inviter_id: code.inviter_id,
            inviter_username: code.inviter_username,
          }),
        3000
      );

      const resp = response as any;
      if (!resp.error) {
        console.log(`[CallMe] Synced code: ${code.code}`);
        markInviteCodeAsSynced(userId, code.code);
        logInviteCodeEvent({
          code: code.code,
          userId,
          event: "sync_success",
        });
        synced++;
      } else {
        console.error(`[CallMe] Failed to sync code ${code.code}:`, resp.error);
        logInviteCodeEvent({
          code: code.code,
          userId,
          event: "sync_failed",
          error: resp.error?.message,
        });
        failed++;
      }
    } catch (e) {
      console.error(`[CallMe] Error syncing code ${code.code}:`, e);
      logInviteCodeEvent({
        code: code.code,
        userId,
        event: "sync_failed",
        error: (e as Error).message,
      });
      failed++;
    }
  }

  console.log(`[CallMe] Pending code sync complete - ${synced} synced, ${failed} failed`);
  return { synced, failed };
}
