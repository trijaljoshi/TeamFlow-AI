const express = require("express");
const router = express.Router();

const {
    createProject,
    getProjects,
    completeProject,
} = require("../controller/projectcontroller");

const authMiddleware = require("../middleware/authmiddleware");

router.post("/", authMiddleware, createProject);
router.get("/", authMiddleware, getProjects);
router.patch("/:projectId/complete", authMiddleware, completeProject);

module.exports = router;