const express = require("express");
const router = express.Router();

const {
    getTaskRecommendations,
    getMyTaskRecommendations
} = require("../controller/recommendationcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Employee-side recommendations for the currently logged-in user.
// Keep this route before /task/:taskId.
router.get("/my-tasks", authMiddleware, getMyTaskRecommendations);

// Manager-side recommendations: rank employees for a specific task.
router.get("/task/:taskId", getTaskRecommendations);

module.exports = router;
