const pool = require("../db/db");

// GET all QA test cases for a project
const getQATests = async (req, res) => {
    try {
        const projectId = req.params.projectId;

        const result = await pool.query(
            `SELECT *
             FROM qa_tests
             WHERE project_id = $1
             ORDER BY id ASC`,
            [projectId]
        );

        res.status(200).json({
            testCases: result.rows
        });

    } catch (error) {
        console.error("Get QA tests error:", error);

        res.status(500).json({
            message: "Failed to fetch QA tests"
        });
    }
};


// CREATE a QA test case
const createQATest = async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Test name is required"
            });
        }

        const result = await pool.query(
            `INSERT INTO qa_tests
                (project_id, name, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [projectId, name, description]
        );

        res.status(201).json({
            message: "QA test created successfully",
            testCase: result.rows[0]
        });

    } catch (error) {
        console.error("Create QA test error:", error);

        res.status(500).json({
            message: "Failed to create QA test"
        });
    }
};


// UPDATE QA test case
const updateQATest = async (req, res) => {
    try {
        const testId = req.params.testId;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                message: "Status is required"
            });
        }

        const result = await pool.query(
            `UPDATE qa_tests
             SET status = $1
             WHERE id = $2
             RETURNING *`,
            [status, testId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "QA test not found"
            });
        }

        res.status(200).json({
            message: "QA test updated successfully",
            testCase: result.rows[0]
        });

    } catch (error) {
        console.error("Update QA test error:", error);

        res.status(500).json({
            message: "Failed to update QA test"
        });
    }
};


// DELETE QA test case
const deleteQATest = async (req, res) => {
    try {
        const testId = req.params.testId;

        const result = await pool.query(
            `DELETE FROM qa_tests
             WHERE id = $1
             RETURNING *`,
            [testId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "QA test not found"
            });
        }

        res.status(200).json({
            message: "QA test deleted successfully"
        });

    } catch (error) {
        console.error("Delete QA test error:", error);

        res.status(500).json({
            message: "Failed to delete QA test"
        });
    }
};


module.exports = {
    getQATests,
    createQATest,
    updateQATest,
    deleteQATest
};