// Vercel Serverless Function — GET /api/admin-metrics
// Returns aggregate stats for the admin dashboard.
// Query params:
//   ?signupRange=7|30|90|365|all  (default: 30)
//   ?availRange=1|7|30|365|all    (default: 7)

import { createClient } from '@supabase/supabase-js';

function requireAdmin(req, res) {
  const cookie = req.headers.cookie || '';
  if (!cookie.includes('admin_session=')) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Returns ISO string for N days ago, or null for "all time"
function daysAgo(n) {
  if (!n) return null;
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

// Convert a UTC ISO string to a "YYYY-MM-DD" day key in PST (UTC-8, no DST adjustment — Dan is in PST)
function toPSTDay(isoString) {
  const PST_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC-8
  const d = new Date(new Date(isoString).getTime() - PST_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

// Group an array of ISO strings by day key "YYYY-MM-DD" in PST
function groupByDay(rows, field) {
  const map = {};
  for (const row of rows) {
    const day = toPSTDay(row[field]);
    map[day] = (map[day] || 0) + 1;
  }
  return map;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const db = supabase();

  // Range params
  const signupRangeParam = req.query.signupRange || '30';
  const availRangeParam  = req.query.availRange  || '7';

  const signupDays = signupRangeParam === 'all' ? null : parseInt(signupRangeParam, 10);
  const availDays  = availRangeParam  === 'all' ? null : parseInt(availRangeParam,  10);

  const signupCutoff = daysAgo(signupDays);
  const availCutoff  = daysAgo(availDays);

  // Calculate midnight PST (UTC-8). Vercel runs in UTC so we must do this explicitly.
  const PST_OFFSET_MS = 8 * 60 * 60 * 1000;
  const nowPST = new Date(Date.now() - PST_OFFSET_MS);
  const todayPSTStr = nowPST.toISOString().slice(0, 10); // "YYYY-MM-DD" in PST
  const todayStart = new Date(todayPSTStr + 'T08:00:00.000Z'); // midnight PST = 08:00 UTC

  // Core counts (always current)
  const [
    { count: totalUsers },
    { count: availableNow },
    { count: totalFriendships },
    { count: pendingRequests },
    { count: activeUsers7d },
    { count: pushEnabled },
    { data: recentUsers },
    { data: usersWithFriendsRaw },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_available', true),
    db.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
    db.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('profiles').select('*', { count: 'exact', head: true })
      .gte('last_seen', daysAgo(7)),
    db.from('profiles').select('*', { count: 'exact', head: true })
      .eq('enable_push_notifications', true),
    db.from('profiles')
      .select('id, display_name, email, created_at, profile_picture')
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('friendships').select('user_id, friend_id').eq('status', 'accepted'),
  ]);

  const uniqueUsersWithFriends = new Set();
  if (usersWithFriendsRaw) {
    for (const f of usersWithFriendsRaw) {
      uniqueUsersWithFriends.add(f.user_id);
      uniqueUsersWithFriends.add(f.friend_id);
    }
  }

  // Sign-ups chart data (range-aware)
  let signupQuery = db.from('profiles').select('created_at');
  if (signupCutoff) signupQuery = signupQuery.gte('created_at', signupCutoff);
  const { data: signupRows } = await signupQuery;
  const signupsByDay = groupByDay(signupRows || [], 'created_at');

  // Availability events chart data (range-aware)
  let availQuery = db.from('availability_events').select('occurred_at');
  if (availCutoff) availQuery = availQuery.gte('occurred_at', availCutoff);
  const { data: availRows } = await availQuery;
  const availByDay = groupByDay(availRows || [], 'occurred_at');

  // "Gone available today" scalar
  const { count: availableToday } = await db
    .from('availability_events')
    .select('*', { count: 'exact', head: true })
    .gte('occurred_at', todayStart.toISOString());

  return res.status(200).json({
    totalUsers,
    availableNow,
    availableToday,
    totalFriendships,
    pendingRequests,
    activeUsers7d,
    pushEnabled,
    usersWithFriends: uniqueUsersWithFriends.size,
    recentUsers: recentUsers || [],
    signupsByDay,
    availByDay,
    signupRange: signupRangeParam,
    availRange: availRangeParam,
  });
}
