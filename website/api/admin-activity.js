// Vercel Serverless Function — GET /api/admin-activity
// Returns recent activity: who is currently available, recent sign-ups,
// and pending friend requests — used as the "Activity" tab in admin.

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
    { data: available },
    { data: recentSignups },
    { data: pendingFriendships },
  ] = await Promise.all([
    // Currently available users
    db.from('profiles')
      .select('id, display_name, username, profile_picture, current_mood, last_seen')
      .eq('is_available', true)
      .order('last_seen', { ascending: false }),

    // Signed up in last 7 days
    db.from('profiles')
      .select('id, display_name, email, profile_picture, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20),

    // Pending friend requests
    db.from('friendships')
      .select('id, created_at, user_id, friend_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Enrich pending friend requests with names
  let enrichedPending = [];
  if (pendingFriendships && pendingFriendships.length > 0) {
    const ids = [...new Set(pendingFriendships.flatMap(f => [f.user_id, f.friend_id]))];
    const { data: names } = await db
      .from('profiles')
      .select('id, display_name, profile_picture')
      .in('id', ids);

    const nameMap = Object.fromEntries((names || []).map(n => [n.id, n]));
    enrichedPending = pendingFriendships.map(f => ({
      ...f,
      from: nameMap[f.user_id] || { display_name: 'Unknown' },
      to: nameMap[f.friend_id] || { display_name: 'Unknown' },
    }));
  }

  return res.status(200).json({
    available: available || [],
    recentSignups: recentSignups || [],
    pendingFriendships: enrichedPending,
  });
}
