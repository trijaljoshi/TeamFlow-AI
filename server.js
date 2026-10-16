require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db/db");

const authRoutes = require("./Routes/authroutes");
const projectRoutes = require("./Routes/projectroute");
const taskRoutes = require("./Routes/taskroute");
const allTasksRoutes = require("./Routes/alltasksroute");
const qaTestRoutes = require("./Routes/qatestroute");
const ticketRoutes = require("./Routes/ticketroute");
const recommendationRoutes = require("./Routes/recommendationroute");
const notificationRoutes = require("./Routes/notificationroute");
const analyticsRoutes = require("./Routes/analyticsroute");
const userInsightsRoutes = require("./Routes/userinsightroute");
const { sendEmail } = require("./utils/emailService");
require("./jobs/deadlineReminder");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", taskRoutes);
app.use("/api/all-tasks", allTasksRoutes);
app.use("/api", qaTestRoutes);
app.use("/api", ticketRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", userInsightsRoutes);

app.get("/", (req, res) => {
    res.json({ message: "TeamFlow backend is running!" });
});

app.get("/api/test-email", async (req, res) => {
    try {
        await sendEmail({
            to: "YOUR_EMAIL@gmail.com",
            name: "Trijal",
            subject: "TeamFlow AI Email Test",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>TeamFlow AI</h2>
                    <p>This is a test email from your TeamFlow backend.</p>
                    <p>Brevo integration is working successfully. ✅</p>
                </div>
            `,
        });

        res.json({
            success: true,
            message: "Test email sent successfully",
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to send test email",
            error: error.message,
        });
    }
});

const PORT = 5001;

pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Database connected:", result.rows[0]);
    }
});



app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});