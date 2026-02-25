// Vercel Serverless Function — POST /api/admin-logout
// Clears the admin session cookie.

export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  return res.status(200).json({ ok: true });
}
