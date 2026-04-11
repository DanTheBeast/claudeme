# Code Review Quick Reference

## 🎯 Top 5 Critical Issues to Fix NOW

### 1️⃣ Unbounded Realtime Subscription
**File:** `friends/page.tsx:230-236`  
**Fix:** Add filter to Realtime subscription
```typescript
// BEFORE
.on("postgres_changes", { event: "*", table: "friendships" }, ...)

// AFTER
.on("postgres_changes", { 
  event: "*", 
  table: "friendships",
  filter: `or(user_id.eq.${user.id},friend_id.eq.${user.id})`
}, ...)
```
**Time:** 5 min | **Impact:** High | **Difficulty:** Trivial

---

### 2️⃣ State Updates on Unmounted Component
**File:** `friends/page.tsx:181-183`  
**Fix:** Add mounted check before every state update
```typescript
// BEFORE
if (newFriends !== null) setFriends(newFriends);

// AFTER
if (newFriends !== null && isMounted.current) setFriends(newFriends);
```
**Time:** 10 min | **Impact:** High | **Difficulty:** Trivial

---

### 3️⃣ Unhandled Promise in Auth Listener
**File:** `layout.tsx:405-411`  
**Fix:** Wrap profile fetch in try-catch
```typescript
// BEFORE
const { data } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", session.user.id)
  .single();

// AFTER
try {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  if (data) setUser(data as Profile);
} catch (err) {
  console.error("[CallMe] Failed to fetch profile:", err);
  // Don't sign out — let app stay mounted
}
```
**Time:** 15 min | **Impact:** High | **Difficulty:** Easy

---

### 4️⃣ Missing Error Boundary
**File:** `app/error.tsx` (new file)  
**Fix:** Create error boundary
```typescript
'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <button onClick={() => reset()} className="px-4 py-2 bg-blue-500 text-white rounded">
        Try again
      </button>
    </div>
  );
}
```
**Time:** 10 min | **Impact:** High | **Difficulty:** Easy

---

### 5️⃣ Duplicate Invite Code Logic
**File:** `layout.tsx:545-631` and `friends/page.tsx:344-459`  
**Fix:** Extract to shared hook
```typescript
// app/_lib/use-redeem-invite-code.ts
export function useRedeemInviteCode() {
  const { user, toast } = useApp();
  const supabase = useMemo(() => createClient(), []);
  
  return async (code: string) => {
    // Single implementation used everywhere
  };
}

// Use in both places:
const redeemCode = useRedeemInviteCode();
```
**Time:** 90 min | **Impact:** High | **Difficulty:** Medium

---

## 📊 Issue Breakdown by Category

```
CRITICAL (6 issues)    ████████████████████ 33%
HIGH (9 issues)        ███████████████████████ 50%
MEDIUM (8 issues)      ███████████ 17%
LOW (3 issues)         ██ 2%
```

---

## ⚡ Quick Wins (Max 2 hours, fixes 4 issues)

| Issue | File | Lines | Time | Fix Complexity |
|-------|------|-------|------|----------------|
| Add Realtime filter | friends/page.tsx | 230-236 | 5 min | Trivial |
| State update guards | friends/page.tsx | 181-183 | 10 min | Trivial |
| Add error boundary | app/error.tsx | New | 10 min | Easy |
| Fix unhandled promise | layout.tsx | 405-411 | 15 min | Easy |

**Total estimated time: ~1-2 hours**  
**Total impact: Prevents 4 critical issues**

---

## 🔐 Security Issues

| Severity | Issue | File | Fix |
|----------|-------|------|-----|
| 🔴 Critical | Weak origin validation | push-notifications.ts | Validate protocol/hostname |
| 🟠 High | Lenient phone validation | profile/page.tsx | Use libphonenumber-js |
| 🟡 Medium | No CSRF on OAuth | layout.tsx | Add nonce/state param |

---

## 🚀 Next 2 Weeks (Full Fix)

### Week 1: Critical Issues
- [ ] Add Realtime filter (5 min)
- [ ] Fix state updates on unmount (10 min)
- [ ] Add error boundary (10 min)
- [ ] Fix unhandled promise (15 min)
- [ ] Fix push registration race (60 min)
- [ ] Consolidate invite code (90 min)

**Total: 3-4 hours**

### Week 2: High & Medium Issues
- [ ] Implement deep link retry (120 min)
- [ ] Fix timezone sync (30 min)
- [ ] Improve security validation (60 min)
- [ ] Add code splitting (90 min)
- [ ] Refactor large components (240 min)

**Total: 8-10 hours**

---

## 📋 Testing Checklist

After fixes, test:

- [ ] Realtime subscription updates only user's data
- [ ] No console warnings on page unmount
- [ ] Deep links retry on network failure
- [ ] Phone number validation works for various formats
- [ ] Profile image upload with poor connection
- [ ] Invite code works from both locations (modal + friends page)
- [ ] Error boundary catches component errors

---

## 🎓 Key Learnings

**What's Working Well:**
- ✅ Error handling patterns (try-catch-finally)
- ✅ Optimistic UI updates
- ✅ Caching strategy
- ✅ Clean component structure

**What Needs Improvement:**
- ❌ Async state management (unhandled promises)
- ❌ Cleanup functions (incomplete guards)
- ❌ Code duplication (invite logic)
- ❌ Testing (none visible)
- ❌ Error boundaries

---

## 📞 Review Notes

**Codebase Health:** 7.5/10
- Solid fundamentals, but critical async/state issues
- Good UX thinking, needs better error handling
- Maintainable for small team, needs refactoring for scale

**Biggest Risks:**
1. Memory leaks from unbounded subscriptions
2. Silent failures (unhandled promises)
3. Race conditions (push registration, invite code)

**Most Impactful Quick Fix:**
1. Add Realtime filter (prevents bandwidth waste + memory issues)

**Most Important Refactor:**
1. Extract shared invoke code logic (reduces duplication + bugs)

---

## 🔗 Related Documents

- **CODE_REVIEW_COMPREHENSIVE.md** - Full report with all issues and details
- **CODE_REVIEW_SUMMARY.txt** - Executive summary with impact assessment
- **This file** - Quick reference for developers

---

**Generated:** April 11, 2026  
**Reviewer:** Code Review Assistant  
**Status:** Ready for Implementation

