const express = require("express");
const router = express.Router();
const pool = require("../db/db");
const authMiddleware = require("../middleware/authmiddleware");

const normalizeStatus = (status) =>
    String(status || "PENDING").trim().toUpperCase();

/*
=====================================================
CREATE QA TEST
Project-scoped
POST /api/projects/:projectId/qa-tests
=====================================================
*/
const createQATest = async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);
        const { task_id, name, description } = req.body;

        if (!projectId || !task_id || !name || !description) {
            return res.status(400).json({
                message: "projectId, task_id, name and description are required"
            });
        }

        // Make sure task belongs to this project
        const taskResult = await pool.query(
            `SELECT id, project_id
             FROM tasks
             WHERE id = $1 AND project_id = $2`,
            [task_id, projectId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(400).json({
                message: "The selected task does not belong to this project"
            });
        }

        // Prevent duplicate QA test for the same task
        const existingResult = await pool.query(
            `SELECT *
             FROM qa_tests
             WHERE task_id = $1
             LIMIT 1`,
            [task_id]
        );

        if (existingResult.rows.length > 0) {
            return res.status(200).json({
                message: "QA test already exists for this task",
                testCase: existingResult.rows[0],
                alreadyExists: true
            });
        }

        const result = await pool.query(
            `INSERT INTO qa_tests
             (project_id, task_id, name, description, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             RETURNING *`,
            [
                projectId,
                task_id,
                name.trim(),
                description.trim()
            ]
        );

        await pool.query(
            `UPDATE tasks
             SET qa_status = 'PENDING'
             WHERE id = $1`,
            [task_id]
        );

        return res.status(201).json({
            message: "QA test created successfully",
            testCase: result.rows[0]
        });

    } catch (error) {
        console.error("Create QA test error:", error);

        return res.status(500).json({
            message: "Failed to create QA test"
        });
    }
};


/*
=====================================================
GET PROJECT QA TESTS
GET /api/projects/:projectId/qa-tests
=====================================================
*/
const getQATests = async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);

        if (!projectId) {
            return res.status(400).json({
                message: "Valid projectId is required"
            });
        }

        const result = await pool.query(
            `SELECT
                qa_tests.*,
                tasks.title AS task_title,
                tasks.qa_status AS task_qa_status
             FROM qa_tests
             LEFT JOIN tasks
                ON tasks.id = qa_tests.task_id
             WHERE qa_tests.project_id = $1
             ORDER BY qa_tests.created_at DESC, qa_tests.id DESC`,
            [projectId]
        );

        return res.status(200).json({
            testCases: result.rows
        });

    } catch (error) {
        console.error("Get QA tests error:", error);

        return res.status(500).json({
            message: "Failed to fetch QA tests"
        });
    }
};


