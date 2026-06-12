const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// In-memory storage
const users = {};
const profiles = {};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SECRET_KEY || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Discord OAuth endpoints
app.get('/api/discord/login', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/discord/callback`;
  const scope = 'identify email';
  
  console.log(`🔐 Login initiated. Client ID: ${clientId}, Redirect URI: ${redirectUri}`);
  
  const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
  res.redirect(authUrl);
});

app.get('/api/discord/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error(`❌ Discord OAuth error: ${error}`);
    return res.redirect('/?error=discord_denied');
  }
  
  if (!code) {
    console.error('❌ No code received from Discord');
    return res.redirect('/?error=no_code');
  }

  try {
    console.log('🔄 Callback received. Exchanging code for token...');
    console.log(`Code: ${code.substring(0, 20)}...`);
    
    const redirectUri = `${req.protocol}://${req.get('host')}/api/discord/callback`;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    
    console.log(`Client ID: ${clientId}`);
    console.log(`Client Secret: ${clientSecret ? '***' : 'MISSING'}`);
    console.log(`Redirect URI: ${redirectUri}`);
    
    if (!clientId || !clientSecret) {
      throw new Error('Missing Discord credentials in environment variables');
    }
    
    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    console.log('✅ Token received from Discord');
    const { access_token } = tokenResponse.data;

    // Get user info
    console.log('🔄 Fetching user info from Discord...');
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, username, avatar, email } = userResponse.data;
    console.log(`✅ User fetched: ${username} (${id})`);

    // Save user in memory
    users[id] = {
      id,
      discord_id: id,
      username,
      avatar,
      email
    };

    req.session.user = users[id];
    console.log('✅ Session created');

    res.redirect('/dashboard');
  } catch (error) {
    console.error('❌ OAuth error:');
    console.error(`Error message: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
    res.redirect('/?error=oauth_failed');
  }
});

// Get user profiles
app.get('/api/user/profiles', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userProfiles = Object.values(profiles).filter(p => p.user_id === req.session.user.id);
  res.json(userProfiles);
});

// Create/Update profile
app.post('/api/user/profiles', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { slug, name, bio, location, instagram_url, activity_name, activity_details, background_image_url } = req.body;

  profiles[slug] = {
    id: slug,
    user_id: req.session.user.id,
    slug,
    name,
    bio,
    location,
    instagram_url,
    activity_name,
    activity_details,
    background_image_url
  };

  res.json({ success: true });
});

// Get public profile
app.get('/api/profile/:slug', (req, res) => {
  const { slug } = req.params;
  const profile = profiles[slug];

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const user = users[Object.keys(users).find(key => users[key].id === profile.user_id)];
  res.json({ ...profile, username: user?.username, avatar: user?.avatar });
});

// Logout
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Check auth status
app.get('/api/auth/me', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}/`);
  console.log(`Discord Client ID: ${process.env.DISCORD_CLIENT_ID}`);
  console.log(`Discord Client Secret: ${process.env.DISCORD_CLIENT_SECRET ? '***' : 'MISSING'}`);
});
