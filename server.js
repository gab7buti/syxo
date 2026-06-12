const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/discord/callback';

// Profile data
const profiles = {
  s: {
    name: "unchxky",
    username: "unchxky",
    bio: "Se você fizor o seu milhão, não precisará se preocupar com o fracasso.",
    location: "silver city - los angeles",
    discordId: "1360448166809436384",
    status: "online",
    activity: {
      name: "Escutando música",
      details: "Vibes"
    },
    instagram: "https://instagram.com/unchiclyy",
    backgroundImage: "https://cdn.discordapp.com/attachments/1455057018594267235/1514488185609257050/5163c5835cf923d3a54f49ed149d4947.jpg?ex=6a2c3549&is=6a2ae3c9&hm=b82a34b3f65a34c8b5000585f0115edac04bb668b85fce3c3169361fd8759e5d"
  },
  f: {
    name: "fertilizai",
    username: "fertilizai",
    bio: "Cultivando sucesso 🌱",
    location: "Brasil",
    discordId: "1455044487784042625",
    status: "online",
    activity: {
      name: "Trabalhando",
      details: "Crescendo"
    },
    instagram: "https://instagram.com/fertilizai",
    backgroundImage: "https://cdn.discordapp.com/attachments/1455057018594267235/1514488185609257050/5163c5835cf923d3a54f49ed149d4947.jpg?ex=6a2c3549&is=6a2ae3c9&hm=b82a34b3f65a34c8b5000585f0115edac04bb668b85fce3c3169361fd8759e5d"
  }
};

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Routes
app.get('/', (req, res) => {
  res.redirect('/s');
});

app.get('/:slug', (req, res) => {
  const { slug } = req.params;
  const profile = profiles[slug];

  if (!profile) {
    return res.status(404).send('Profile not found');
  }

  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/api/profile/:slug', (req, res) => {
  const { slug } = req.params;
  const profile = profiles[slug];

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(profile);
});

app.get('/api/discord/login', (req, res) => {
  const scopes = ['identify', 'email'];
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes.join('%20')}`;
  res.redirect(discordAuthUrl);
});

app.get('/api/discord/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const user = userResponse.data;
    req.session.user = user;

    res.redirect('/');
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/user', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}/s`);
});

module.exports = app;
