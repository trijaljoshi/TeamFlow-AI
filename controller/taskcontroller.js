const pool = require("../db/db");

const createTask = async (req, res) => {
    try {
        const { title, description, status, priority, due_date, assigned_to } = req.body;
        const projectId = req.params.projectId;

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        if (assigned_to != null && assigned_to !== "") {
            const userResult = await pool.query(
                "SELECT id FROM users WHERE id = $1 LIMIT 1",
                [Number(assigned_to)]
            );
            if (userResult.rows.length === 0) {
                return res.status(400).json({
                    message: "Assignee must be a registered user."
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO tasks
            (project_id, title, description, status, priority, due_date, assigned_to)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                projectId,
                title,
                description || null,
                status || "TODO",
                priority || "MEDIUM",
                due_date || null,
                assigned_to || null
            ]
        );

        res.status(201).json({
            message: "Task created successfully",
            task: result.rows[0]
        });
    } catch (error) {
        console.error("Create task error:", error);
        res.status(500).json({ message: "Failed to create task" });
    }
};

const createGlobalTask = async (req, res) => {
    try {
        const { title, description, status, priority, due_date, assigned_to, project_id } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        if (assigned_to != null && assigned_to !== "") {
            const userResult = await pool.query(
                "SELECT id FROM users WHERE id = $1 LIMIT 1",
                [Number(assigned_to)]
            );
            if (userResult.rows.length === 0) {
                return res.status(400).json({
                    message: "Assignee must be a registered user."
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO tasks
            (project_id, title, description, status, priority, due_date, assigned_to)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                project_id || null,
                title,
                description || null,
                status || "TODO",
                priority || "MEDIUM",
                due_date || null,
                assigned_to || null
            ]
        );

        res.status(201).json({
            message: "Task created successfully",
            task: result.rows[0]
        });
    } catch (error) {
        console.error("Create global task error:", error);
        res.status(500).json({ message: "Failed to create task" });
    }
};

const getTasks = async (req, res) => {
    try {
        const projectId = req.params.projectId;

        const result = await pool.query(
            `SELECT
                tasks.*,
                users.name AS claimed_by_name,
                assigned_user.name AS assigned_to_name
             FROM tasks
             LEFT JOIN users ON tasks.claimed_by = users.id
             LEFT JOIN users AS assigned_user ON tasks.assigned_to = assigned_user.id
             WHERE tasks.project_id = $1
             ORDER BY tasks.created_at DESC`,
            [projectId]
        );

        res.status(200).json({ tasks: result.rows });
    } catch (error) {
        console.error("Get tasks error:", error);
        res.status(500).json({ message: "Failed to fetch tasks" });
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
        res.status(500).json({ message: "Failed to claim task" });
    }
};

const completeTask = async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const userId = req.user?.userId ?? req.user?.user_id ?? req.user?.id;

        if (userId == null) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const taskResult = await pool.query(
            `SELECT id, assigned_to, claimed_by, status
             FROM tasks
             WHERE id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        const task = taskResult.rows[0];
        const responsibleUserId =
            task.claimed_by != null ? task.claimed_by : task.assigned_to;

        if (responsibleUserId == null) {
            return res.status(400).json({
                message: "Assign or claim this task before completing it."
            });
        }

        if (String(responsibleUserId) !== String(userId)) {
            return res.status(403).json({
                message: "Only the assigned user or current claimant can complete this task."
            });
        }

        if (["COMPLETED", "COMPLETE", "DONE", "CLOSED"].includes(
            String(task.status || "").trim().toUpperCase()
        )) {
            return res.status(400).json({ message: "Task is already completed" });
        }

        const result = await pool.query(
            `UPDATE tasks
             SET status = 'COMPLETED',
                 qa_status = 'PENDING'
             WHERE id = $1
             RETURNING *`,
            [taskId]
        );

        return res.status(200).json({
            message: "Task completed and moved to QA",
            task: result.rows[0]
        });
    } catch (error) {
        console.error("Complete task error:", error);
        return res.status(500).json({
            message: "Failed to complete task"
        });
    }
};

module.exports = {
    createTask,
    createGlobalTask,
    getTasks,
    claimTask,
    completeTask
};