/*
=====================================================
CREATE QA TEST FOR TASK
POST /api/tasks/:taskId/qa-tests

This is useful for the individual task QA flow.
=====================================================
*/
const createQATestForTask = async (req, res) => {
    try {
        const taskId = Number(req.params.taskId);
        const { name, description } = req.body;

        if (!taskId || !name || !description) {
            return res.status(400).json({
                message: "taskId, name and description are required"
            });
        }

        // Get task + project
        const taskResult = await pool.query(
            `SELECT id, project_id
             FROM tasks
             WHERE id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        const task = taskResult.rows[0];

        // Prevent duplicate QA test
        const existingResult = await pool.query(
            `SELECT *
             FROM qa_tests
             WHERE task_id = $1
             LIMIT 1`,
            [taskId]
        );

        if (existingResult.rows.length > 0) {
            return res.status(200).json({
                message: "QA test already exists for this task",
                testCase: existingResult.rows[0],
                alreadyExists: true
            });
        }

        const result = await pool.query(
            `INSERT INTO qa_tests
             (project_id, task_id, name, description, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             RETURNING *`,
            [
                task.project_id,
                taskId,
                name.trim(),
                description.trim()
            ]
        );

        await pool.query(
            `UPDATE tasks
             SET qa_status = 'PENDING'
             WHERE id = $1`,
            [taskId]
        );

        return res.status(201).json({
            message: "QA test created successfully",
            testCase: result.rows[0]
        });

    } catch (error) {
        console.error("Create task QA test error:", error);

        return res.status(500).json({
            message: "Failed to create QA test"
        });
    }
};


/*
=====================================================
GET QA TESTS FOR TASK
GET /api/tasks/:taskId/qa-tests
=====================================================
*/
const getQATestsForTask = async (req, res) => {
    try {
        const taskId = Number(req.params.taskId);

        if (!taskId) {
            return res.status(400).json({
                message: "Valid taskId is required"
            });
        }

        const result = await pool.query(
            `SELECT
                qa_tests.*,
                tasks.title AS task_title,
                tasks.qa_status AS task_qa_status
             FROM qa_tests
             LEFT JOIN tasks
                ON tasks.id = qa_tests.task_id
             WHERE qa_tests.task_id = $1
             ORDER BY qa_tests.created_at DESC, qa_tests.id DESC`,
            [taskId]
        );

        return res.status(200).json({
            testCases: result.rows
        });

    } catch (error) {
        console.error("Get task QA tests error:", error);

        return res.status(500).json({
            message: "Failed to fetch task QA tests"
        });
    }
};


/*
=====================================================
UPDATE QA TEST
PATCH /api/qa-tests/:testId
=====================================================
*/
const updateQATest = async (req, res) => {
    try {
        const testId = Number(req.params.testId);
        const status = normalizeStatus(req.body.status);

        if (
            !testId ||
            !["PENDING", "PASSED", "FAILED"].includes(status)
        ) {
            return res.status(400).json({
                message: "Valid status is required: PENDING, PASSED or FAILED"
            });
        }

        const testResult = await pool.query(
            `SELECT id, project_id, task_id
             FROM qa_tests
             WHERE id = $1`,
            [testId]
        );

        if (testResult.rows.length === 0) {
            return res.status(404).json({
                message: "QA test not found"
            });
        }

        const test = testResult.rows[0];

        const updatedResult = await pool.query(
            `UPDATE qa_tests
             SET status = $1
             WHERE id = $2
             RETURNING *`,
            [status, testId]
        );

        let taskQaStatus = "PENDING";

        if (test.task_id) {
            const summary = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (
                        WHERE UPPER(status) = 'PASSED'
                    )::int AS passed,
                    COUNT(*) FILTER (
                        WHERE UPPER(status) = 'FAILED'
                    )::int AS failed
                 FROM qa_tests
                 WHERE task_id = $1`,
                [test.task_id]
            );

            const { total, passed, failed } = summary.rows[0];

            if (failed > 0) {
                taskQaStatus = "FAILED";
            } else if (
                total > 0 &&
                passed === total
            ) {
                taskQaStatus = "PASSED";
            }

            await pool.query(
                `UPDATE tasks
                 SET qa_status = $1
                 WHERE id = $2`,
                [taskQaStatus, test.task_id]
            );
        }

        return res.status(200).json({
            message: "QA test updated successfully",
            testCase: {
                ...updatedResult.rows[0],
                task_qa_status: taskQaStatus
            }
        });

    } catch (error) {
        console.error("Update QA test error:", error);

        return res.status(500).json({
            message: "Failed to update QA test"
        });
    }
};


/*
=====================================================
DELETE QA TEST
DELETE /api/qa-tests/:testId

Backend endpoint retained.
Frontend delete button can remain removed.
=====================================================
*/
const deleteQATest = async (req, res) => {
    try {
        const testId = Number(req.params.testId);

        const result = await pool.query(
            `DELETE FROM qa_tests
             WHERE id = $1
             RETURNING task_id`,
            [testId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "QA test not found"
            });
        }

        const taskId = result.rows[0].task_id;

        if (taskId) {
            const summary = await pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (
                        WHERE UPPER(status) = 'PASSED'
                    )::int AS passed,
                    COUNT(*) FILTER (
                        WHERE UPPER(status) = 'FAILED'
                    )::int AS failed
                 FROM qa_tests
                 WHERE task_id = $1`,
                [taskId]
            );

            const { total, passed, failed } = summary.rows[0];

            const qaStatus =
                failed > 0
                    ? "FAILED"
                    : total > 0 && passed === total
                        ? "PASSED"
                        : "NOT_STARTED";

            await pool.query(
                `UPDATE tasks
                 SET qa_status = $1
                 WHERE id = $2`,
                [qaStatus, taskId]
            );
        }

        return res.status(200).json({
            message: "QA test deleted successfully"
        });

    } catch (error) {
        console.error("Delete QA test error:", error);

        return res.status(500).json({
            message: "Failed to delete QA test"
        });
    }
};


/*
=====================================================
ROUTES
=====================================================
*/

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