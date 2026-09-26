const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
    createQATest,
    getQATests,
    createQATestForTask,
    getQATestsForTask,
    updateQATest,
    deleteQATest
} = require("../controller/qatestcontroller");


// ======================================================
// PROJECT QA TESTS
// ======================================================

router.post(
    "/projects/:projectId/qa-tests",
    authMiddleware,
    createQATest
);

router.get(
    "/projects/:projectId/qa-tests",
    authMiddleware,
    getQATests
);


// ======================================================
// TASK QA TESTS
// ======================================================

router.post(
    "/tasks/:taskId/qa-tests",
    authMiddleware,
    createQATestForTask
);

router.get(
    "/tasks/:taskId/qa-tests",
    authMiddleware,
    getQATestsForTask
);


// ======================================================
// INDIVIDUAL QA TEST
// ======================================================

router.patch(
    "/qa-tests/:testId",
    authMiddleware,
    updateQATest
);

router.delete(
    "/qa-tests/:testId",
    authMiddleware,
    deleteQATest
);


module.exports = router;