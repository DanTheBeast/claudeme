# CallMe Invite Code System - Quick Summary

## Status: NOT READY FOR SUBMISSION (Medium Risk)

## Critical Issues Found: 5
## High Priority Issues: 6
## Medium Priority Issues: 7

---

## Must Fix Before Submission

### 1. ❌ CRITICAL - Missing Error Handling in layout.tsx:579-582
```typescript
// WRONG: Fire-and-forget update
await supabase
  .from("invite_codes")
  .update({ used_by: user.id, used_at: new Date().toISOString() })
  .eq("code", code);

// RIGHT: Check for errors
const { error: markErr } = await supabase
  .from("invite_codes")
  .update({ used_by: user.id, used_at: new Date().toISOString() })
  .eq("code", code);

if (markErr) {
  console.error("[CallMe] failed to mark code as used:", markErr);
}
```
**Impact**: Code marked used but friendship not created → inviter never sees request

---

### 2. ⚠️ CRITICAL - No UPDATE Policy on invite_codes Table
**Verification Required**: 
```sql
SELECT * FROM pg_policies WHERE tablename='invite_codes';
```
Must show an UPDATE policy. If missing, create it:
```sql
CREATE POLICY "Users can mark their own codes as used"
  ON invite_codes FOR UPDATE
  USING (auth.uid() = inviter_id);
```
**Impact**: Silent insert failures possible

---

### 3. ❌ HIGH - No Timeouts on Redemption Queries
**Problem**: friends/page.tsx lines 330-334 can hang indefinitely
```typescript
// WRONG: No timeout
const { data: invite, error: lookupErr } = await supabase
  .from("invite_codes")
  .select(...)
  .eq("code", code)
  .maybeSingle();

// RIGHT: Add timeout
const { data: invite, error: lookupErr } = await withTimeout(supabase
  .from("invite_codes")
  .select(...)
  .eq("code", code)
  .maybeSingle(), 10000);  // 10 second timeout
```

---

### 4. ❌ HIGH - Duplicate Code Generation
**Locations**: 3 separate places generate codes (maintenance nightmare)
1. friends/page.tsx:791-794
2. dashboard/page.tsx
3. generate-invite-code/index.ts:8-13

**Fix**: Create `/app/_lib/invite-codes.ts`:
```typescript
export function generateInviteCode(): string {
  const chars = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[Math.floor((b / 256) * chars.length)])
    .join("");
}
```

---

### 5. ❌ HIGH - Fragile Error Matching
**Problem**: friends/page.tsx:390 uses string matching
```typescript
// WRONG: Fragile string matching
if (!createErr.message?.includes("duplicate"))

// RIGHT: Use error codes
if (createErr?.code !== "23505")  // 23505 = unique violation
```

---

## Should Fix Before Submission

### 1. ⚠️ CRITICAL - Network Insert Continues After Timeout
**Scenario**: 
- Insert times out at 30s → toast shows error
- Server processes insert at 35s → code is saved
- User thinks it failed and taps "Share" again
- Second insert violates constraint

**Cause**: withTimeout() only affects frontend, not network request
**Not Fixable**: Requires server-side verification on redemption
**Workaround**: Better toast message: "Code might be saving, check back soon"

---

### 2. ❌ Inconsistent Error Handling Between Code Paths
layout.tsx lines 578-583 MISSING error handling on mark-as-used
friends/page.tsx lines 399-402 HAS error handling on mark-as-used

Both code paths should be identical (they were unified in commit 63ed3cb)

---

## Test Checklist

Before submission, test these scenarios:

- [ ] **Share Cancellation**: Tap Share → cancel dialog → code NOT saved to DB
- [ ] **Timeout During Insert**: Disconnect network, tap Share, wait 35s, reconnect → check if code exists in DB
- [ ] **RLS Security**: Try to insert code with wrong inviter_id → should fail
- [ ] **Code Redemption**: Enter valid code → creates friendship, marks code as used
- [ ] **Race Condition**: Two users redeem same code simultaneously → first succeeds, second gets duplicate error
- [ ] **Existing Friendship**: Try to redeem code from someone you're already friends with → shows "already friends" message
- [ ] **Own Code**: Try to redeem your own code → shows "that's your own code" message
- [ ] **Invalid Code**: Try to redeem fake code → shows "code not found"

---

## Risk Assessment

### Current State (Before Fixes): 6/10
- Most users will succeed
- Some users will see confusing errors
- Support tickets will come in

### After Must-Fix Items: 8/10
- Edge cases still exist (timeout race condition)
- But critical path is solid
- Very few support tickets expected

### After Should-Fix Items: 9/10
- Handles nearly all edge cases
- Robust error handling
- Minimal support burden

---

## Files That Need Changes

| File | Issue | Line(s) | Priority |
|------|-------|---------|----------|
| app/(dashboard)/layout.tsx | Missing error handling on mark-as-used | 579-582 | CRITICAL |
| app/(dashboard)/friends/page.tsx | Missing timeouts on queries | 330-334 | CRITICAL |
| app/(dashboard)/friends/page.tsx | Duplicate code generation | 791-794 | HIGH |
| app/(dashboard)/friends/page.tsx | Fragile error matching | 390 | HIGH |
| app/_lib/invite-codes.ts | NEW FILE needed | - | HIGH |
| supabase/migrations/ | NEW FILE for UPDATE policy | - | CRITICAL |

---

## Time Estimate

- **Must Fix**: 1-2 hours
- **Should Fix**: 30 minutes
- **Testing**: 1 hour
- **Total**: ~2.5-3 hours

---

## Blockers for Submission

1. ✅ Share cancellation handling - FIXED by commit 96e00c8
2. ✅ Timeout increased to 30s - FIXED by commit 5ab73c6  
3. ✅ Username validation - FIXED by commit 5ab73c6
4. ❌ Missing error handling in layout.tsx - NOT FIXED
5. ❌ UPDATE policy verification - NOT VERIFIED
6. ❌ Missing timeouts on queries - NOT FIXED
7. ❌ Duplicate code generation - NOT FIXED

**4 out of 7 blockers not yet addressed**

