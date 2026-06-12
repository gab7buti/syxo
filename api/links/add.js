export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, url } = req.body;

    if (!title || !url) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    res.status(200).json({
        message: 'Link added successfully',
        link: { title, url }
    });
};
