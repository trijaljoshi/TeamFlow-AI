const pool = require("../db/db");

const getAllTasks = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                tasks.*,
                projects.name AS project_name,
                users.name AS claimed_by_name
             FROM tasks
             LEFT JOIN projects
                ON tasks.project_id = projects.id
             LEFT JOIN users
                ON tasks.claimed_by = users.id
             ORDER BY tasks.created_at DESC`
        );

        res.status(200).json({
            tasks: result.rows
        });

    } catch (error) {
        console.error("Get all tasks error:", error);

        res.status(500).json({
            message: "Failed to fetch all tasks"
        });
    }
};

module.exports = { getAllTasks };