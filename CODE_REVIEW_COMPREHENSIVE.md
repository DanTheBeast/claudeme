# CallMe App - Comprehensive Code Review

**Reviewed Date:** April 11, 2026  
**Review Scope:** Full codebase including layout, pages, components, and utilities  
**Severity Levels:** 🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low

---

## EXECUTIVE SUMMARY

The CallMe app is a well-structured React/Next.js native app built with Capacitor. The codebase demonstrates solid fundamentals with good error handling patterns and thoughtful UX considerations. However, there are **15+ significant issues** across performance, state management, race conditions, and user experience that could impact reliability and user satisfaction.

---

## 1. PERFORMANCE ISSUES

### 1.1 🔴 CRITICAL: Unbounded Realtime Subscription Memory Leak (friends/page.tsx)
**File:** `app/(dashboard)/friends/page.tsx`, lines 230-260  
**Issue:** The Realtime subscription to the `friendships` table doesn't have an event filter. Every friendship change on the entire table fans out to all clients, causing:
- Wasted WebSocket bandwidth for unrelated users' friendship updates
- Potential memory buildup from accumulated events
- Unnecessary re-renders when friends list changes

**Current Code:**
```typescript
const channel = supabase
  .channel(`friends-${user.id}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "friendships",  // ❌ No filter!
    },
    (payload) => { ... }
  )
  .subscribe();
