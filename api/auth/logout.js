export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Clear cookies
    res.setHeader('Set-Cookie', [
      'session_id=; HttpOnly; Max-Age=0; Path=/',
      'user_id=; Max-Age=0; Path=/',
    ]);

    res.redirect(302, '/');
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
