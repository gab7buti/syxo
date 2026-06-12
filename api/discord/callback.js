import axios from 'axios';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

const DISCORD_CLIENT_ID = '1514231972686200942';
const DISCORD_CLIENT_SECRET = 'fPN8wxX2YVxekygoUPDySHzYPrSyEqO0';
const REDIRECT_URI = 'https://syxo-gilt.vercel.app/api/discord/callback';

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

  const { code } = req.query;

  if (!code) {
    console.log('No code provided');
    return res.redirect(302, '/?error=no_code');
  }

  let connection;
  try {
    console.log('Exchanging code for token...');
    
    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      {
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('Token received, fetching user...');
    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = userResponse.data;
    const userId = user.id;

    console.log('User authenticated:', userId);

    // Get database connection
    connection = await pool.getConnection();

    // Check if user exists
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      // Create new user
      console.log('Creating new user:', userId);
      await connection.execute(
        'INSERT INTO users (id, username, avatar, email) VALUES (?, ?, ?, ?)',
        [userId, user.username, user.avatar, user.email]
      );
    } else {
      // Update existing user
      console.log('Updating existing user:', userId);
      await connection.execute(
        'UPDATE users SET username = ?, avatar = ?, email = ? WHERE id = ?',
        [user.username, user.avatar, user.email, userId]
      );
    }

    // Create session
    const sessionId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 86400000); // 24 hours

    console.log('Creating session:', sessionId);
    await connection.execute(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      [sessionId, userId, expiresAt]
    );

    // Set cookies with proper flags for Vercel
    const cookieOptions = [
      `session_id=${sessionId}; HttpOnly; Max-Age=86400; Path=/; SameSite=Lax`,
      `user_id=${userId}; Max-Age=86400; Path=/; SameSite=Lax`,
    ];

    console.log('Setting cookies:', cookieOptions);
    res.setHeader('Set-Cookie', cookieOptions);

    // Redirect to dashboard
    console.log('Redirecting to dashboard');
    res.redirect(302, '/dashboard');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.redirect(302, '/?error=oauth_failed');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
