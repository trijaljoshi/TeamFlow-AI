const pool = require("../db/db");

/*
 * TeamFlow Analytics
 *
 * IMPORTANT:
 * Analytics are calculated from PostgreSQL work history:
 * tasks, QA results and tickets. We do NOT track frontend searches.
 */

const completedStatuses = ["COMPLETED", "COMPLETE", "DONE", "CLOSED"];

const rangeDays = (value) => {
    const map = {
        "7d": 7,
        "14d": 14,
        "30d": 30,
        "90d": 90,
    };

    return map[String(value || "").toLowerCase()] || 30;
};

const getAnalyticsOverview = async (req, res) => {
    try {
        const days = rangeDays(req.query.range);

        const result = await pool.query(
            `
            WITH bounds AS (
                SELECT NOW() - ($1::int * INTERVAL '1 day') AS start_at
            ),
            task_stats AS (
                SELECT
                    COUNT(*)::int AS total_tasks,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(t.status, '')) = ANY($2::text[])
                    )::int AS completed_tasks,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(t.status, '')) NOT IN
                            ('COMPLETED','COMPLETE','DONE','CLOSED')
                    )::int AS active_tasks,
                    COUNT(*) FILTER (
                        WHERE t.due_date IS NOT NULL
                          AND t.due_date < CURRENT_DATE
                          AND UPPER(COALESCE(t.status, '')) NOT IN
                              ('COMPLETED','COMPLETE','DONE','CLOSED')
                    )::int AS overdue_tasks
                FROM tasks t, bounds b
                WHERE t.created_at >= b.start_at
            ),
            qa_stats AS (
                SELECT
                    COUNT(*)::int AS total_qa,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'PASSED'
                    )::int AS passed_qa,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'FAILED'
                    )::int AS failed_qa
                FROM qa_tests q, bounds b
                WHERE q.created_at >= b.start_at
            ),
            ticket_stats AS (
                SELECT
                    COUNT(*)::int AS total_tickets,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(t.status, 'OPEN'))
                            NOT IN ('COMPLETED','COMPLETE','DONE','CLOSED','RESOLVED')
                    )::int AS open_tickets
                FROM tickets t, bounds b
                WHERE t.created_at >= b.start_at
            )
            SELECT
                $1::int AS range_days,
                task_stats.*,
                qa_stats.*,
                ticket_stats.*
            FROM task_stats, qa_stats, ticket_stats
            `,
            [days, completedStatuses]
        );

        return res.json({
            rangeDays: days,
            overview: result.rows[0],
        });
    } catch (error) {
        console.error("Analytics overview error:", error);
        return res.status(500).json({
            message: "Failed to load analytics overview",
        });
    }
};

const getAnalyticsTrend = async (req, res) => {
    try {
        const days = rangeDays(req.query.range);

        const result = await pool.query(
            `
            WITH days AS (
                SELECT generate_series(
                    CURRENT_DATE - ($1::int - 1),
                    CURRENT_DATE,
                    INTERVAL '1 day'
                )::date AS day
            ),
            task_daily AS (
                SELECT
                    DATE(t.created_at) AS day,
                    COUNT(*)::int AS tasks_created,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(t.status, '')) = ANY($2::text[])
                    )::int AS tasks_completed
                FROM tasks t
                WHERE t.created_at >= CURRENT_DATE - ($1::int - 1)
                GROUP BY DATE(t.created_at)
            ),
            qa_daily AS (
                SELECT
                    DATE(q.created_at) AS day,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'PASSED'
                    )::int AS qa_passed,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'FAILED'
                    )::int AS qa_failed
                FROM qa_tests q
                WHERE q.created_at >= CURRENT_DATE - ($1::int - 1)
                GROUP BY DATE(q.created_at)
            ),
            ticket_daily AS (
                SELECT
                    DATE(t.created_at) AS day,
                    COUNT(*)::int AS tickets_created
                FROM tickets t
                WHERE t.created_at >= CURRENT_DATE - ($1::int - 1)
                GROUP BY DATE(t.created_at)
            )
            SELECT
                d.day,
                COALESCE(td.tasks_created, 0)::int AS tasks_created,
                COALESCE(td.tasks_completed, 0)::int AS tasks_completed,
                COALESCE(qd.qa_passed, 0)::int AS qa_passed,
                COALESCE(qd.qa_failed, 0)::int AS qa_failed,
                COALESCE(tkd.tickets_created, 0)::int AS tickets_created
            FROM days d
            LEFT JOIN task_daily td ON td.day = d.day
            LEFT JOIN qa_daily qd ON qd.day = d.day
            LEFT JOIN ticket_daily tkd ON tkd.day = d.day
            ORDER BY d.day ASC
            `,
            [days, completedStatuses]
        );

        return res.json({
            rangeDays: days,
            trend: result.rows,
        });
    } catch (error) {
        console.error("Analytics trend error:", error);
        return res.status(500).json({
            message: "Failed to load analytics trend",
        });
    }
};

