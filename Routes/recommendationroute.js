const express = require("express");
const router = express.Router();

const {
    getTaskRecommendations,
    getPreviewTaskRecommendations,
    getMyTaskRecommendations
} = require("../controller/recommendationcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Personalized task recommendations for the logged-in employee.
router.get("/my-tasks", authMiddleware, getMyTaskRecommendations);

// Preview suitable employees before the manager saves a task.
// Supports title, description, priority, dueDate and optional projectId query params.
router.get("/preview", authMiddleware, getPreviewTaskRecommendations);

// Rank employees for a task that already exists.
router.get("/task/:taskId", authMiddleware, getTaskRecommendations);

module.exports = router;