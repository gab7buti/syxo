import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'your-secret-key-change-this';

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
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Get database connection
    connection = await pool.getConnection();

    // Get all slugs for this user
    const [slugs] = await connection.execute(
      'SELECT slug, bio, background_url FROM slugs WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json({
      slugs: slugs.map(s => ({
        slug: s.slug,
        bio: s.bio,
        backgroundUrl: s.background_url,
      })),
    });
  } catch (error) {
    console.error('Get my slugs error:', error);
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
