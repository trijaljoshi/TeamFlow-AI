const express = require("express");

const router = express.Router();

const {
    createTask,
    getTasks,
    claimTask
} = require("../controller/taskcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Create a task inside a project
router.post(
    "/:projectId/tasks",
    authMiddleware,
    createTask
);

// Get all tasks of a project
router.get(
    "/:projectId/tasks",
    authMiddleware,
    getTasks
);

// Claim a task
router.post(
    "/:taskId/claim",
    authMiddleware,
    claimTask
);

module.exports = router;