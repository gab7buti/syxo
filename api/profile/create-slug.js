const mysql = require('mysql2/promise');

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql.shardatabases.app',
  user: process.env.MYSQL_USER || '633735d35b5240ce9e5a8de881e71808',
  password: process.env.MYSQL_PASSWORD || 'snowf1isa',
  database: process.env.MYSQL_DATABASE || 'database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    return createSlug(req, res);
  } else if (req.method === 'GET') {
    return getSlug(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createSlug(req, res) {
  let connection;
  try {
    // Get cookies
    const cookies = parseCookies(req.headers.cookie || '');
    const userId = cookies.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { slug, bio, backgroundUrl } = req.body;

    // Validate slug
    if (!slug || slug.length < 1) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    if (slug.length > 50) {
      return res.status(400).json({ error: 'Slug is too long' });
    }

    // Get database connection
    connection = await pool.getConnection();

    // Check if slug is already taken by another user
    const [existingSlugs] = await connection.execute(
      'SELECT * FROM slugs WHERE slug = ? AND user_id != ?',
      [slug, userId]
    );

    if (existingSlugs.length > 0) {
      return res.status(409).json({ error: 'Slug already taken' });
    }

    // Check if user already has this slug
    const [userSlugs] = await connection.execute(
      'SELECT * FROM slugs WHERE slug = ? AND user_id = ?',
      [slug, userId]
    );

    if (userSlugs.length > 0) {
      // Update existing slug
      await connection.execute(
        'UPDATE slugs SET bio = ?, background_url = ? WHERE slug = ? AND user_id = ?',
        [bio || '', backgroundUrl || '', slug, userId]
      );
    } else {
      // Create new slug
      await connection.execute(
        'INSERT INTO slugs (user_id, slug, bio, background_url) VALUES (?, ?, ?, ?)',
        [userId, slug, bio || '', backgroundUrl || '']
      );
    }

    res.status(200).json({
      success: true,
      slug: {
        slug,
        bio: bio || '',
        backgroundUrl: backgroundUrl || '',
      },
    });
  } catch (error) {
    console.error('Create slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function getSlug(req, res) {
  let connection;
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    // Get database connection
    connection = await pool.getConnection();

    // Get slug data
    const [slugs] = await connection.execute(
      'SELECT s.*, u.username, u.avatar, u.email FROM slugs s JOIN users u ON s.user_id = u.id WHERE s.slug = ?',
      [slug]
    );

    if (slugs.length === 0) {
      return res.status(404).json({ error: 'Slug not found' });
    }

    const slugData = slugs[0];
    res.status(200).json({
      slug: slugData.slug,
      bio: slugData.bio,
      backgroundUrl: slugData.background_url,
      user: {
        id: slugData.user_id,
        username: slugData.username,
        avatar: slugData.avatar ? `https://cdn.discordapp.com/avatars/${slugData.user_id}/${slugData.avatar}.png` : null,
        email: slugData.email,
      },
    });
  } catch (error) {
    console.error('Get slug error:', error);
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
