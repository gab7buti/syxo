// In-memory storage for slugs
const slugs = {};

export default function handler(req, res) {
  if (req.method === 'POST') {
    return createSlug(req, res);
  } else if (req.method === 'GET') {
    return getSlug(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

function createSlug(req, res) {
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

    // Check if slug is already taken
    if (slugs[slug] && slugs[slug].userId !== userId) {
      return res.status(409).json({ error: 'Slug already taken' });
    }

    // Create or update slug
    slugs[slug] = {
      userId,
      slug,
      bio: bio || '',
      backgroundUrl: backgroundUrl || '',
      createdAt: slugs[slug]?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    res.status(200).json({
      success: true,
      slug: slugs[slug],
    });
  } catch (error) {
    console.error('Create slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function getSlug(req, res) {
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    const slugData = slugs[slug];

    if (!slugData) {
      return res.status(404).json({ error: 'Slug not found' });
    }

    res.status(200).json(slugData);
  } catch (error) {
    console.error('Get slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

export { slugs };
