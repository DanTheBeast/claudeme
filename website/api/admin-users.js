// Vercel Serverless Function — GET /api/admin-users
// Returns all users with profile data. Requires admin session cookie.
// DELETE /api/admin-users?id=<uuid> — deletes a user.

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
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const db = supabase();

    // Fetch all profiles ordered by newest first
    const { data: profiles, error } = await db
      .from('profiles')
      .select('id, email, display_name, username, phone_number, profile_picture, is_available, current_mood, created_at, last_seen, enable_push_notifications')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Count friendships per user
    const { data: friendships } = await db
      .from('friendships')
      .select('user_id, friend_id, status');

    const friendCounts = {};
    if (friendships) {
      for (const f of friendships) {
        if (f.status !== 'accepted') continue;
        friendCounts[f.user_id] = (friendCounts[f.user_id] || 0) + 1;
        friendCounts[f.friend_id] = (friendCounts[f.friend_id] || 0) + 1;
      }
    }

    const result = profiles.map(p => ({
      ...p,
      friend_count: friendCounts[p.id] || 0,
    }));

    return res.status(200).json({ users: result });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const db = supabase();

    // Delete auth user (cascades to profile via FK)
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
