const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");
const {
    getUserHistory,
    getUserPerformance,
} = require("../controller/analyticscontroller");

// Existing frontend/profile API contracts.
router.get("/:userId/history", authMiddleware, getUserHistory);
router.get("/:userId/performance", authMiddleware, getUserPerformance);

module.exports = router;
