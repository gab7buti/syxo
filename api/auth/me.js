import mysql from 'mysql2/promise';

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql.shardatabases.app',
  user: process.env.MYSQL_USER || '633735d35b5240ce9e5a8de881e71808',
  password: process.env.MYSQL_PASSWORD || 'snowf1isa',
  database: process.env.MYSQL_DATABASE || 'database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let connection;
  try {
    // Get cookies
    const cookies = parseCookies(req.headers.cookie || '');
    const userId = cookies.user_id;
    const sessionId = cookies.session_id;

    console.log('Auth check - userId:', userId, 'sessionId:', sessionId, 'cookies:', req.headers.cookie);

    if (!userId || !sessionId) {
      console.log('Missing userId or sessionId');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get database connection
    connection = await pool.getConnection();

    // Check if session is valid
    const [sessions] = await connection.execute(
      'SELECT * FROM sessions WHERE id = ? AND user_id = ? AND expires_at > NOW()',
      [sessionId, userId]
    );

    if (sessions.length === 0) {
      console.log('Session not found or expired');
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    // Get user info
    const [users] = await connection.execute(
      'SELECT id, username, avatar, email FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      console.log('User not found');
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];
    console.log('User authenticated:', user.username);
    
    res.status(200).json({
      id: user.id,
      username: user.username,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      email: user.email,
    });
  } catch (error) {
    console.error('Auth check error:', error.message, error.code);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
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
