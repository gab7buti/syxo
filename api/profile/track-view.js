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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let connection;
  try {
    const { slug } = req.body;

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    // Get database connection
    connection = await pool.getConnection();

    // Get slug and increment view count
    const [slugs] = await connection.execute(
      'SELECT * FROM slugs WHERE slug = ?',
      [slug]
    );

    if (slugs.length === 0) {
      return res.status(404).json({ error: 'Slug not found' });
    }

    // Increment view count
    await connection.execute(
      'UPDATE slugs SET view_count = view_count + 1 WHERE slug = ?',
      [slug]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
