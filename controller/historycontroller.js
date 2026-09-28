const pool = require("../db/db");

// ======================================================
// GET USER WORK HISTORY
// GET /api/users/:userId/history
// ======================================================

const getUserHistory = async (req, res) => {
    try {
        const requestedUserId = String(req.params.userId);
        const loggedInUserId = String(req.user.userId);

        // User can only see their own history
        if (requestedUserId !== loggedInUserId) {
            return res.status(403).json({
                message: "You can only view your own work history"
            });
        }

        const result = await pool.query(
            `
            SELECT
                th.id,
                th.task_id,
                th.user_id,
                th.project_id,
                th.assigned_at,
                th.claimed_at,
                th.completed_at,
                th.due_date,
                th.completion_status,
                th.was_on_time,

                t.title AS task_title,
                t.description AS task_description,
                t.priority AS task_priority,
                t.status AS task_status,

                p.name AS project_name,
                p.description AS project_description

            FROM task_history th

            LEFT JOIN tasks t
                ON t.id = th.task_id

            LEFT JOIN projects p
                ON p.id = th.project_id

            WHERE th.user_id = $1

            ORDER BY
                COALESCE(th.completed_at, th.claimed_at, th.assigned_at)
                DESC,
                th.id DESC
            `,
            [requestedUserId]
        );

        const history = result.rows.map((row) => ({
            id: row.id,

            taskId: row.task_id,
            taskTitle: row.task_title,
            taskDescription: row.task_description,
            taskPriority: row.task_priority,
            taskStatus: row.task_status,

            projectId: row.project_id,
            projectName: row.project_name,
            projectDescription: row.project_description,

            assignedAt: row.assigned_at,
            claimedAt: row.claimed_at,
            completedAt: row.completed_at,
            dueDate: row.due_date,

            completionStatus:
                row.completion_status,

            wasOnTime:
                row.was_on_time
        }));

        return res.status(200).json({
            history
        });

    } catch (error) {
        console.error(
            "Get user history error:",
            error
        );

        return res.status(500).json({
            message: "Failed to fetch work history"
        });
    }
};

module.exports = {
    getUserHistory
};