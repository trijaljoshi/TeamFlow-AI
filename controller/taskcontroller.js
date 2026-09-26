const pool = require("../db/db");

const createTask = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            due_date,
            assigned_to,
            depends_on_task_id
        } = req.body;

        const projectId = req.params.projectId;

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        if (depends_on_task_id) {
            const dependency = await pool.query(
                `SELECT id FROM tasks WHERE id = $1 AND project_id = $2`,
                [depends_on_task_id, projectId]
            );

            if (dependency.rows.length === 0) {
                return res.status(400).json({
                    message: "Dependency task must belong to the same project"
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO tasks
            (project_id, title, description, status, priority, due_date, assigned_to, depends_on_task_id, qa_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NOT_STARTED')
            RETURNING *`,
            [
                projectId,
                title,
                description || null,
                status || "TODO",
                priority || "MEDIUM",
                due_date || null,
                assigned_to || null,
                depends_on_task_id || null
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
        const {
            title,
            description,
            status,
            priority,
            due_date,
            assigned_to,
            project_id,
            depends_on_task_id
        } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        if (depends_on_task_id && project_id) {
            const dependency = await pool.query(
                `SELECT id FROM tasks WHERE id = $1 AND project_id = $2`,
                [depends_on_task_id, project_id]
            );

            if (dependency.rows.length === 0) {
                return res.status(400).json({
                    message: "Dependency task must belong to the same project"
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO tasks
            (project_id, title, description, status, priority, due_date, assigned_to, depends_on_task_id, qa_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NOT_STARTED')
            RETURNING *`,
            [
                project_id || null,
                title,
                description || null,
                status || "TODO",
                priority || "MEDIUM",
                due_date || null,
                assigned_to || null,
                depends_on_task_id || null
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
                assigned_user.name AS assigned_to_name,
                dependency.title AS dependency_task_title,
                dependency.qa_status AS dependency_qa_status
             FROM tasks
             LEFT JOIN users ON tasks.claimed_by = users.id
             LEFT JOIN users AS assigned_user ON tasks.assigned_to = assigned_user.id
             LEFT JOIN tasks AS dependency ON tasks.depends_on_task_id = dependency.id
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

        const taskResult = await pool.query(
            `SELECT
                t.id,
                t.claimed_by,
                t.depends_on_task_id,
                dependency.title AS dependency_task_title,
                dependency.qa_status AS dependency_qa_status
             FROM tasks t
             LEFT JOIN tasks dependency ON t.depends_on_task_id = dependency.id
             WHERE t.id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        const task = taskResult.rows[0];

        if (task.depends_on_task_id && task.dependency_qa_status !== "PASSED") {
            return res.status(409).json({
                message: `This task is locked. Dependency "${task.dependency_task_title || "previous task"}" must pass QA first.`
            });
        }

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
        const userId = req.user.userId;

        const taskResult = await pool.query(
            `SELECT id, claimed_by, status
             FROM tasks
             WHERE id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        const task = taskResult.rows[0];

        if (!task.claimed_by) {
            return res.status(400).json({
                message: "Task must be claimed before it can be completed"
            });
        }

        if (String(task.claimed_by) !== String(userId)) {
            return res.status(403).json({
                message: "Only the user who claimed this task can complete it"
            });
        }

        if (String(task.status || "").toUpperCase() === "COMPLETED") {
            return res.status(400).json({ message: "Task is already completed" });
        }

        const result = await pool.query(
            `UPDATE tasks
             SET status = 'COMPLETED', qa_status = 'PENDING'
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