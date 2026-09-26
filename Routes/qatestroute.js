```javascript
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
} = require("../controller/qacontroller");

// Project QA
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

// Task QA
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

// Individual QA test
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
```
