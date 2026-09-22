const pool = require("../db/db");

const createTask = async (req, res) => {
    try {
        const { title, description, status, priority, due_date } = req.body;

        const projectId = req.params.projectId;

        if (!title) {
            return res.status(400).json({
                message: "Task title is required"
            });
        }

        const result = await pool.query(
            `INSERT INTO tasks
            (project_id, title, description, status, priority, due_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                projectId,
                title,
                description,
                status || "TODO",
                priority || "MEDIUM",
                due_date
            ]
        );

        res.status(201).json({
            message: "Task created successfully",
            task: result.rows[0]
        });

    } catch (error) {
        console.error("Create task error:", error);

        res.status(500).json({
            message: "Failed to create task"
        });
    }
};

const getTasks = async (req, res) => {
    try {
        const projectId = req.params.projectId;

        const result = await pool.query(
            `SELECT
                tasks.*,
                users.name AS claimed_by_name
             FROM tasks
             LEFT JOIN users                    -- left join
                ON tasks.claimed_by = users.id
             WHERE tasks.project_id = $1`,
            [projectId]
        );

        res.status(200).json({
            tasks: result.rows
        });

    } catch (error) {
        console.error("Get tasks error:", error);

        res.status(500).json({
            message: "Failed to fetch tasks"
        });
    }
};
const claimTask = async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE tasks
             SET claimed_by = $1
             WHERE id = $2
             AND claimed_by IS NULL
             RETURNING *`,
            [userId, taskId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "Task is already claimed or does not exist"
            });
        }

        res.status(200).json({
            message: "Task claimed successfully",
            task: result.rows[0]
        });

    } catch (error) {
        console.error("Claim task error:", error);

        res.status(500).json({
            message: "Failed to claim task"
        });
    }
};
module.exports = { createTask, getTasks,claimTask };