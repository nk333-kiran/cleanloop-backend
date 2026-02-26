const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/authMiddleware");

// Recycler accepts pickup
router.post("/pickup", auth, async (req, res) => {
    const { waste_id, pickup_date } = req.body;

    const pickup = await pool.query(
        "INSERT INTO pickups (waste_id, recycler_id, pickup_date) VALUES ($1,$2,$3) RETURNING *",
        [waste_id, req.user.id, pickup_date]
    );

    res.json(pickup.rows[0]);
});

module.exports = router;
