export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get cookies
    const cookies = parseCookies(req.headers.cookie || '');
    const userId = cookies.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get all slugs for this user
    // In a real app, this would query a database
    // For now, we'll return an empty array
    const userSlugs = [];

    res.status(200).json({
      slugs: userSlugs,
    });
  } catch (error) {
    console.error('Get my slugs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}
