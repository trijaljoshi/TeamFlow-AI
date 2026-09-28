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
            "python3",
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

module.exports = {
    getTaskRecommendations
};