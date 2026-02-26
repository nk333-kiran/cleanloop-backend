const router = require("express").Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) return res.status(403).json({ error: "Access Denied" });
    try {
        const token = authHeader.split(" ")[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid Token" });
    }
};

router.post("/post", authMiddleware, async (req, res) => {
    try {
        const { category, weight, points, location, imageUri } = req.body;
        const userId = req.user.id;
        const status = "pending";

        const newPost = await pool.query(
            "INSERT INTO waste_posts (user_id, category, weight, points, location, status, image_uri) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            [userId, category, weight, points, location, status, imageUri]
        );

        const newTx = await pool.query(
            "INSERT INTO transactions (user_id, type, amount, description) VALUES ($1,$2,$3,$4) RETURNING *",
            [userId, "earned", points, `${category.charAt(0).toUpperCase() + category.slice(1)} recycling - ${weight} kg`]
        );

        await pool.query("UPDATE users SET total_points = total_points + $1 WHERE id = $2", [points, userId]);

        res.json({ post: newPost.rows[0], transaction: newTx.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/redeem", authMiddleware, async (req, res) => {
    try {
        const { pointsCost, rewardTitle } = req.body;
        const userId = req.user.id;

        const userCheck = await pool.query("SELECT total_points FROM users WHERE id=$1", [userId]);
        if (userCheck.rows[0].total_points < pointsCost) {
            return res.status(400).json({ error: "Not enough points" });
        }

        await pool.query("UPDATE users SET total_points = total_points - $1 WHERE id = $2", [pointsCost, userId]);

        const newTx = await pool.query(
            "INSERT INTO transactions (user_id, type, amount, description) VALUES ($1,$2,$3,$4) RETURNING *",
            [userId, "redeemed", pointsCost, rewardTitle]
        );

        res.json({ transaction: newTx.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