const getAnalyticsUsers = async (req, res) => {
    try {
        const days = rangeDays(req.query.range);

        const result = await pool.query(
            `
            WITH bounds AS (
                SELECT NOW() - ($1::int * INTERVAL '1 day') AS start_at
            ),
            task_stats AS (
                SELECT
                    t.assigned_to AS user_id,
                    COUNT(*)::int AS tasks_total,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(t.status, '')) = ANY($2::text[])
                    )::int AS tasks_completed,
                    COUNT(*) FILTER (
                        WHERE t.due_date IS NOT NULL
                          AND t.due_date < CURRENT_DATE
                          AND UPPER(COALESCE(t.status, '')) NOT IN
                              ('COMPLETED','COMPLETE','DONE','CLOSED')
                    )::int AS overdue_tasks
                FROM tasks t, bounds b
                WHERE t.assigned_to IS NOT NULL
                  AND t.created_at >= b.start_at
                GROUP BY t.assigned_to
            ),
            qa_stats AS (
                SELECT
                    t.assigned_to AS user_id,
                    COUNT(q.id)::int AS qa_total,
                    COUNT(q.id) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'PASSED'
                    )::int AS qa_passed,
                    COUNT(q.id) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'FAILED'
                    )::int AS qa_failed
                FROM tasks t
                JOIN qa_tests q ON q.task_id = t.id
                CROSS JOIN bounds b
                WHERE t.assigned_to IS NOT NULL
                  AND q.created_at >= b.start_at
                GROUP BY t.assigned_to
            )
            SELECT
                u.id AS user_id,
                u.name,
                COALESCE(ts.tasks_total, 0)::int AS tasks_total,
                COALESCE(ts.tasks_completed, 0)::int AS tasks_completed,
                COALESCE(ts.overdue_tasks, 0)::int AS overdue_tasks,
                COALESCE(qs.qa_total, 0)::int AS qa_total,
                COALESCE(qs.qa_passed, 0)::int AS qa_passed,
                COALESCE(qs.qa_failed, 0)::int AS qa_failed,
                CASE
                    WHEN COALESCE(ts.tasks_total, 0) = 0 THEN 0
                    ELSE ROUND(
                        (COALESCE(ts.tasks_completed, 0)::numeric /
                         ts.tasks_total) * 100, 2
                    )
                END AS completion_rate,
                CASE
                    WHEN COALESCE(qs.qa_total, 0) = 0 THEN 0
                    ELSE ROUND(
                        (COALESCE(qs.qa_passed, 0)::numeric /
                         qs.qa_total) * 100, 2
                    )
                END AS qa_pass_rate
            FROM users u
            LEFT JOIN task_stats ts ON ts.user_id = u.id
            LEFT JOIN qa_stats qs ON qs.user_id = u.id
            WHERE COALESCE(ts.tasks_total, 0) > 0
               OR COALESCE(qs.qa_total, 0) > 0
            ORDER BY tasks_completed DESC, completion_rate DESC, u.name ASC
            `,
            [days, completedStatuses]
        );

        return res.json({
            rangeDays: days,
            users: result.rows,
        });
    } catch (error) {
        console.error("Analytics users error:", error);
        return res.status(500).json({
            message: "Failed to load user analytics",
        });
    }
};

