const express = require("express");
const router = express.Router();

const {
  getTaskRecommendations,
  getPreviewTaskRecommendations,
  getMyTaskRecommendations,
} = require("../controller/recommendationcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Quick diagnostic endpoint: GET /api/recommendations/health
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Recommendation routes are loaded",
    endpoints: [
      "GET /api/recommendations/my-tasks",
      "GET /api/recommendations/task/:taskId",
      "GET /api/recommendations/preview",
    ],
  });
});

// User-side recommendations for the currently authenticated user.
router.get("/my-tasks", authMiddleware, getMyTaskRecommendations);

// Manager-side recommendations for a task that already exists.
router.get("/task/:taskId", authMiddleware, getTaskRecommendations);

// Preview assignee recommendations before a task is saved.
router.get("/preview", authMiddleware, getPreviewTaskRecommendations);

module.exports = router;