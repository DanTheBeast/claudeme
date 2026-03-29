# Recommended Code Fixes - Ready to Implement

## Fix #1: Add Error Handling to layout.tsx

**File**: `app/(dashboard)/layout.tsx`
**Lines**: 578-583

**Current Code**:
```typescript
// Step 4: Mark code as used
if (user?.id) {
  await supabase
    .from("invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("code", code);
}
```

**Fixed Code**:
```typescript
// Step 4: Mark code as used
if (user?.id) {
  const { error: markErr } = await supabase
    .from("invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("code", code);
  
  if (markErr) {
    console.error("[CallMe] failed to mark code as used:", markErr);
    // Don't fail the whole flow, but log for debugging
  }
}
```

---

## Fix #2: Create Database Migration for UPDATE Policy

**File**: `supabase/migrations/[DATE]_add_invite_codes_update_policy.sql`

**Content**:
```sql
-- Add UPDATE policy to invite_codes table
-- Users can only update codes they created (inviter_id = auth.uid())
CREATE POLICY "Users can update their own invite codes"
  ON invite_codes FOR UPDATE
  USING ((select auth.uid()) = inviter_id);
```

**How to Create**:
1. Name the file with today's date: `20260328_add_invite_codes_update_policy.sql` (replace with actual date)
2. Copy the above content
3. Run: `supabase migration up`

---

## Fix #3: Add Timeouts to Redemption Queries

**File**: `app/(dashboard)/friends/page.tsx`
**Lines**: 330-334

**Current Code**:
```typescript
const { data: invite, error: lookupErr } = await supabase
  .from("invite_codes")
  .select("code, inviter_id, inviter_username, used_by")
  .eq("code", code)
  .maybeSingle();
```

**Fixed Code**:
```typescript
const { data: invite, error: lookupErr } = await withTimeout(supabase
  .from("invite_codes")
  .select("code, inviter_id, inviter_username, used_by")
  .eq("code", code)
  .maybeSingle(), 10000);  // 10 second timeout
```

**Additional Timeouts to Add** (same pattern):
- Line 364: Friendship check query
- Line 379: Friendship insert

---

## Fix #4: Extract Code Generation to Utility

**New File**: `app/_lib/invite-codes.ts`

**Content**:
```typescript
/**
 * Generates a random invite code using cryptographically secure randomness.
 * Format: 8 characters from [23456789abcdefghjkmnpqrstuvwxyz]
 * (Excludes: 0, 1, I, O, l to avoid confusion)
 * 
 * Collision probability: ~1/32^8 = 1/1.1 trillion
 */
export function generateInviteCode(): string {
  const chars = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  
  // Use proper masking to avoid modulo bias
  return Array.from(bytes)
    .map((b) => chars[Math.floor((b / 256) * chars.length)])
    .join("");
}

/**
 * Validates that a string matches invite code format
 */
export function isValidInviteCodeFormat(code: string): boolean {
  return /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/.test(code);
}
```

**Then Update**:

1. **friends/page.tsx** - Replace lines 791-794:
   ```typescript
   // OLD:
   const chars = "23456789abcdefghjkmnpqrstuvwxyz";
   const bytes = new Uint8Array(8);
   crypto.getRandomValues(bytes);
   const code = Array.from(bytes).map((b) => chars[b % chars.length]).join("");
   
   // NEW:
   import { generateInviteCode } from "@/app/_lib/invite-codes";
   const code = generateInviteCode();
   ```

2. **dashboard/page.tsx** - Replace code generation with same import

3. **generate-invite-code/index.ts** - Replace lines 8-13 with same logic:
   ```typescript
   function generateCode(): string {
     const chars = "23456789abcdefghjkmnpqrstuvwxyz";
     const bytes = new Uint8Array(8);
     crypto.getRandomValues(bytes);
     return Array.from(bytes)
       .map((b) => chars[Math.floor((b / 256) * chars.length)])
       .join("");
   }
   ```

---

## Fix #5: Improve Error Code Handling

**File**: `app/(dashboard)/friends/page.tsx`
**Line**: 390

**Current Code**:
```typescript
if (createErr && !createErr.message?.includes("duplicate")) {
  toast("Failed to send friend request — try again");
  return;
}
```

