require("dotenv").config();
const authRoutes = require("./Routes/authroutes");
const express = require("express");
const cors = require("cors");
const pool = require("./db/db");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

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