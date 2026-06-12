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
    // Get token from Authorization header or localStorage (passed in body)
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    console.log('Auth check - token:', token ? 'present' : 'missing');

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    console.log('Token verified for user:', userId);

    // Get database connection
    connection = await pool.getConnection();

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
    res.status(200).json({
      id: user.id,
      username: user.username,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      email: user.email,
    });
  } catch (error) {
    console.error('Auth check error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
