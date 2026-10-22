
const pool = require("../db/db");

const getAllTasks = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                tasks.*,
                projects.name AS project_name,
                claimed_user.name AS claimed_by_name,
                assigned_user.name AS assigned_to_name
             FROM tasks
             LEFT JOIN projects
                ON tasks.project_id = projects.id
             LEFT JOIN users AS claimed_user
                ON tasks.claimed_by = claimed_user.id
             LEFT JOIN users AS assigned_user
                ON tasks.assigned_to = assigned_user.id
             ORDER BY tasks.created_at DESC`
        );

        return res.status(200).json({
            tasks: result.rows
        });

    } catch (error) {
        console.error("Get all tasks error:", error);

        return res.status(500).json({
            message: "Failed to fetch all tasks"
        });
    }
};

module.exports = { getAllTasks };
