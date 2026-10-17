const express = require("express");
const router = express.Router();

const {
  getTaskRecommendations,
  getPreviewTaskRecommendations,
  getMyTaskRecommendations,
} = require("../controller/recommendationcontroller");
const authMiddleware = require("../middleware/authmiddleware");

// User-side ML recommendations. Frontend calls GET /api/recommendations/my-tasks.
router.get("/my-tasks", authMiddleware, getMyTaskRecommendations);
// Manager-side preview before a task is saved.
router.get("/preview", authMiddleware, getPreviewTaskRecommendations);
// Manager-side recommendations for an existing task.
router.get("/task/:taskId", getTaskRecommendations);

module.exports = router;