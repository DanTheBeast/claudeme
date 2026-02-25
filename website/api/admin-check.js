// Vercel Serverless Function — GET /api/admin-check
// Checks if the admin session cookie is valid.

export default function handler(req, res) {
  const cookie = req.headers.cookie || '';
  const hasSession = cookie.includes('admin_session=');

  if (!hasSession) {
    return res.status(401).json({ ok: false });
  }

  return res.status(200).json({ ok: true });
}
