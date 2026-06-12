// Simple in-memory user storage (in production, use a database)
const users = {};
const sessions = {};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get cookies
    const cookies = parseCookies(req.headers.cookie || '');
    const userId = cookies.user_id;
    const sessionId = cookies.session_id;

    if (!userId || !sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user exists
    if (!users[userId]) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[userId];
    res.status(200).json({
      id: user.id,
      username: user.username,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      email: user.email,
    });
  } catch (error) {
    console.error('Auth check error:', error);
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

// Export for use in other handlers
export { users, sessions };
