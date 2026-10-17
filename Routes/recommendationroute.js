const express = require("express");
const router = express.Router();

const {
    getTaskRecommendations,
    getPreviewTaskRecommendations,
    getMyTaskRecommendations
} = require("../controller/recommendationcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Employee-side recommendations for the currently logged-in user.
router.get("/my-tasks", authMiddleware, getMyTaskRecommendations);

// Preview recommendations before a task is saved.
// Frontend calls GET /api/recommendations/preview.
router.get("/preview", authMiddleware, getPreviewTaskRecommendations);

// Manager-side recommendations for an existing task.
router.get("/task/:taskId", getTaskRecommendations);

module.exports = router;