const getUserHistory = async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!userId) {
            return res.status(400).json({ message: "Valid userId is required" });
        }

        const result = await pool.query(
            `
            SELECT
                t.id,
                t.project_id,
                p.name AS project_name,
                t.title,
                t.description,
                t.status,
                t.priority,
                t.due_date,
                t.created_at,
                t.qa_status,
                COALESCE(qa.failure_count, 0)::int AS qa_failure_count
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN LATERAL (
                SELECT SUM(COALESCE(q.failure_count, 0)) AS failure_count
                FROM qa_tests q
                WHERE q.task_id = t.id
            ) qa ON TRUE
            WHERE t.assigned_to = $1
               OR t.claimed_by = $1
            ORDER BY t.created_at DESC, t.id DESC
            `,
            [userId]
        );

        return res.json({ history: result.rows });
    } catch (error) {
        console.error("User history error:", error);
        return res.status(500).json({
            message: "Failed to fetch work history",
        });
    }
};

const getUserPerformance = async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!userId) {
            return res.status(400).json({ message: "Valid userId is required" });
        }

        const result = await pool.query(
            `
            WITH task_stats AS (
                SELECT
                    COUNT(*)::int AS total_tasks,
                    COUNT(*) FILTER (
                        WHERE UPPER(COALESCE(status, '')) = ANY($2::text[])
                    )::int AS completed_tasks,
                    COUNT(*) FILTER (
                        WHERE due_date IS NOT NULL
                          AND due_date < CURRENT_DATE
                          AND UPPER(COALESCE(status, '')) NOT IN
                              ('COMPLETED','COMPLETE','DONE','CLOSED')
                    )::int AS overdue_tasks
                FROM tasks
                WHERE assigned_to = $1 OR claimed_by = $1
            ),
            qa_stats AS (
                SELECT
                    COUNT(q.id)::int AS qa_total,
                    COUNT(q.id) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'PASSED'
                    )::int AS qa_passed,
                    COUNT(q.id) FILTER (
                        WHERE UPPER(COALESCE(q.status, '')) = 'FAILED'
                    )::int AS qa_failed,
                    COALESCE(SUM(q.failure_count), 0)::int AS qa_failure_count
                FROM qa_tests q
                JOIN tasks t ON t.id = q.task_id
                WHERE t.assigned_to = $1 OR t.claimed_by = $1
            ),
            ticket_stats AS (
                SELECT COUNT(*)::int AS tickets_created
                FROM tickets tk
                JOIN tasks t ON t.project_id = tk.project_id
                WHERE t.assigned_to = $1 OR t.claimed_by = $1
            )
            SELECT
                task_stats.*,
                qa_stats.*,
                ticket_stats.*,
                CASE
                    WHEN task_stats.total_tasks = 0 THEN 0
                    ELSE ROUND(
                        (task_stats.completed_tasks::numeric /
                         task_stats.total_tasks) * 100, 2
                    )
                END AS completion_rate,
                CASE
                    WHEN qa_stats.qa_total = 0 THEN 0
                    ELSE ROUND(
                        (qa_stats.qa_passed::numeric /
                         qa_stats.qa_total) * 100, 2
                    )
                END AS qa_pass_rate
            FROM task_stats, qa_stats, ticket_stats
            `,
            [userId, completedStatuses]
        );

        return res.json({
            userId,
            performance: result.rows[0],
        });
    } catch (error) {
        console.error("User performance error:", error);
        return res.status(500).json({
            message: "Failed to fetch user performance",
        });
    }
};

module.exports = {
    getAnalyticsOverview,
    getAnalyticsTrend,
    getAnalyticsUsers,
    getUserHistory,
    getUserPerformance,
};