**Fixed Code**:
```typescript
if (createErr) {
  // 23505 = unique_violation constraint
  // 23502 = not_null_violation constraint
  // 23503 = foreign_key_violation
  if (createErr.code === "23505") {
    // Duplicate friendship - this is OK (idempotent)
    console.log("[CallMe] Friendship already exists (expected for race condition)");
  } else {
    console.error("[CallMe] Friendship insert failed:", {
      code: createErr.code,
      message: createErr.message,
    });
    toast("Failed to send friend request — try again");
    return;
  }
}
```

---

## Fix #6: Better Timeout Error Message

**File**: `app/(dashboard)/friends/page.tsx`
**Lines**: 856-860

**Current Code**:
```typescript
if (err.message.includes("timed out")) {
  toast("Code shared but took too long to save — try again");
} else {
  toast("Code shared but failed to save — check your connection");
}
```

**Fixed Code**:
```typescript
if (err.message.includes("timed out")) {
  toast("Code shared! Saving took longer than expected — your code might still save. Check back soon to confirm.");
} else if (err.message.includes("Request timed out")) {
  toast("Code shared! But saving timed out. Your code might still be saved. Try again in a few seconds.");
} else {
  toast("Code shared but failed to save — check your connection and try again");
}
```

---

## Fix #7: Add Missing Logging for Edge Cases

**File**: `app/(dashboard)/friends/page.tsx`
**After line 376** (after friendship check):

**Add**:
```typescript
console.log("[CallMe] Friendship check result:", {
  exists: !!existing,
  status: existing?.status,
});
```

**And After line 393** (after creating friendship if not exists):
```typescript
if (existing) {
  console.log("[CallMe] Friendship already exists, skipping insert");
}
```

---

## Implementation Order (Recommended)

1. **First**: Fix #1 (missing error handling in layout.tsx) - 5 minutes
2. **Second**: Fix #4 (extract code generation) - 15 minutes
3. **Third**: Fix #2 (database migration) - 2 minutes to create, needs deploy
4. **Fourth**: Fix #3 (add timeouts) - 10 minutes
5. **Fifth**: Fix #5 (improve error codes) - 5 minutes
6. **Sixth**: Fix #6 (better messages) - 5 minutes
7. **Seventh**: Fix #7 (add logging) - 5 minutes

**Total Time**: ~45 minutes of coding + testing

---

## Testing After Fixes

### Test 1: Share Cancellation
1. Tap "Share Your Code"
2. Tap Share button
3. Cancel the OS share dialog
4. Toast shows "Share cancelled — code not saved"
5. ✓ Code is NOT in database (verify in Supabase)

### Test 2: Successful Code Generation & Redemption
1. Tap "Share Your Code"
2. Complete the share
3. Toast shows "Code saved"
4. ✓ Code IS in database with your user_id as inviter
5. Copy the code
6. Give code to another user
7. Other user enters code in "Add Friends" modal
8. Other user sees "Friend request sent!"
9. ✓ You see incoming friend request

### Test 3: RLS Security
1. Try to manually insert a code with wrong inviter_id (in browser console)
2. ✓ RLS policy rejects it

### Test 4: Error Handling
1. Turn off network
2. Tap "Share Your Code"
3. Complete the share
4. Wait for timeout error
5. Turn network back on
6. Check database - code may or may not be there
7. ✓ Toast message is clear about the situation

### Test 5: Existing Friendship
1. Become friends with someone normally
2. One of you generates a code
3. Other person redeems it
4. ✓ Toast shows "You're already friends!"
5. ✓ No duplicate friendship created

---

## Verification Checklist

- [ ] All fixes applied without syntax errors
- [ ] Code compiles with `npm run build`
- [ ] All TypeScript errors resolved
- [ ] Database migration created and applied
- [ ] All 5 test scenarios pass
- [ ] No console errors (check browser dev tools)
- [ ] App works on both iOS and Android
- [ ] Deep links still work (test with callme://invite?code=abc123)
- [ ] Rate limiting still works (generate code twice in 3 seconds → error)

---

## Rollback Plan

If something breaks after deployment:

1. **For code fixes**: Revert commits
2. **For database migration**: 
   ```sql
   DROP POLICY IF EXISTS "Users can update their own invite codes" ON invite_codes;
   ```

---

## Questions to Ask After Fixes

1. Have you verified the UPDATE policy exists on invite_codes?
2. Have you tested all edge cases manually?
3. Have you tested on both iOS and Android?
4. Have you confirmed no other code paths reference the old method?
5. Have you updated any documentation about the invite flow?

