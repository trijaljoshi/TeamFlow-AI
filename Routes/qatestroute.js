const express = require("express");

const router = express.Router();

const {
    getQATests,
    createQATest,
    updateQATest,
    deleteQATest
} = require("../controller/qatestcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Get all QA tests for a project
router.get(
    "/projects/:projectId/qa-tests",
    authMiddleware,
    getQATests
);

// Create a QA test
router.post(
    "/projects/:projectId/qa-tests",
    authMiddleware,
    createQATest
);

// Update a QA test
router.patch(
    "/projects/:projectId/qa-tests/:testId",
    authMiddleware,
    updateQATest
);

// Delete a QA test
router.delete(
    "/qa-tests/:testId",
    authMiddleware,
    deleteQATest
);

module.exports = router;