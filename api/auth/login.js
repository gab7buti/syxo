export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');

    res.status(200).json({
        token,
        username,
        message: 'Logged in successfully'
    });
};
