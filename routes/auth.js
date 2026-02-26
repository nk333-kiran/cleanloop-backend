const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(
    "868285590975-ca7vgqrb7evl94cdtimd8ikss54j8fpa.apps.googleusercontent.com"
);

const formatUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(u.name),
    totalPoints: u.total_points || 0,
    level: u.level || 1,
    levelProgress: u.level_progress || 0
});

// Register
router.post("/register", async (req, res) => {
    const { name, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = await pool.query(
            "INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING *",
            [name, email, hashedPassword, role || "user"]
        );

        const token = jwt.sign(
            { id: newUser.rows[0].id, role: newUser.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token, user: formatUser(newUser.rows[0]) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await pool.query(
        "SELECT * FROM users WHERE email=$1",
        [email]
    );

    if (user.rows.length === 0)
        return res.status(400).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(
        password,
        user.rows[0].password
    );

    if (!validPassword)
        return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
        { id: user.rows[0].id, role: user.rows[0].role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    res.json({ token, user: formatUser(user.rows[0]) });
});

// Google Login
router.post("/google", async (req, res) => {
    const { token } = req.body;

    try {
        let payload;

        if (token === "demo-expo-google-token") {
            // Bypass Google validation for Expo Go local testing
            payload = {
                email: "demo.cleanloop@gmail.com",
                name: "Google Demo User",
                picture: "https://ui-avatars.com/api/?name=Google+Demo"
            };
            console.log("USING DEMO EXPO GOOGLE PAYLOAD");
        } else {
            // Fetch user info from Google using the access token
            console.log("RECEIVED TOKEN FOR GOOGLE USERINFO:", token);

            const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!googleResponse.ok) {
                const errText = await googleResponse.text();
                console.error("Google userinfo API failed:", googleResponse.status, errText);
                throw new Error(`Failed to fetch user profile from Google: ${errText}`);
            }

            payload = await googleResponse.json();
            console.log("GOOGLE PAYLOAD SUCCESS:", payload);
        }

        const { email, name, picture } = payload;

        // Check if user exists
        let user = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );

        if (user.rows.length === 0) {
            user = await pool.query(
                "INSERT INTO users (name,email,role,avatar) VALUES ($1,$2,$3,$4) RETURNING *",
                [name, email, "user", picture || null]
            );
        } else if (picture && user.rows[0].avatar !== picture) {
            // Update avatar if it changed
            user = await pool.query(
                "UPDATE users SET avatar=$1 WHERE email=$2 RETURNING *",
                [picture, email]
            );
        }

        const jwtToken = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token: jwtToken,
            user: formatUser(user.rows[0]),
        });
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(400).json({ error: "Invalid Google Token" });
    }
});

module.exports = router;