```

**Fix:** Filter to only changes involving the current user:
```typescript
{
  event: "*",
  schema: "public",
  table: "friendships",
  filter: `or(user_id.eq.${user.id},friend_id.eq.${user.id})`
}
```

---

### 1.2 🟠 HIGH: Race Condition in Push Notification Registration (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, lines 232-238 & 266-275  
**Issue:** Push registration happens twice due to dual triggers:
1. After profile load (line 232, 1000ms defer)
2. Fallback retry after 3000ms (line 266)

Both calls can execute simultaneously if timing aligns, causing:
- Duplicate listener registration (memory leak)
- Competing writes to `push_tokens` table
- Wasted Capacitor calls

**Fix:** Use a locking mechanism instead of two independent timers:
```typescript
const pushRegistered = useRef(false);
// Only one path should ever call registerPushNotifications
```

---

### 1.3 🟠 HIGH: Inefficient Profile Query (friends/page.tsx)
**File:** `app/(dashboard)/friends/page.tsx`, lines 129-150  
**Issue:** When loading pending incoming requests, the code fetches friendships, then separately fetches ALL profiles causing inefficiency. Better: use Supabase's `select()` with foreign key expansion if RLS allows it.

---

### 1.4 🟡 MEDIUM: Countdown Timer Accuracy Issue (page.tsx)
**File:** `app/(dashboard)/page.tsx`, lines 242-282  
**Issue:** Countdown updates every 15 seconds, causing visible jumps instead of smooth countdown. Use 1-second intervals for timers under 5 minutes.

---

### 1.5 🟡 MEDIUM: Bundle Size - No Code Splitting (app/layout.tsx)
**File:** `app/layout.tsx` and all pages  
**Issue:** Large components like `FriendCard`, `BottomSheet`, and modals are all imported at the top level rather than lazy-loaded.

---

## 2. CODE QUALITY & BUGS

### 2.1 🔴 CRITICAL: State Update on Unmounted Component (friends/page.tsx)
**File:** `app/(dashboard)/friends/page.tsx`, lines 56, 177-183, 257  
**Issue:** Multiple state updates happen after component unmount. The guard check on line 177 only prevents some updates, not all.

**Fix:** Check `isMounted` before EVERY state update:
```typescript
if (newFriends !== null && isMounted.current) setFriends(newFriends);
if (newPending !== null && isMounted.current) setPendingRequests(newPending);
if (newOutgoing !== null && isMounted.current) setOutgoingRequests(newOutgoing);
```

---

### 2.2 🔴 CRITICAL: Unhandled Promise Rejection in Realtime (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, lines 388-420  
**Issue:** `onAuthStateChange` has unhandled promise chain when fetching profile. If the query fails, the error is swallowed and user becomes null, logging the user out silently.

**Fix:** Wrap in try-catch:
```typescript
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
}
```

---

### 2.3 🟠 HIGH: Race Condition in Invite Code Redemption (friends/page.tsx)
**File:** `app/(dashboard)/friends/page.tsx`, lines 344-459  
**Issue:** `redeemInviteCode()` checks a flag before setting it, allowing double-clicks. Set flag BEFORE async work.

---

### 2.4 🟠 HIGH: Shared Supabase Client Memoization Issue (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, line 137  
**Issue:** While `useMemo(() => createClient(), [])` is used, `createClient()` returns a shared global instance. Document this clearly.

---

### 2.5 🟡 MEDIUM: Missing Error Boundary (app/layout.tsx)
**File:** `app/layout.tsx` and `app/(dashboard)/layout.tsx`  
**Issue:** No `<ErrorBoundary>` component. If any child throws an error, entire app crashes.

**Add a root error boundary:** Create `app/error.tsx`

---

### 2.6 🟡 MEDIUM: Stale Timezone Sync Fire-and-Forget (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, lines 177-197  
**Issue:** Timezone sync is fire-and-forget IIFE with no error handling outside the inner try-catch. Add explicit `.catch(() => {})`.

---

### 2.7 🟡 MEDIUM: Optimistic Update Doesn't Handle Partial Reverts (page.tsx)
**File:** `app/(dashboard)/page.tsx`, lines 284-312  
**Issue:** When toggling availability, optimistic state can cause UI flicker if Realtime update arrives during revert.

---

## 3. USER EXPERIENCE ISSUES

### 3.1 🔴 CRITICAL: No Retry Logic for Failed Deep Links (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, lines 335-383  
**Issue:** Deep link handling doesn't retry on failure. If `setSession()` or `fetchProfile()` fails, error is swallowed.

**Fix:** Implement exponential backoff retry with user notification.

---

### 3.2 🟠 HIGH: Invite Code Modal Dismissed Without Feedback (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, lines 518-647  
**Issue:** Modal has inconsistent feedback paths. X button and "Skip" close silently; user can't reopen without reload.

**Better UX:** Add button in empty state, show toast when skipped.

---

### 3.3 🟡 MEDIUM: Loading State Not Shown During First Load (friends/page.tsx)
**File:** `app/(dashboard)/friends/page.tsx`, lines 197-214  
**Issue:** Cache is loaded immediately, preventing loading skeletons. If load times out, stale data shows without indication.

---

### 3.4 🟡 MEDIUM: No Indication of Pending Unsaved Changes (profile/page.tsx)
**File:** `app/(dashboard)/profile/page.tsx`, lines 96-101, 125-184  
**Issue:** Profile fields auto-save on blur. If user navigates away before blur, changes are lost silently.

---

### 3.5 🟡 MEDIUM: Confusing Invite Code UI Duplication (layout.tsx + friends/page.tsx)
**File:** `app/(dashboard)/layout.tsx` lines 516-647 & `app/(dashboard)/friends/page.tsx` lines 732-937  
**Issue:** Invite code redemption appears in TWO places with different implementations.

---

## 4. ARCHITECTURE & MAINTAINABILITY

### 4.1 🔴 CRITICAL: Duplicate Invite Code Logic (layout.tsx + friends/page.tsx)
**File:** `app/(dashboard)/layout.tsx` lines 545-631 vs `app/(dashboard)/friends/page.tsx` lines 344-459  
**Issue:** Entire invite code redemption flow is duplicated. Changes to one require changes to the other.

**Refactor:** Extract to shared hook `useRedeemInviteCode()`.

---

### 4.2 🟠 HIGH: Realtime Subscription Cleanup Bug (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, lines 423-486  
**Issue:** Profile Realtime channel cleanup doesn't properly unsubscribe if promise is still pending.

---

### 4.3 🟠 HIGH: Time Zone Conversion Too Simplistic (schedule/page.tsx)
**File:** `app/(dashboard)/schedule/page.tsx`, lines 46-89  
**Issue:** `convertTimeToLocal()` only works on today's date, doesn't account for DST transitions. Use `date-fns-tz` instead.

---

### 4.4 🟡 MEDIUM: Hard-coded Paths in Push Notification Handler (push-notifications.ts)
**File:** `app/_lib/push-notifications.ts`, lines 137-164  
**Issue:** Deep link paths are hard-coded. When new routes are added, this must be manually updated.

---

### 4.5 🟡 MEDIUM: Cache Invalidation Too Simplistic (cache.ts)
**File:** `app/_lib/cache.ts`, lines 68-82  
**Issue:** `cacheClear()` iterates all localStorage keys. Better: maintain set of cache keys per user.

---

### 4.6 🟡 MEDIUM: No Separation of Concerns in Page Components
**File:** `app/(dashboard)/friends/page.tsx` (1,034 lines)  
**Issue:** File mixes data fetching, state management, UI rendering, handlers, and modals. Refactor into hooks and components.

---

## 5. SECURITY & BEST PRACTICES

### 5.1 🔴 CRITICAL: Weak Origin Validation in Deep Link Handler (push-notifications.ts)
**File:** `app/_lib/push-notifications.ts`, lines 145-156  
**Issue:** `window.location.origin` on Capacitor is `capacitor://localhost`, which could be spoofed. Better: explicitly validate protocol and hostname.

