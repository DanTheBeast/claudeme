// Vercel Serverless Function — GET /api/admin-metrics
// Returns aggregate stats for the admin dashboard.

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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const db = supabase();

  const [
    { count: totalUsers },
    { count: availableNow },
    { count: totalFriendships },
    { count: pendingRequests },
    { data: recentUsers },
    { data: signupsByDay },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_available', true),
    db.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
    db.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    // Most recently signed-up users (last 5)
    db.from('profiles')
      .select('id, display_name, email, created_at, profile_picture')
      .order('created_at', { ascending: false })
      .limit(5),
    // Sign-ups grouped by day (last 30 days)
    db.from('profiles')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Group sign-ups by day
  const signupMap = {};
  if (signupsByDay) {
    for (const row of signupsByDay) {
      const day = row.created_at.slice(0, 10);
      signupMap[day] = (signupMap[day] || 0) + 1;
    }
  }

  // Active users: seen in last 7 days
  const { count: activeUsers7d } = await db
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('last_seen', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Users with push notifications enabled
  const { count: pushEnabled } = await db
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('enable_push_notifications', true);

  // Users with at least one friendship (have friends)
  const { data: usersWithFriends } = await db
    .from('friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted');

  const uniqueUsersWithFriends = new Set();
  if (usersWithFriends) {
    for (const f of usersWithFriends) {
      uniqueUsersWithFriends.add(f.user_id);
      uniqueUsersWithFriends.add(f.friend_id);
    }
  }

  return res.status(200).json({
    totalUsers,
    availableNow,
    totalFriendships,
    pendingRequests,
    activeUsers7d,
    pushEnabled,
    usersWithFriends: uniqueUsersWithFriends.size,
    recentUsers: recentUsers || [],
    signupsByDay: signupMap,
  });
}
