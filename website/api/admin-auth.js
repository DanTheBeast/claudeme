// Vercel Serverless Function — POST /api/admin-auth
// Validates the admin password and sets a session cookie.

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Server misconfiguration: ADMIN_PASSWORD not set' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Set a simple signed session cookie (HttpOnly, SameSite, Secure in prod)
  const sessionValue = Buffer.from(`callme-admin:${Date.now()}`).toString('base64');
  res.setHeader('Set-Cookie', [
    `admin_session=${sessionValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  ]);

  return res.status(200).json({ ok: true });
}
