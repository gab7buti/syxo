import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: 'mysql.shardatabases.app',
    user: '633735d35b5240ce9e5a8de881e71808',
    password: 'snowf1isa',
    database: 'database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, state } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Missing code' });
    }

    try {
        // Exchange code for token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: '1514231972686200942',
                client_secret: 'fPN8wxX2YVxekygoUPDySHzYPrSyEqO0',
                grant_type: 'authorization_code',
                code,
                redirect_uri: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/auth/discord-callback`
            })
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Get user info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const discordUser = await userResponse.json();

        // Save to MySQL
        const connection = await pool.getConnection();
        
        try {
            const [existing] = await connection.query(
                'SELECT * FROM users WHERE discord_id = ?',
                [discordUser.id]
            );

            let user;
            if (existing.length > 0) {
                user = existing[0];
                await connection.query(
                    'UPDATE users SET username = ?, avatar = ?, updated_at = NOW() WHERE discord_id = ?',
                    [discordUser.username, discordUser.avatar, discordUser.id]
                );
            } else {
                await connection.query(
                    'INSERT INTO users (discord_id, username, avatar, email) VALUES (?, ?, ?, ?)',
                    [discordUser.id, discordUser.username, discordUser.avatar, discordUser.email]
                );
                const [newUser] = await connection.query(
                    'SELECT * FROM users WHERE discord_id = ?',
                    [discordUser.id]
                );
                user = newUser[0];
            }

            // Create JWT token
            const token = Buffer.from(JSON.stringify({
                userId: user.id,
                discordId: discordUser.id,
                username: discordUser.username
            })).toString('base64');

            res.redirect(`/dashboard?token=${token}`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
