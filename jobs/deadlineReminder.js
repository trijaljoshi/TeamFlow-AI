const cron = require("node-cron");
const pool = require("../db/db");

const { sendEmail } = require("../utils/emailService");

const COMPLETED_STATUSES = [
    "COMPLETED",
    "COMPLETE",
    "DONE",
    "CLOSED",
];

const sendDeadlineEmails = async (task, daysLeft) => {
    const recipients = [];

    // Assigned employee
    if (task.assigned_user_email) {
        recipients.push({
            email: task.assigned_user_email,
            name: task.assigned_user_name,
        });
    }

    // Project manager
    if (
        task.manager_email &&
        task.manager_email !== task.assigned_user_email
    ) {
        recipients.push({
            email: task.manager_email,
            name: task.manager_name,
        });
    }

    for (const recipient of recipients) {
        try {
            await sendEmail({
                to: recipient.email,
                name: recipient.name,

                subject:
                    daysLeft === 1
                        ? `⚠️ Task Deadline Tomorrow - ${task.title}`
                        : `⏰ Task Deadline Approaching - ${task.title}`,

                htmlContent: `
                    <div style="
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: auto;
                        padding: 30px;
                    ">

                        <h2>TeamFlow AI</h2>

                        <p>
                            Hi <strong>
                                ${recipient.name || "there"}
                            </strong>,
                        </p>

                        <p>
                            This is a reminder that the following
                            task is approaching its deadline.
                        </p>

                        <div style="
                            border: 1px solid #ddd;
                            border-radius: 10px;
                            padding: 20px;
                            margin: 20px 0;
                        ">

                            <p>
                                <strong>Project:</strong>
                                ${task.project_name}
                            </p>

                            <p>
                                <strong>Task:</strong>
                                ${task.title}
                            </p>

                            <p>
                                <strong>Deadline:</strong>
                                ${new Date(
                                    task.due_date
                                ).toLocaleString("en-IN")}
                            </p>

                            <p>
                                <strong>Time remaining:</strong>
                                ${daysLeft} day${
                                    daysLeft === 1 ? "" : "s"
                                }
                            </p>

                        </div>

                        <p>
                            Please make sure the task is completed
                            before the deadline.
                        </p>

                        <p>
                            Regards,<br>
                            <strong>TeamFlow AI</strong>
                        </p>

                    </div>
                `,
            });

        } catch (error) {
            console.error(
                `Failed to send deadline email for task ${task.id}:`,
                error.message
            );
        }
    }
};


const checkDeadlines = async () => {
    try {
        console.log(
            "Checking task deadlines..."
        );

        const result = await pool.query(`
            SELECT
                t.id,
                t.title,
                t.due_date,
                t.status,

                t.deadline_3d_email_sent,
                t.deadline_1d_email_sent,

                p.name AS project_name,
                p.created_by AS manager_id,

                assigned_user.name AS assigned_user_name,
                assigned_user.email AS assigned_user_email,

                manager.name AS manager_name,
                manager.email AS manager_email

            FROM tasks t

            INNER JOIN projects p
                ON p.id = t.project_id

            LEFT JOIN users assigned_user
                ON assigned_user.id = t.assigned_to

            LEFT JOIN users manager
                ON manager.id = p.created_by

            WHERE t.due_date IS NOT NULL

            AND UPPER(
                COALESCE(t.status, '')
            ) NOT IN (
                'COMPLETED',
                'COMPLETE',
                'DONE',
                'CLOSED'
            )
        `);

        const now = new Date();

        for (const task of result.rows) {

            const dueDate =
                new Date(task.due_date);

            const difference =
                dueDate.getTime() -
                now.getTime();

            const daysLeft =
                Math.ceil(
                    difference /
                    (1000 * 60 * 60 * 24)
                );

            // -----------------------------
            // 3 DAY REMINDER
            // -----------------------------

            if (
                daysLeft <= 3 &&
                daysLeft > 1 &&
                !task.deadline_3d_email_sent
            ) {

                console.log(
                    `Sending 3-day reminder for task ${task.id}`
                );

                await sendDeadlineEmails(
                    task,
                    3
                );

                await pool.query(
                    `
                    UPDATE tasks
                    SET deadline_3d_email_sent = TRUE
                    WHERE id = $1
                    `,
                    [task.id]
                );
            }


            // -----------------------------
            // 1 DAY REMINDER
            // -----------------------------

            if (
                daysLeft <= 1 &&
                daysLeft > 0 &&
                !task.deadline_1d_email_sent
            ) {

                console.log(
                    `Sending 1-day reminder for task ${task.id}`
                );

                await sendDeadlineEmails(
                    task,
                    1
                );

                await pool.query(
                    `
                    UPDATE tasks
                    SET deadline_1d_email_sent = TRUE
                    WHERE id = $1
                    `,
                    [task.id]
                );
            }
        }

    } catch (error) {

        console.error(
            "Deadline scheduler error:",
            error
        );
    }
};


// ---------------------------------------
// RUN EVERY HOUR
// ---------------------------------------

cron.schedule(
    "0 * * * *",
    () => {
        checkDeadlines();
    }
);

console.log(
    "Deadline reminder scheduler started."
);


// ---------------------------------------
// RUN ON SERVER START
// ---------------------------------------

checkDeadlines();