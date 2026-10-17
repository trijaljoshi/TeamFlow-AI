const pool = require("../db/db");
const { spawn } = require("child_process");

const getTaskRecommendations = async (req, res) => {
    try {
        const { taskId } = req.params;

        // 1. Get task
        const taskResult = await pool.query(
            `
            SELECT
                id,
                title,
                priority,
                due_date,
                required_skills
            FROM tasks
            WHERE id = $1
            `,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        const task = taskResult.rows[0];

        // 2. Convert priority to ML value
        const priorityMap = {
            LOW: 1,
            MEDIUM: 2,
            HIGH: 3,
            low: 1,
            medium: 2,
            high: 3
        };

        const taskPriority =
            priorityMap[task.priority] || 2;

        // 3. Calculate days until deadline
        let daysUntilDeadline = 7;

        if (task.due_date) {
            const today = new Date();
            const deadline = new Date(task.due_date);

            daysUntilDeadline = Math.ceil(
                (deadline.getTime() - today.getTime()) /
                (1000 * 60 * 60 * 24)
            );
        }

        // 4. Get all employees
        const usersResult = await pool.query(
            `
            SELECT id, name, email
            FROM users
            ORDER BY id
            `
        );

        const employees = [];

        // 5. Build features for every employee
        for (const user of usersResult.rows) {

            // -----------------------------
            // TASK PERFORMANCE
            // -----------------------------

            const historyResult = await pool.query(
                `
                SELECT
                    COUNT(*) AS total_tasks,

                    COUNT(*) FILTER (
                        WHERE completion_status = 'COMPLETED'
                    ) AS completed_tasks,

                    COUNT(*) FILTER (
                        WHERE was_on_time = true
                    ) AS on_time_tasks,

                    AVG(
                        EXTRACT(
                            EPOCH FROM (
                                completed_at - claimed_at
                            )
                        ) / 3600
                    ) AS avg_completion_hours

                FROM task_history
                WHERE user_id = $1
                `,
                [user.id]
            );

            const history = historyResult.rows[0];

            const totalTasks =
                Number(history.total_tasks || 0);

            const completedTasks =
                Number(history.completed_tasks || 0);

            const onTimeTasks =
                Number(history.on_time_tasks || 0);

            const completionRate =
                totalTasks > 0
                    ? completedTasks / totalTasks
                    : 0.5;

            const onTimeRate =
                totalTasks > 0
                    ? onTimeTasks / totalTasks
                    : 0.5;

            const averageCompletionHours =
                history.avg_completion_hours
                    ? Number(history.avg_completion_hours)
                    : 40;

            // -----------------------------
            // QA PERFORMANCE
            // -----------------------------

            const qaResult = await pool.query(
                `
                SELECT
                    COUNT(*) AS total_attempts,

                    COUNT(*) FILTER (
                        WHERE result = 'PASSED'
                    ) AS passed

                FROM qa_history
                WHERE user_id = $1
                `,
                [user.id]
            );

            const qa = qaResult.rows[0];

            const totalQA =
                Number(qa.total_attempts || 0);

            const passedQA =
                Number(qa.passed || 0);

            const qaPassRate =
                totalQA > 0
                    ? passedQA / totalQA
                    : 0.5;

            // -----------------------------
            // ACTIVE TASKS
            // -----------------------------

            const activeTasksResult = await pool.query(
                `
                SELECT COUNT(*) AS count
                FROM tasks
                WHERE
                    (assigned_to = $1 OR claimed_by = $1)
                    AND LOWER(status) NOT IN (
                        'completed',
                        'closed'
                    )
                `,
                [user.id]
            );

            const activeTasks =
                Number(activeTasksResult.rows[0].count || 0);

            // -----------------------------
            // ACTIVE TICKETS
            // -----------------------------

            const activeTicketsResult = await pool.query(
                `
                SELECT COUNT(*) AS count
                FROM tickets
                WHERE
                    claimed_by = $1
                    AND LOWER(status) NOT IN (
                        'completed',
                        'closed'
                    )
                `,
                [user.id]
            );

            const activeTickets =
                Number(activeTicketsResult.rows[0].count || 0);

            // -----------------------------
            // USER SKILLS
            // -----------------------------

            const skillsResult = await pool.query(
                `
                SELECT
                    skill_name,
                    proficiency
                FROM user_skills
                WHERE user_id = $1
                `,
                [user.id]
            );

            const userSkills = skillsResult.rows;

            // -----------------------------
            // SKILL MATCH
            // -----------------------------

            const requiredSkills =
                Array.isArray(task.required_skills)
                    ? task.required_skills
                    : [];

            let skillMatch = 0.5;
            let skillProficiency = 1;

            if (requiredSkills.length > 0) {

                const normalizedRequired =
                    requiredSkills.map(skill =>
                        skill.toLowerCase().trim()
                    );

                const matchedSkills =
                    userSkills.filter(skill =>
                        normalizedRequired.includes(
                            skill.skill_name
                                .toLowerCase()
                                .trim()
                        )
                    );

                skillMatch =
                    matchedSkills.length /
                    requiredSkills.length;

                const proficiencyMap = {
                    BEGINNER: 0,
                    INTERMEDIATE: 1,
                    ADVANCED: 2,
                    EXPERT: 3
                };

                if (matchedSkills.length > 0) {

                    const values =
                        matchedSkills.map(skill =>
                            proficiencyMap[
                                String(
                                    skill.proficiency || ""
                                ).toUpperCase()
                            ] ?? 1
                        );

                    skillProficiency =
                        values.reduce(
                            (sum, value) =>
                                sum + value,
                            0
                        ) / values.length;
                }
            }

            // -----------------------------
            // SIMILAR TASK SUCCESS
            // -----------------------------

            // First version:
            // use overall completion rate.
            const similarTaskSuccessRate =
                completionRate;

            // -----------------------------
            // FINAL ML FEATURES
            // -----------------------------

            employees.push({
                employeeId: user.id,

                skill_match:
                    skillMatch,

                skill_proficiency:
                    skillProficiency,

                active_tasks:
                    activeTasks,

                active_tickets:
                    activeTickets,

                task_priority:
                    taskPriority,

                days_until_deadline:
                    daysUntilDeadline,

                completion_rate:
                    completionRate,

                on_time_rate:
                    onTimeRate,

                avg_completion_hours:
                    averageCompletionHours,

                qa_pass_rate:
                    qaPassRate,

                similar_task_success_rate:
                    similarTaskSuccessRate
            });
        }

        // 6. Send employees to Python ML model
        const pythonProcess = spawn(
            "ml/venv/bin/python",
            [
                "ml/scripts/recommend.py",
                JSON.stringify(employees)
            ],
            {
                cwd: process.cwd()
            }
        );

        let output = "";
        let errorOutput = "";

        pythonProcess.stdout.on(
            "data",
            data => {
                output += data.toString();
            }
        );

        pythonProcess.stderr.on(
            "data",
            data => {
                errorOutput += data.toString();
            }
        );

        pythonProcess.on(
            "close",
            code => {

                if (code !== 0) {
                    console.error(
                        "Python error:",
                        errorOutput
                    );

                    return res.status(500).json({
                        message:
                            "ML recommendation failed",
                        error: errorOutput
                    });
                }

                try {

                    const recommendations =
                        JSON.parse(output);

                    if (recommendations.error) {
                        return res.status(500).json(
                            recommendations
                        );
                    }

                    return res.json({
                        task: {
                            id: task.id,
                            title: task.title,
                            priority: task.priority,
                            dueDate: task.due_date,
                            requiredSkills:
                                task.required_skills
                        },

                        recommendations
                    });

                } catch (error) {

                    console.error(
                        "Invalid ML output:",
                        output
                    );

                    return res.status(500).json({
                        message:
                            "Invalid response from ML model",
                        error: error.message
                    });
                }
            }
        );

    } catch (error) {

        console.error(
            "Recommendation controller error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to generate recommendations",
            error: error.message
        });
    }
};




