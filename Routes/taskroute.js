const express = require("express");

const router = express.Router();

const {
    createTask,
    createGlobalTask,
    getTasks,
    claimTask,
} = require("../controller/taskcontroller");

const authMiddleware = require("../middleware/authmiddleware");


// ======================================================
// CREATE GLOBAL TASK
// Project can be null
//
// POST /api/projects/tasks
// ======================================================
router.post(
    "/tasks",
    authMiddleware,
    createGlobalTask
);


// ======================================================
// CREATE TASK INSIDE A PROJECT
//
// POST /api/projects/:projectId/tasks
// ======================================================
router.post(
    "/:projectId/tasks",
    authMiddleware,
    createTask
);


// ======================================================
// GET ALL TASKS OF ONE PROJECT
//
// GET /api/projects/:projectId/tasks
// ======================================================
router.get(
    "/:projectId/tasks",
    authMiddleware,
    getTasks
);


// ======================================================
// CLAIM TASK
//
// POST /api/projects/:taskId/claim
// ======================================================
router.post(
    "/:taskId/claim",
    authMiddleware,
    claimTask
);


module.exports = router;