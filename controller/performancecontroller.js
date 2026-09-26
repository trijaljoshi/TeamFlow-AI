const pool = require("../db/db");

// ======================================================
// GET USER PERFORMANCE
// GET /api/users/:userId/performance
// ======================================================
const getUserPerformance = async (req, res) => {
    try {
        const requestedUserId = Number(req.params.userId);
        const loggedInUserId = Number(req.user.userId);

        if (!requestedUserId) {
            return res.status(400).json({
                message: "Valid userId is required"
            });
        }

        // Current system does not have a separate manager role.
        // A user can therefore view their own performance only.
        if (requestedUserId !== loggedInUserId) {
            return res.status(403).json({
                message: "You can only view your own performance"
            });
        }

        // ==================================================
        // USER
        // ==================================================
        const userResult = await pool.query(
            `SELECT
                id,
                name,
                email
             FROM users
             WHERE id = $1`,
            [requestedUserId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const user = userResult.rows[0];

        // ==================================================
        // TASK PERFORMANCE
        // ==================================================
        const taskResult = await pool.query(
            `SELECT
                COUNT(*)::int AS total_tasks,

                COUNT(*) FILTER (
                    WHERE UPPER(completion_status) = 'COMPLETED'
                )::int AS completed_tasks,

                COUNT(*) FILTER (
                    WHERE was_on_time = TRUE
                )::int AS on_time_tasks,

                COUNT(*) FILTER (
                    WHERE was_on_time = FALSE
                )::int AS late_tasks,

                COUNT(*) FILTER (
                    WHERE claimed_at IS NOT NULL
                )::int AS claimed_tasks,

                COUNT(*) FILTER (
                    WHERE completed_at IS NOT NULL
                )::int AS finished_tasks,

                ROUND(
                    AVG(
                        EXTRACT(
                            EPOCH FROM (completed_at - claimed_at)
                        ) / 3600
                    )::numeric,
                    2
                ) AS average_completion_hours

             FROM task_history
             WHERE user_id = $1`,
            [requestedUserId]
        );

        const taskStats = taskResult.rows[0];

        const totalTasks = Number(taskStats.total_tasks || 0);
        const completedTasks = Number(taskStats.completed_tasks || 0);
        const onTimeTasks = Number(taskStats.on_time_tasks || 0);
        const lateTasks = Number(taskStats.late_tasks || 0);
        const claimedTasks = Number(taskStats.claimed_tasks || 0);
        const finishedTasks = Number(taskStats.finished_tasks || 0);

        const completionRate =
            totalTasks > 0
                ? Number(((completedTasks / totalTasks) * 100).toFixed(2))
                : 0;

        const onTimeRate =
            completedTasks > 0
                ? Number(((onTimeTasks / completedTasks) * 100).toFixed(2))
                : 0;

        // ==================================================
        // QA PERFORMANCE
        // ==================================================
        const qaResult = await pool.query(
            `SELECT
                COUNT(*)::int AS total_attempts,

                COUNT(*) FILTER (
                    WHERE UPPER(result) = 'PASSED'
                )::int AS passed,

                COUNT(*) FILTER (
                    WHERE UPPER(result) = 'FAILED'
                )::int AS failed

             FROM qa_history
             WHERE user_id = $1`,
            [requestedUserId]
        );

        const qaStats = qaResult.rows[0];

        const qaTotal = Number(qaStats.total_attempts || 0);
        const qaPassed = Number(qaStats.passed || 0);
        const qaFailed = Number(qaStats.failed || 0);

        const qaPassRate =
            qaTotal > 0
                ? Number(((qaPassed / qaTotal) * 100).toFixed(2))
                : 0;

        // ==================================================
        // CURRENT WORKLOAD
        // ==================================================
        const workloadResult = await pool.query(
            `SELECT
                COUNT(*)::int AS active_tasks,

                COUNT(*) FILTER (
                    WHERE due_date IS NOT NULL
                    AND due_date < CURRENT_DATE
                )::int AS overdue_tasks,

                COUNT(*) FILTER (
                    WHERE due_date = CURRENT_DATE
                )::int AS due_today

             FROM tasks
             WHERE (
                assigned_to = $1
                OR claimed_by = $1
             )
             AND UPPER(COALESCE(status, '')) NOT IN (
                'COMPLETED',
                'COMPLETE',
                'DONE',
                'CLOSED'
             )`,
            [requestedUserId]
        );

        const workload = workloadResult.rows[0];

        // ==================================================
        // USER SKILLS
        // ==================================================
        const skillsResult = await pool.query(
            `SELECT
                id,
                skill_name,
                proficiency
             FROM user_skills
             WHERE user_id = $1
             ORDER BY skill_name ASC`,
            [requestedUserId]
        );

        // ==================================================
        // FINAL RESPONSE
        // ==================================================
        return res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },

            taskPerformance: {
                totalTasks,
                claimedTasks,
                completedTasks,
                finishedTasks,
                onTimeTasks,
                lateTasks,
                completionRate,
                onTimeRate,
                averageCompletionHours:
                    taskStats.average_completion_hours !== null
                        ? Number(taskStats.average_completion_hours)
                        : 0
            },

            qaPerformance: {
                totalAttempts: qaTotal,
                passed: qaPassed,
                failed: qaFailed,
                passRate: qaPassRate
            },

            currentWorkload: {
                activeTasks: Number(workload.active_tasks || 0),
                overdueTasks: Number(workload.overdue_tasks || 0),
                dueToday: Number(workload.due_today || 0)
            },

            skills: skillsResult.rows
        });

    } catch (error) {
        console.error("Get user performance error:", error);

        return res.status(500).json({
            message: "Failed to fetch user performance"
        });
    }
};


module.exports = {
    getUserPerformance
};