// Preview recommendations before a task is saved. Supports both project tasks
// (projectId supplied) and individual tasks (no projectId).
const getPreviewTaskRecommendations = async (req, res) => {
    try {
        const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
        const title = String(req.query.title || '').trim();
        const description = String(req.query.description || '').trim();
        const priorityMap = { LOW: 1, MEDIUM: 2, HIGH: 3 };
        const priority = String(req.query.priority || 'MEDIUM').toUpperCase();
        const dueDate = req.query.dueDate ? new Date(req.query.dueDate) : null;
        const daysUntilDeadline = dueDate && !Number.isNaN(dueDate.getTime())
            ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : 7;

        if (!title) return res.status(400).json({ message: 'Task title is required.' });

        const usersResult = await pool.query(
            `SELECT id, name, email, department FROM users ORDER BY id`
        );
        const taskText = `${title} ${description}`.toLowerCase();
        const candidates = [];
        // Only recommend other users from the manager's department when their
        // department is set. Legacy accounts without a department remain usable.
        const managerDepartment = String(req.user?.department || '').trim().toLowerCase();
        const eligibleUsers = usersResult.rows.filter(user => {
            if (Number(user.id) === userId) return false;
            if (!managerDepartment) return true;
            return String(user.department || '').trim().toLowerCase() === managerDepartment;
        });

        for (const user of eligibleUsers) {
            const [historyResult, qaResult, activeTasksResult, activeTicketsResult, skillsResult] = await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS total_tasks,
                                   COUNT(*) FILTER (WHERE UPPER(COALESCE(completion_status,'')) = 'COMPLETED')::int AS completed_tasks,
                                   COUNT(*) FILTER (WHERE was_on_time = TRUE)::int AS on_time_tasks,
                                   AVG(EXTRACT(EPOCH FROM (completed_at - claimed_at))/3600) AS avg_completion_hours
                            FROM task_history WHERE user_id = $1`, [user.id]),
                pool.query(`SELECT COUNT(*)::int AS total_attempts,
                                   COUNT(*) FILTER (WHERE UPPER(COALESCE(result,'')) = 'PASSED')::int AS passed
                            FROM qa_history WHERE user_id = $1`, [user.id]),
                pool.query(`SELECT COUNT(*)::int AS count FROM tasks
                            WHERE (assigned_to = $1 OR claimed_by = $1)
                              AND UPPER(COALESCE(status,'')) NOT IN ('COMPLETED','COMPLETE','DONE','CLOSED')`, [user.id]),
                pool.query(`SELECT COUNT(*)::int AS count FROM tickets
                            WHERE claimed_by = $1 AND LOWER(COALESCE(status,'')) NOT IN ('completed','closed','resolved')`, [user.id]),
                pool.query(`SELECT skill_name, proficiency FROM user_skills WHERE user_id = $1`, [user.id])
            ]);

            const history = historyResult.rows[0] || {};
            const qa = qaResult.rows[0] || {};
            const skills = skillsResult.rows || [];
            const totalTasks = Number(history.total_tasks || 0);
            const completionRate = totalTasks ? Number(history.completed_tasks || 0) / totalTasks : 0.5;
            const onTimeRate = totalTasks ? Number(history.on_time_tasks || 0) / totalTasks : 0.5;
            const totalQa = Number(qa.total_attempts || 0);
            const qaPassRate = totalQa ? Number(qa.passed || 0) / totalQa : 0.5;
            const skillHits = skills.filter(skill => {
                const name = String(skill.skill_name || '').toLowerCase().trim();
                return name && (taskText.includes(name) || name.split(/[^a-z0-9+#.]+/).filter(Boolean).some(word => word.length > 2 && taskText.includes(word)));
            });
            const skillMatch = skills.length ? Math.min(1, skillHits.length / Math.max(1, Math.min(skills.length, 3))) : 0.35;
            const proficiencyMap = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2, EXPERT: 3 };
            const skillProficiency = skillHits.length
                ? skillHits.reduce((sum, skill) => sum + (proficiencyMap[String(skill.proficiency || '').toUpperCase()] ?? 1), 0) / skillHits.length
                : 1;

            candidates.push({
                employeeId: user.id,
                skill_match: skillMatch,
                skill_proficiency: skillProficiency,
                active_tasks: Number(activeTasksResult.rows[0]?.count || 0),
                active_tickets: Number(activeTicketsResult.rows[0]?.count || 0),
                task_priority: priorityMap[priority] || 2,
                days_until_deadline: daysUntilDeadline,
                completion_rate: completionRate,
                on_time_rate: onTimeRate,
                avg_completion_hours: history.avg_completion_hours == null ? 40 : Number(history.avg_completion_hours),
                qa_pass_rate: qaPassRate,
                similar_task_success_rate: completionRate
            });
        }

        if (!candidates.length) return res.json({ recommendations: [] });
        const pythonCommand = process.env.PYTHON_PATH || 'ml/venv/bin/python';
        const pythonProcess = spawn(pythonCommand, ['ml/scripts/recommend.py', JSON.stringify(candidates)], { cwd: process.cwd() });
        let output = '';
        let errorOutput = '';
        pythonProcess.stdout.on('data', chunk => { output += chunk.toString(); });
        pythonProcess.stderr.on('data', chunk => { errorOutput += chunk.toString(); });
        pythonProcess.on('error', error => {
            console.error('Could not start preview recommendation model:', error);
            if (!res.headersSent) res.status(500).json({ message: 'Could not start the ML recommendation process.', error: error.message });
        });
        pythonProcess.on('close', code => {
            if (res.headersSent) return;
            if (code !== 0) return res.status(500).json({ message: 'ML recommendation failed', error: errorOutput || output });
            try {
                const scored = JSON.parse(output);
                if (!Array.isArray(scored)) return res.status(500).json({ message: 'Invalid response from ML model' });
                const userById = new Map(eligibleUsers.map(user => [String(user.id), user]));
                const recommendations = scored.map(item => {
                    const id = item.employeeId ?? item.userId ?? item.id;
                    const user = userById.get(String(id));
                    if (!user) return null;
                    const reasons = [];
                    const candidate = candidates.find(value => String(value.employeeId) === String(id));
                    if (candidate?.skill_match >= 0.6) reasons.push('Relevant skill match');
                    if (candidate?.active_tasks <= 2) reasons.push('Manageable current workload');
                    if (candidate?.completion_rate >= 0.7) reasons.push('Strong task completion history');
                    if (!reasons.length) reasons.push('Ranked using skills, workload, deadlines and QA history');
                    return {
                        employeeId: user.id,
                        name: user.name || user.email || `User ${user.id}`,
                        recommendationScore: Number(item.successProbability ?? item.recommendationScore ?? item.score ?? 0),
                        successProbability: Number(item.successProbability ?? item.recommendationScore ?? item.score ?? 0),
                        prediction: item.prediction,
                        rank: item.rank,
                        reasons,
                        source: 'ml'
                    };
                }).filter(Boolean).sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, 5);
                return res.json({ title, recommendations });
            } catch (error) {
                console.error('Invalid preview ML output:', output);
                return res.status(500).json({ message: 'Invalid response from ML model', error: error.message });
            }
        });
    } catch (error) {
        console.error('Preview recommendation error:', error);
        return res.status(500).json({ message: 'Failed to generate preview recommendations', error: error.message });
    }
};

// ======================================================
// USER-SIDE TASK RECOMMENDATIONS
// GET /api/recommendations/my-tasks
// Scores available tasks for the authenticated user.
// This uses the same trained model as the manager-side route.
// ======================================================
const getMyTaskRecommendations = async (req, res) => {
    try {
        const userId = req.user.userId;

        const userResult = await pool.query(
            `SELECT id, name, department FROM users WHERE id = $1`,
            [userId]
        );
        if (!userResult.rows.length) {
            return res.status(404).json({ message: "User not found" });
        }
        const user = userResult.rows[0];

        // Recommend only tasks that have not been assigned or claimed,
        // and are not already finished.
        const tasksResult = await pool.query(
            `SELECT t.id, t.title, t.description, t.priority, t.due_date,
                    t.required_skills, t.status, t.project_id,
                    p.name AS project_name
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             WHERE t.assigned_to IS NULL
               AND t.claimed_by IS NULL
               AND UPPER(COALESCE(t.status, 'TODO')) NOT IN
                   ('COMPLETED', 'COMPLETE', 'DONE', 'CLOSED')
             ORDER BY t.created_at DESC`
        );
        const tasks = tasksResult.rows;
        if (!tasks.length) {
            return res.json({
                user: { id: user.id, name: user.name, department: user.department },
                recommendations: [],
                message: "There are no unclaimed tasks available right now."
            });
        }

        const [historyResult, qaResult, workloadResult, ticketsResult, skillsResult] =
            await Promise.all([
                pool.query(
                    `SELECT COUNT(*)::int AS total_tasks,
                            COUNT(*) FILTER (WHERE UPPER(COALESCE(completion_status,'')) = 'COMPLETED')::int AS completed_tasks,
                            COUNT(*) FILTER (WHERE was_on_time = TRUE)::int AS on_time_tasks,
                            AVG(EXTRACT(EPOCH FROM (completed_at - claimed_at))/3600) AS avg_completion_hours
                     FROM task_history WHERE user_id = $1`,
                    [userId]
                ),
                pool.query(
                    `SELECT COUNT(*)::int AS total_attempts,
                            COUNT(*) FILTER (WHERE UPPER(COALESCE(result,'')) = 'PASSED')::int AS passed
                     FROM qa_history WHERE user_id = $1`,
                    [userId]
                ),
                pool.query(
                    `SELECT COUNT(*)::int AS count FROM tasks
                     WHERE (assigned_to = $1 OR claimed_by = $1)
                       AND UPPER(COALESCE(status,'')) NOT IN ('COMPLETED','COMPLETE','DONE','CLOSED')`,
                    [userId]
                ),
                pool.query(
                    `SELECT COUNT(*)::int AS count FROM tickets
                     WHERE claimed_by = $1
                       AND LOWER(COALESCE(status,'')) NOT IN ('completed','closed')`,
                    [userId]
                ),
                pool.query(
                    `SELECT skill_name, proficiency FROM user_skills WHERE user_id = $1`,
                    [userId]
                )
            ]);

        const history = historyResult.rows[0];
        const qa = qaResult.rows[0];
        const totalTasks = Number(history.total_tasks || 0);
        const completionRate = totalTasks ? Number(history.completed_tasks || 0) / totalTasks : 0.5;
        const onTimeRate = totalTasks ? Number(history.on_time_tasks || 0) / totalTasks : 0.5;
        const totalQA = Number(qa.total_attempts || 0);
        const qaPassRate = totalQA ? Number(qa.passed || 0) / totalQA : 0.5;
        const activeTasks = Number(workloadResult.rows[0].count || 0);
        const activeTickets = Number(ticketsResult.rows[0].count || 0);
        const averageCompletionHours = history.avg_completion_hours == null
            ? 40 : Number(history.avg_completion_hours);
        const userSkills = skillsResult.rows;
        const proficiencyMap = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2, EXPERT: 3 };

        const candidates = tasks.map(task => {
            const requiredSkills = Array.isArray(task.required_skills)
                ? task.required_skills
                : (typeof task.required_skills === "string"
                    ? (() => { try { const parsed = JSON.parse(task.required_skills); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })()
                    : []);
            const normalizedRequired = requiredSkills.map(s => String(s).toLowerCase().trim());
            const matched = userSkills.filter(s =>
                normalizedRequired.includes(String(s.skill_name).toLowerCase().trim())
            );
            const skillMatch = normalizedRequired.length
                ? matched.length / normalizedRequired.length : 0.5;
            const skillProficiency = matched.length
                ? matched.reduce((sum, s) => sum + (proficiencyMap[String(s.proficiency || "").toUpperCase()] ?? 1), 0) / matched.length
                : 1;
            const priorityMap = { LOW: 1, MEDIUM: 2, HIGH: 3 };
            let daysUntilDeadline = 7;
            if (task.due_date) {
                daysUntilDeadline = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000);
            }
            return {
                employeeId: task.id, // recommend.py returns this identifier; here it is the task id
                skill_match: skillMatch,
                skill_proficiency: skillProficiency,
                active_tasks: activeTasks,
                active_tickets: activeTickets,
                task_priority: priorityMap[String(task.priority || "MEDIUM").toUpperCase()] || 2,
                days_until_deadline: daysUntilDeadline,
                completion_rate: completionRate,
                on_time_rate: onTimeRate,
                avg_completion_hours: averageCompletionHours,
                qa_pass_rate: qaPassRate,
                similar_task_success_rate: completionRate
            };
        });

        const pythonCommand = process.env.PYTHON_PATH || "ml/venv/bin/python";
        const pythonProcess = spawn(
            pythonCommand,
            ["ml/scripts/recommend.py", JSON.stringify(candidates)],
            { cwd: process.cwd() }
        );

        let output = "";
        let errorOutput = "";
        pythonProcess.stdout.on("data", data => { output += data.toString(); });
        pythonProcess.stderr.on("data", data => { errorOutput += data.toString(); });

        pythonProcess.on("error", error => {
            console.error("Could not start recommendation model:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    message: "Could not start the ML recommendation process. Check PYTHON_PATH and ML dependencies.",
                    error: error.message
                });
            }
        });

        pythonProcess.on("close", code => {
            if (res.headersSent) return;
            if (code !== 0) {
                console.error("User recommendation Python error:", errorOutput);
                return res.status(500).json({
                    message: "ML recommendation failed",
                    error: errorOutput || output
                });
            }
            try {
                const scored = JSON.parse(output);
                if (!Array.isArray(scored)) {
                    return res.status(500).json({
                        message: "Invalid response from ML model",
                        error: scored.error || "Expected a recommendation array"
                    });
                }
                const taskById = new Map(tasks.map(task => [String(task.id), task]));
                const recommendations = scored
                    .map(item => {
                        const task = taskById.get(String(item.employeeId));
                        if (!task) return null;
                        const requiredSkills = Array.isArray(task.required_skills) ? task.required_skills : [];
                        const matchedSkills = userSkills
                            .filter(s => requiredSkills.map(v => String(v).toLowerCase().trim())
                                .includes(String(s.skill_name).toLowerCase().trim()))
                            .map(s => s.skill_name);
                        const reasons = [];
                        if (matchedSkills.length) reasons.push(`Matches your skills: ${matchedSkills.join(", ")}`);
                        if (activeTasks <= 2) reasons.push("Your current workload is relatively low");
                        if (completionRate >= 0.7) reasons.push("Your task completion history is strong");
                        if (!reasons.length) reasons.push("Ranked using your skills, workload, and performance history");
                        return {
                            taskId: task.id,
                            title: task.title,
                            description: task.description,
                            projectId: task.project_id,
                            projectName: task.project_name,
                            priority: task.priority,
                            dueDate: task.due_date,
                            status: task.status,
                            requiredSkills,
                            successProbability: item.successProbability,
                            prediction: item.prediction,
                            rank: item.rank,
                            reasons
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.successProbability - a.successProbability);

                return res.json({
                    user: { id: user.id, name: user.name, department: user.department },
                    count: recommendations.length,
                    recommendations
                });
            } catch (error) {
                console.error("Could not parse user recommendation output:", output);
                return res.status(500).json({
                    message: "Invalid response from ML model",
                    error: error.message
                });
            }
        });
    } catch (error) {
        console.error("User task recommendation error:", error);
        return res.status(500).json({
            message: "Failed to generate user task recommendations",
            error: error.message
        });
    }
};


module.exports = {
    getTaskRecommendations,
    getPreviewTaskRecommendations,
    getMyTaskRecommendations
};