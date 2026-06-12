const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const app = express();

// MySQL connection pool
const pool = mysql.createPool({
  host: 'mysql.shardatabases.app',
  user: '633735d35b5240ce9e5a8de881e71808',
  password: 'snowf1isa',
  database: 'database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database tables
async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create profiles table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        bio TEXT,
        location VARCHAR(255),
        instagram_url VARCHAR(255),
        activity_name VARCHAR(255),
        activity_details VARCHAR(255),
        background_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  } finally {
    connection.release();
  }
}

// Initialize database on startup
initDatabase();

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
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const scope = 'identify email';
  
  const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
  res.redirect(authUrl);
});

app.get('/api/discord/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('/');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, username, avatar, email } = userResponse.data;

    // Save or update user in database
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO users (discord_id, username, avatar, email) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE username = ?, avatar = ?, email = ?`,
        [id, username, avatar, email, username, avatar, email]
      );

      // Get user ID
      const [users] = await connection.execute('SELECT id FROM users WHERE discord_id = ?', [id]);
      const userId = users[0].id;

      req.session.user = {
        id: userId,
        discord_id: id,
        username,
        avatar,
        email
      };

      res.redirect('/dashboard');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.redirect('/?error=oauth_failed');
  }
});

// Get user profiles
app.get('/api/user/profiles', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [profiles] = await connection.execute(
        'SELECT * FROM profiles WHERE user_id = ?',
        [req.session.user.id]
      );
      res.json(profiles);
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update profile
app.post('/api/user/profiles', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { slug, name, bio, location, instagram_url, activity_name, activity_details, background_image_url } = req.body;

  try {
    const connection = await pool.getConnection();
    try {
      const [existing] = await connection.execute(
        'SELECT id FROM profiles WHERE slug = ? AND user_id = ?',
        [slug, req.session.user.id]
      );

      if (existing.length > 0) {
        // Update
        await connection.execute(
          `UPDATE profiles SET name = ?, bio = ?, location = ?, instagram_url = ?, 
           activity_name = ?, activity_details = ?, background_image_url = ? 
           WHERE slug = ? AND user_id = ?`,
          [name, bio, location, instagram_url, activity_name, activity_details, background_image_url, slug, req.session.user.id]
        );
      } else {
        // Insert
        await connection.execute(
          `INSERT INTO profiles (user_id, slug, name, bio, location, instagram_url, activity_name, activity_details, background_image_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.session.user.id, slug, name, bio, location, instagram_url, activity_name, activity_details, background_image_url]
        );
      }

      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public profile
app.get('/api/profile/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const connection = await pool.getConnection();
    try {
      const [profiles] = await connection.execute(
        `SELECT p.*, u.username, u.avatar FROM profiles p 
         JOIN users u ON p.user_id = u.id 
         WHERE p.slug = ?`,
        [slug]
      );

      if (profiles.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json(profiles[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
});
