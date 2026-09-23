const express = require("express");

const router = express.Router();

const { getAllTasks } = require("../controller/alltaskscontroller");

const authMiddleware = require("../middleware/authmiddleware");

router.get(
    "/",
    authMiddleware,
    getAllTasks
);

module.exports = router;