const express = require("express");
const router = express.Router();

const {
    getTaskRecommendations,
    getPreviewTaskRecommendations,
    getMyTaskRecommendations
} = require("../controller/recommendationcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Lightweight route check. This only confirms that the recommendation router
// is mounted; it does not test the database or ML model.
router.get("/health", (req, res) => {
    res.json({
        success: true,
        service: "recommendations",
        message: "Recommendation routes are mounted"
    });
});

// Employee-side recommendations for the logged-in user.
router.get("/my-tasks", authMiddleware, getMyTaskRecommendations);

// Preview assignee recommendations before a task is saved.
router.get("/preview", authMiddleware, getPreviewTaskRecommendations);

// Manager-side recommendations for an existing task.
router.get("/task/:taskId", authMiddleware, getTaskRecommendations);

module.exports = router;