---

### 5.2 🟠 HIGH: Lenient Phone Number Validation (profile/page.tsx)
**File:** `app/(dashboard)/profile/page.tsx`, lines 136-148  
**Issue:** Validation allows `+123456789` (only 9 digits). Use `libphonenumber-js` library.

---

### 5.3 🟡 MEDIUM: No CSRF Protection on Deep Links (layout.tsx)
**File:** `app/(dashboard)/layout.tsx`, lines 373-379  
**Issue:** OAuth callback assumes ANY URL with access token is legitimate. Use nonce/state parameter.

---

## 6. SPECIFIC LINE-BY-LINE ISSUES

### 6.1 friends/page.tsx - Line 267-290 (acceptRequest)
Toast appears before DB write completes. Delay until AFTER `loadData()` succeeds.

### 6.2 friends/page.tsx - Line 760-770 (Input debouncing)
Debounce doesn't clear on unmount. Add cleanup in useEffect.

### 6.3 page.tsx - Line 179-180 (Cache seeding)
Cache expiry only applies once at load. Old availability data can persist too long.

### 6.4 profile/page.tsx - Line 213 (Upload with Promise.race)
Use `AbortController` instead of Promise.race for timeouts.

---

## 7. MISSING FEATURES / QUICK WINS

### 7.1 🟢 LOW: No Toast for Network Reconnection
Add: `window.addEventListener("online", () => { toast("Back online — syncing..."); })`

### 7.2 🟢 LOW: No Loading States for Friend Request Actions
Add disabled state and spinner to accept/decline/cancel buttons.

### 7.3 🟢 LOW: No Retry Logic for Failed Friendship Operations
Keep rejected request visible with retry button.

---

## SUMMARY TABLE

| Issue | File | Line(s) | Severity | Category |
|-------|------|---------|----------|----------|
| Unbounded Realtime subscription | friends/page.tsx | 230-260 | 🔴 Critical | Performance |
| Push registration race | layout.tsx | 232-238, 266-275 | 🟠 High | Performance |
| Inefficient profile queries | friends/page.tsx | 129-150 | 🟠 High | Performance |
| State updates on unmount | friends/page.tsx | 56-257 | 🔴 Critical | Code Quality |
| Unhandled promise in Realtime | layout.tsx | 388-420 | 🔴 Critical | Code Quality |
| Invite code double-click race | friends/page.tsx | 344-459 | 🟠 High | Code Quality |
| No error boundary | layout.tsx | App root | 🟡 Medium | Code Quality |
| No retry for deep links | layout.tsx | 335-383 | 🔴 Critical | UX |
| Invite modal dismissed silently | layout.tsx | 518-647 | 🟠 High | UX |
| Duplicate invite code logic | layout.tsx + friends/page.tsx | Multiple | 🔴 Critical | Architecture |
| Realtime cleanup bug | layout.tsx | 423-486 | 🟠 High | Architecture |
| Time zone conversion issues | schedule/page.tsx | 46-89 | 🟠 High | Architecture |
| Weak origin validation | push-notifications.ts | 145-156 | 🔴 Critical | Security |
| Lenient phone validation | profile/page.tsx | 136-148 | 🟠 High | Security |

---

## RECOMMENDED FIXES (Priority Order)

### Phase 1: Critical (This Sprint)
1. ✅ Add Realtime subscription filter (1-2 lines, high impact)
2. ✅ Fix state updates on unmount (friends/page.tsx: 5 lines)
3. ✅ Add error boundary (app/error.tsx: ~15 lines)
4. ✅ Consolidate invite code logic (extract hook: ~50 lines)

### Phase 2: High (Next Sprint)
1. Fix push registration race condition
2. Implement retry for deep links
3. Add origin validation rigor
4. Improve phone number validation

### Phase 3: Medium (Backlog)
1. Implement countdown timer fix
2. Add loading states for request actions
3. Refactor profile page
4. Extract data hooks from pages

---

## TESTING RECOMMENDATIONS

### Unit Tests Needed
- `withTimeout()` edge cases
- Time conversion with various timezones
- Cache lifecycle
- Phone number validation

### Integration Tests Needed
- Realtime subscription lifecycle
- Push notification registration
- Deep link handling
- Auth state transitions

### E2E Tests Needed
- Invite code flow
- Friend request lifecycle
- Availability toggle with network latency
- Profile image upload with poor connection

---

## CONCLUSION

The CallMe codebase is **well-structured and thoughtful**, with good error handling patterns and UX considerations. However, **critical issues around state management, unhandled promises, and security** need immediate attention before production deployment. The code is maintainable for a small team, but larger refactors will be needed as complexity grows.

**Estimated Fix Time:** ~2-3 weeks for all critical and high-priority items.

