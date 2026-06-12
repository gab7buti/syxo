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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let connection;
  try {
    // Get cookies
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = cookies.session_id;

    if (sessionId) {
      // Get database connection
      connection = await pool.getConnection();

      // Delete session
      await connection.execute(
        'DELETE FROM sessions WHERE id = ?',
        [sessionId]
      );
    }

    // Clear cookies
    res.setHeader('Set-Cookie', [
      'session_id=; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure',
      'user_id=; Max-Age=0; Path=/; SameSite=Lax; Secure',
    ]);

    res.redirect(302, '/');
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
