const axios = require('axios');
const crypto = require('crypto');

const DISCORD_CLIENT_ID = '1514231972686200942';
const DISCORD_CLIENT_SECRET = 'fPN8wxX2YVxekygoUPDySHzYPrSyEqO0';
const REDIRECT_URI = 'https://syxo-gilt.vercel.app/api/discord/callback';

// Simple in-memory storage
const users = {};
const sessions = {};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code) {
    return res.redirect(302, '/?error=no_code');
  }

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

    // Store user
    users[userId] = {
      id: userId,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
    };

    // Create session
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions[sessionId] = {
      userId,
      createdAt: Date.now(),
    };

    // Set cookies
    res.setHeader('Set-Cookie', [
      `session_id=${sessionId}; HttpOnly; Max-Age=86400000; Path=/; SameSite=Lax`,
      `user_id=${userId}; Max-Age=86400000; Path=/; SameSite=Lax`,
    ]);

    res.redirect(302, '/dashboard');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.redirect(302, '/?error=oauth_failed');
  }
}

// Export for use in other handlers
export { users, sessions };
