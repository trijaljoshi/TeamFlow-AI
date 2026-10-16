const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");
const {
    getAnalyticsOverview,
    getAnalyticsTrend,
    getAnalyticsUsers,
} = require("../controller/analyticscontroller");

router.get("/overview", authMiddleware, getAnalyticsOverview);
router.get("/trend", authMiddleware, getAnalyticsTrend);
router.get("/users", authMiddleware, getAnalyticsUsers);

module.exports = router;
