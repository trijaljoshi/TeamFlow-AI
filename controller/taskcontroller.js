const pool = require("../db/db");


// ======================================================
// CREATE TASK
// ======================================================
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
            return res.status(400).json({
                message: "Task title is required"
            });
        }

        if (depends_on_task_id) {
            const dependency = await pool.query(
                `SELECT id
                 FROM tasks
                 WHERE id = $1
                 AND project_id = $2`,
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
            (
                project_id,
                title,
                description,
                status,
                priority,
                due_date,
                assigned_to,
                depends_on_task_id,
                qa_status
            )
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

        const task = result.rows[0];

        // Create initial history record if task is assigned
        if (assigned_to) {
            await pool.query(
                `INSERT INTO task_history
                (
                    task_id,
                    user_id,
                    project_id,
                    assigned_at,
                    due_date,
                    completion_status,
                    was_on_time
                )
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)`,
                [
                    task.id,
                    assigned_to,
                    projectId,
                    task.due_date || null,
                    task.status || "TODO",
                    null
                ]
            );
        }

        res.status(201).json({
            message: "Task created successfully",
            task
        });

    } catch (error) {
        console.error("Create task error:", error);

        res.status(500).json({
            message: "Failed to create task"
        });
    }
};


// ======================================================
// CREATE GLOBAL TASK
// ======================================================
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
            return res.status(400).json({
                message: "Task title is required"
            });
        }

        if (depends_on_task_id && project_id) {
            const dependency = await pool.query(
                `SELECT id
                 FROM tasks
                 WHERE id = $1
                 AND project_id = $2`,
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
            (
                project_id,
                title,
                description,
                status,
                priority,
                due_date,
                assigned_to,
                depends_on_task_id,
                qa_status
            )
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

        const task = result.rows[0];

        // Create initial history record if task is assigned
        if (assigned_to && project_id) {
            await pool.query(
                `INSERT INTO task_history
                (
                    task_id,
                    user_id,
                    project_id,
                    assigned_at,
                    due_date,
                    completion_status,
                    was_on_time
                )
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)`,
                [
                    task.id,
                    assigned_to,
                    project_id,
                    task.due_date || null,
                    task.status || "TODO",
                    null
                ]
            );
        }

        res.status(201).json({
            message: "Task created successfully",
            task
        });

    } catch (error) {
        console.error("Create global task error:", error);

        res.status(500).json({
            message: "Failed to create task"
        });
    }
};


// ======================================================
// GET TASKS
// ======================================================
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
             LEFT JOIN users
                ON tasks.claimed_by = users.id
             LEFT JOIN users AS assigned_user
                ON tasks.assigned_to = assigned_user.id
             LEFT JOIN tasks AS dependency
                ON tasks.depends_on_task_id = dependency.id
             WHERE tasks.project_id = $1
             ORDER BY tasks.created_at DESC`,
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


// ======================================================
// CLAIM TASK
// ======================================================
const claimTask = async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const userId = req.user.userId;

        const taskResult = await pool.query(
            `SELECT
                t.id,
                t.project_id,
                t.claimed_by,
                t.assigned_to,
                t.due_date,
                t.depends_on_task_id,
                dependency.title AS dependency_task_title,
                dependency.qa_status AS dependency_qa_status
             FROM tasks t
             LEFT JOIN tasks dependency
                ON t.depends_on_task_id = dependency.id
             WHERE t.id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        const task = taskResult.rows[0];

        if (
            task.depends_on_task_id &&
            task.dependency_qa_status !== "PASSED"
        ) {
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

        const claimedTask = result.rows[0];

        // Check whether history already exists
        const historyResult = await pool.query(
            `SELECT id
             FROM task_history
             WHERE task_id = $1
             AND user_id = $2
             LIMIT 1`,
            [taskId, userId]
        );

        if (historyResult.rows.length === 0) {
            // No history exists - create it now
            await pool.query(
                `INSERT INTO task_history
                (
                    task_id,
                    user_id,
                    project_id,
                    claimed_at,
                    due_date,
                    completion_status,
                    was_on_time
                )
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)`,
                [
                    taskId,
                    userId,
                    claimedTask.project_id,
                    claimedTask.due_date || null,
                    claimedTask.status || "TODO",
                    null
                ]
            );
        } else {
            // History exists - update claim time
            await pool.query(
                `UPDATE task_history
                 SET claimed_at = COALESCE(claimed_at, CURRENT_TIMESTAMP),
                     due_date = $1
                 WHERE task_id = $2
                 AND user_id = $3`,
                [
                    claimedTask.due_date || null,
                    taskId,
                    userId
                ]
            );
        }

        res.status(200).json({
            message: "Task claimed successfully",
            task: claimedTask
        });

    } catch (error) {
        console.error("Claim task error:", error);

        res.status(500).json({
            message: "Failed to claim task"
        });
    }
};


// ======================================================
// COMPLETE TASK
// ======================================================
const completeTask = async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const userId = req.user.userId;

        const taskResult = await pool.query(
            `SELECT
                id,
                project_id,
                claimed_by,
                assigned_to,
                status,
                due_date
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

        if (
            String(task.status || "").toUpperCase() === "COMPLETED"
        ) {
            return res.status(400).json({
                message: "Task is already completed"
            });
        }

        const result = await pool.query(
            `UPDATE tasks
             SET status = 'COMPLETED',
                 qa_status = 'PENDING'
             WHERE id = $1
             RETURNING *`,
            [taskId]
        );

        const completedTask = result.rows[0];

        // Determine whether task was completed on time.
        // Due date is treated as the end of that calendar day.
        let wasOnTime = null;

        if (task.due_date) {
            const now = new Date();
            const dueDate = new Date(task.due_date);

            // Compare date portions only
            const completedDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );

            const deadlineDate = new Date(
                dueDate.getFullYear(),
                dueDate.getMonth(),
                dueDate.getDate()
            );

            wasOnTime = completedDate <= deadlineDate;
        }

        // Check existing history
        const historyResult = await pool.query(
            `SELECT id
             FROM task_history
             WHERE task_id = $1
             AND user_id = $2
             LIMIT 1`,
            [taskId, userId]
        );

        if (historyResult.rows.length === 0) {
            // Create history if it did not exist earlier
            await pool.query(
                `INSERT INTO task_history
                (
                    task_id,
                    user_id,
                    project_id,
                    claimed_at,
                    completed_at,
                    due_date,
                    completion_status,
                    was_on_time
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    $4,
                    'COMPLETED',
                    $5
                )`,
                [
                    taskId,
                    userId,
                    task.project_id,
                    task.due_date || null,
                    wasOnTime
                ]
            );
        } else {
            // Update existing history
            await pool.query(
                `UPDATE task_history
                 SET completed_at = CURRENT_TIMESTAMP,
                     due_date = $1,
                     completion_status = 'COMPLETED',
                     was_on_time = $2
                 WHERE task_id = $3
                 AND user_id = $4`,
                [
                    task.due_date || null,
                    wasOnTime,
                    taskId,
                    userId
                ]
            );
        }

        return res.status(200).json({
            message: "Task completed and moved to QA",
            task: completedTask,
            history: {
                completedAt: new Date(),
                wasOnTime
            }
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