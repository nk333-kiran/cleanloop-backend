const router = require("express").Router();
const pool = require("../db");

// Get Users (Placeholder for users route)
router.get("/", async (req, res) => {
    try {
        const users = await pool.query("SELECT id, name, email, role, total_points FROM users");
        res.json(users.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) return res.status(403).json({ error: "Access Denied" });
    try {
        const token = authHeader.split(" ")[1];
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid Token" });
    }
};

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

// Get My Dashboard
router.get("/me/dashboard", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get User Profile
        const userRes = await pool.query("SELECT * FROM users WHERE id=$1", [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
        const userProfile = formatUser(userRes.rows[0]);

        // 2. Get Waste Posts
        const postsRes = await pool.query("SELECT * FROM waste_posts WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
        const wastePosts = postsRes.rows.map(p => ({
            id: p.id.toString(),
            category: p.category,
            weight: p.weight,
            points: p.points,
            location: p.location,
            status: p.status,
            imageUri: p.image_uri,
            createdAt: p.created_at
        }));

        // 3. Get Transactions
        const txRes = await pool.query("SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
        const transactions = txRes.rows.map(tx => ({
            id: tx.id.toString(),
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            date: tx.created_at ? tx.created_at.toISOString().split("T")[0] : null
        }));

        // 4. Calculate Impact Stats dynamically
        const impactRes = await pool.query(
            "SELECT COALESCE(SUM(weight), 0) as total_waste_recycled FROM waste_posts WHERE user_id=$1 AND status='completed'",
            [userId]
        );
        const totalWasteRecycled = parseFloat(impactRes.rows[0].total_waste_recycled);
        const co2Reduced = Math.round(totalWasteRecycled * 1.5); // Example multiplier
        const treesEquivalent = Math.round(co2Reduced / 15);
        const waterSaved = Math.round(totalWasteRecycled * 25);
        // Simple mock streak until daily logging is fully built
        const streakDays = Math.min(wastePosts.length, 5);

        const impactStats = {
            totalWasteRecycled,
            treesEquivalent,
            co2Reduced,
            waterSaved,
            streakDays
        };

        res.json({
            user: userProfile,
            wastePosts,
            transactions,
            impactStats
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error fetching dashboard" });
    }
});

// Update My Profile
router.put("/me", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, avatar } = req.body;

        const updateRes = await pool.query(
            "UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), avatar = COALESCE($3, avatar) WHERE id = $4 RETURNING *",
            [name, email, avatar, userId]
        );

        if (updateRes.rows.length === 0) return res.status(404).json({ error: "User not found" });

        res.json({ message: "Profile updated successfully", user: formatUser(updateRes.rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error updating profile" });
    }
});

module.exports = router;
