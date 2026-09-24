const express = require("express");
const router = express.Router();

const {
    createTask,
    createGlobalTask,
    getTasks,
    claimTask,
    completeTask,
} = require("../controller/taskcontroller");

const authMiddleware = require("../middleware/authmiddleware");

router.post("/tasks", authMiddleware, createGlobalTask);
router.post("/:projectId/tasks", authMiddleware, createTask);
router.get("/:projectId/tasks", authMiddleware, getTasks);
router.post("/:taskId/claim", authMiddleware, claimTask);
router.patch("/tasks/:taskId/complete", authMiddleware, completeTask);

module.exports = router;