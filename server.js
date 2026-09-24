require("dotenv").config();
const authRoutes = require("./Routes/authroutes");
const express = require("express");
const cors = require("cors");
const pool = require("./db/db");
const projectRoutes = require("./Routes/projectroute");
const taskRoutes = require("./Routes/taskroute");
const allTasksRoutes = require("./Routes/alltasksroute");
const qaTestRoutes = require("./Routes/qatestroute");
const ticketRoutes = require("./Routes/ticketroute");
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", taskRoutes);
app.use("/api/all-tasks", allTasksRoutes);
app.use("/api", qaTestRoutes);
app.use("/api", ticketRoutes);

app.get("/", (req, res) => {
  res.json({ message: "TeamFlow backend is running!" });
});

const PORT = 5001;
pool.query("SELECT NOW()", (err, result) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Database connected:", result.rows[0]);
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});