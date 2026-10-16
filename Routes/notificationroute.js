const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");
const { getNotifications } = require("../controller/notificationcontroller");

router.get("/notifications", authMiddleware, getNotifications);

module.exports = router;
