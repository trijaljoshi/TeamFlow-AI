const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
    getUserHistory
} = require("../controller/historycontroller");

// ======================================================
// USER WORK HISTORY
// ======================================================

router.get(
    "/users/:userId/history",
    authMiddleware,
    getUserHistory
);

module.exports = router;