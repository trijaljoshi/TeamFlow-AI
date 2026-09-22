const pool = require("../db/db");

const createProject = async (req, res) => {
    try {
        const { name, clientrequirements, deadline } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Project name is required"
            });
        }

        const userId = req.user.userId;

        const result = await pool.query(
            `INSERT INTO projects (name, description, deadline, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, clientrequirements, deadline, userId]
        );

        res.status(201).json({
            message: "Project created successfully",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("Create project error:", error);

        res.status(500).json({
            message: "Failed to create project"
        });
    }
};
const getProjects = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM projects ORDER BY created_at DESC"
        );

        res.status(200).json({
            projects: result.rows
        });

    } catch (error) {
        console.error("Get projects error:", error);

        res.status(500).json({
            message: "Failed to fetch projects"
        });
    }
};

module.exports = { createProject,getProjects };