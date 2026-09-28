const express = require("express");

const router = express.Router();

const {
    getTaskRecommendations
} = require("../controller/recommendationcontroller");

router.get(
    "/task/:taskId",
    getTaskRecommendations
);

module.exports = router;