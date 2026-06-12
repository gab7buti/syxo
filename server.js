const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://syxo-p6tdfc27w-gh25166-8004s-projects.vercel.app/api/discord/callback';

// In-memory database (replace with real DB later)
const profiles = {};

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }
}));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/:slug', (req, res) => {
  const { slug } = req.params;
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// API Routes
app.get('/api/user', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.get('/api/profile/:slug', (req, res) => {
  const { slug } = req.params;
  const profile = profiles[slug];

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(profile);
});

app.post('/api/profile/:slug', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { slug } = req.params;
  const { name, bio, location, activity, instagram, backgroundImage } = req.body;

  profiles[slug] = {
    slug,
    discordId: req.session.user.id,
    username: req.session.user.username,
    name: name || req.session.user.username,
    bio: bio || '',
    location: location || '',
    activity: activity || {},
    instagram: instagram || '',
    backgroundImage: backgroundImage || 'https://cdn.discordapp.com/attachments/1455057018594267235/1514488185609257050/5163c5835cf923d3a54f49ed149d4947.jpg?ex=6a2c3549&is=6a2ae3c9&hm=b82a34b3f65a34c8b5000585f0115edac04bb668b85fce3c3169361fd8759e5d',
    status: 'online',
    createdAt: new Date()
  };

  res.json({ success: true, profile: profiles[slug] });
});

app.get('/api/slugs', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userSlugs = Object.keys(profiles).filter(slug => 
    profiles[slug].discordId === req.session.user.id
  );

  res.json({ slugs: userSlugs });
});

app.get('/api/discord/login', (req, res) => {
  const scopes = ['identify', 'email'];
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes.join('%20')}`;
  res.redirect(discordAuthUrl);
});

app.get('/api/discord/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    });

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const user = userResponse.data;
    req.session.user = user;
    req.session.save(() => {
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Logout failed');
    }
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
