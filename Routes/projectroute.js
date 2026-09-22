const express = require("express");
const router = express.Router();

const { createProject } = require("../controller/projectcontroller");
const { getProjects } = require("../controller/projectcontroller");

const authMiddleware = require("../middleware/authmiddleware");

router.post("/", authMiddleware, createProject);
router.get("/", authMiddleware, getProjects);



module.exports = router;