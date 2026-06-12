const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Hardcoded Discord credentials
const DISCORD_CLIENT_ID = '1514231972686200942';
const DISCORD_CLIENT_SECRET = 'fPN8wxX2YVxekygoUPDySHzYPrSyEqO0';
const REDIRECT_URI = 'https://syxo-gilt.vercel.app/api/discord/callback';

// In-memory storage for demo
const users = {};
const profiles = {};

// OAuth login endpoint
app.get('/discord/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000 });
  
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;
  res.json({ authUrl });
});

// OAuth callback
app.get('/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    console.log('Exchanging code for token...');
    
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

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
    res.cookie('session_id', sessionId, { httpOnly: true, maxAge: 86400000 });
    res.cookie('user_id', userId, { maxAge: 86400000 });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.redirect('/?error=oauth_failed');
  }
});

// Get current user
app.get('/auth/me', (req, res) => {
  const userId = req.cookies.user_id;
  if (!userId || !users[userId]) {
    return res.json({ user: null });
  }
  res.json({ user: users[userId] });
});

// Get user profiles
app.get('/user/profiles', (req, res) => {
  const userId = req.cookies.user_id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userProfiles = Object.values(profiles).filter(p => p.userId === userId);
  res.json({ profiles: userProfiles });
});

// Create/update profile
app.post('/user/profiles', (req, res) => {
  const userId = req.cookies.user_id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { slug, name, bio, location, instagram, activity, background } = req.body;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  profiles[slug] = {
    slug,
    userId,
    name: name || users[userId].username,
    bio: bio || '',
    location: location || '',
    instagram: instagram || '',
    activity: activity || { name: '', details: '' },
    background: background || '',
    createdAt: new Date(),
  };

  res.json({ profile: profiles[slug] });
});

// Get public profile
app.get('/profile/:slug', (req, res) => {
  const { slug } = req.params;
  const profile = profiles[slug];

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const user = users[profile.userId];
  res.json({
    profile: {
      ...profile,
      user: {
        username: user.username,
        avatar: user.avatar,
      },
    },
  });
});

// Logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie('session_id');
  res.clearCookie('user_id');
  res.json({ success: true });
});

module.exports = app;
