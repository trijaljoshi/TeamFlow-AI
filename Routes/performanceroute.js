const express = require("express");

const router = express.Router();

const {
    getUserPerformance
} = require("../controller/performancecontroller");

const authMiddleware = require("../middleware/authmiddleware");


// Get user performance
router.get(
    "/users/:userId/performance",
    authMiddleware,
    getUserPerformance
);


module.exports = router;