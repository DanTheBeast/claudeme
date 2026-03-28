# RLS (Row-Level Security) Best Practices for CallMe

## Golden Rule
**Never use a subquery in an RLS policy that reads from the same table the policy protects.**

This causes infinite recursion when Postgres tries to evaluate the policy during INSERT/UPDATE operations.

### ❌ WRONG - Causes Recursion
```sql
CREATE POLICY "limit outgoing pending requests"
ON public.friendships
FOR INSERT
WITH CHECK (
  (SELECT COUNT(*) FROM public.friendships 
   WHERE user_id = (SELECT auth.uid()))
  < 20
);
```

The policy tries to count friendships DURING a friendships INSERT, which causes infinite recursion.

### ✅ CORRECT - Use a Trigger Instead
```sql
CREATE OR REPLACE FUNCTION check_friendship_request_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.friendships 
      WHERE user_id = NEW.user_id AND status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'User has reached the maximum number of pending friend requests (20)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_friendship_request_limit_trigger
BEFORE INSERT ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION check_friendship_request_limit();
```

## Pattern: Complex Validation

### When to Use
- Counting/aggregating logic (rate limits, quotas)
- Complex business rules that can't be expressed as simple equality checks
- Data consistency rules that depend on other rows

### Solution: Use Triggers
Triggers execute AFTER RLS checks, avoiding recursion. This is the correct pattern for:
1. Rate limiting (max N pending requests, max N windows created)
2. Quota enforcement (storage limits, API call limits)
3. Complex business rules

## Pattern: Simple Checks

### OK to Use in RLS
- `auth.uid() = user_id` (ownership check)
- `true` (public read)
- `false` (deny all)
- Simple comparisons to `auth.uid()`

### Example
```sql
-- ✅ Safe: Just checks auth ID
CREATE POLICY "Users can create friendships"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ✅ Safe: Prevents self-requests
CREATE POLICY "no self friend requests"
ON public.friendships FOR INSERT
WITH CHECK ((SELECT auth.uid()) != friend_id);
```

## Audit Checklist

When adding new RLS policies, ask:
- [ ] Does this policy SELECT FROM the same table it protects? **→ Use trigger instead**
- [ ] Does this policy use COUNT/aggregate functions? **→ Use trigger instead**
- [ ] Is this just a simple equality check? **→ RLS is fine**
- [ ] Does this need to access other tables? **→ Evaluate carefully, likely needs trigger**

## Error Signs

If you see this error:
```
infinite recursion detected in policy for relation "table_name"
```

You have a recursive RLS policy. **Replace with a trigger immediately.**

## Current State

### ✅ Triggers in Use
- `check_friendship_request_limit_trigger` - Max 20 pending friend requests
- `check_friendship_request_limit` - Rate limit enforcement

### ✅ Safe RLS Policies
- `Users can insert their own invite codes` - Checks auth.uid() = inviter_id
- `no self friend requests` - Checks auth.uid() != friend_id
- `Anyone can read invite codes` - Public read (SELECT true)
- All friendship view policies - Simple ownership checks

### ⚠️ To Add (as triggers, not RLS)
- Rate limit on availability windows (max 50 per user)
- Any other counting/quota-based rules

