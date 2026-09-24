const pool = require("../db/db");

const createProject = async (req, res) => {
    try {
        const { name, description, clientrequirements, deadline } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Project name is required" });
        }

        const userId = req.user.userId;
        const projectDescription = description ?? clientrequirements ?? null;

        const result = await pool.query(
            `INSERT INTO projects (name, description, deadline, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, projectDescription, deadline || null, userId]
        );

        res.status(201).json({
            message: "Project created successfully",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("Create project error:", error);
        res.status(500).json({ message: "Failed to create project" });
    }
};

const getProjects = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM projects ORDER BY created_at DESC"
        );

        res.status(200).json({ projects: result.rows });
    } catch (error) {
        console.error("Get projects error:", error);
        res.status(500).json({ message: "Failed to fetch projects" });
    }
};

const completeProject = async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const userId = req.user.userId;

        const projectResult = await pool.query(
            `SELECT id, created_by, status
             FROM projects
             WHERE id = $1`,
            [projectId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ message: "Project not found" });
        }

        const project = projectResult.rows[0];

        // The current backend does not expose a separate manager role.
        // The project creator is therefore the authorized project owner.
        if (String(project.created_by) !== String(userId)) {
            return res.status(403).json({
                message: "Only the project creator can complete this project"
            });
        }

        if (String(project.status || "").toUpperCase() === "COMPLETED") {
            return res.status(400).json({
                message: "Project is already completed"
            });
        }

        const tasksResult = await pool.query(
            `SELECT id, status
             FROM tasks
             WHERE project_id = $1`,
            [projectId]
        );

        if (tasksResult.rows.length === 0) {
            return res.status(400).json({
                message: "Project has no tasks to complete"
            });
        }

        const incompleteTasks = tasksResult.rows.filter((task) => {
            const status = String(task.status || "")
                .trim()
                .toUpperCase();

            return !["COMPLETED", "COMPLETE", "DONE", "CLOSED"].includes(status);
        });

        if (incompleteTasks.length > 0) {
            return res.status(400).json({
                message: "All project tasks must be completed first",
                incompleteTasks: incompleteTasks.length
            });
        }

        const result = await pool.query(
            `UPDATE projects
             SET status = 'COMPLETED'
             WHERE id = $1
             RETURNING *`,
            [projectId]
        );

        return res.status(200).json({
            message: "Project completed successfully",
            project: result.rows[0]
        });
    } catch (error) {
        console.error("Complete project error:", error);
        return res.status(500).json({
            message: "Failed to complete project"
        });
    }
};

module.exports = {
    createProject,
    getProjects,
    completeProject
};