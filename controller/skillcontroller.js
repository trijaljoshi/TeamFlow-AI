const pool = require("../db/db");

// ======================================================
// ADD SKILL
// POST /api/users/skills
// ======================================================
const addSkill = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Accept both `name` and `skill_name`
        const { name, skill_name, proficiency } = req.body;

        const rawSkillName = name ?? skill_name;

        if (
            typeof rawSkillName !== "string" ||
            !rawSkillName.trim()
        ) {
            return res.status(400).json({
                message: "Skill name is required"
            });
        }

        const skillName = rawSkillName.trim();

        // Check duplicate skill for this user
        const existingSkill = await pool.query(
            `SELECT id
             FROM user_skills
             WHERE user_id = $1
             AND LOWER(skill_name) = LOWER($2)`,
            [userId, skillName]
        );

        if (existingSkill.rows.length > 0) {
            return res.status(409).json({
                message: "This skill is already added"
            });
        }

        // Insert skill
        const result = await pool.query(
            `INSERT INTO user_skills
                (user_id, skill_name, proficiency)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [
                userId,
                skillName,
                proficiency || null
            ]
        );

        return res.status(201).json({
            message: "Skill added successfully",
            skill: result.rows[0]
        });

    } catch (error) {
        console.error("Add skill error:", error);

        return res.status(500).json({
            message: "Failed to add skill"
        });
    }
};


// ======================================================
// GET MY SKILLS
// GET /api/users/skills
// ======================================================
const getMySkills = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT
                id,
                skill_name,
                proficiency,
                created_at,
                updated_at
             FROM user_skills
             WHERE user_id = $1
             ORDER BY skill_name ASC`,
            [userId]
        );

        return res.status(200).json({
            skills: result.rows
        });

    } catch (error) {
        console.error("Get skills error:", error);

        return res.status(500).json({
            message: "Failed to fetch skills"
        });
    }
};


// ======================================================
// UPDATE SKILL
// PATCH /api/users/skills/:skillId
// ======================================================
const updateSkill = async (req, res) => {
    try {
        const userId = req.user.userId;
        const skillId = req.params.skillId;

        // Accept both `name` and `skill_name`
        const {
            name,
            skill_name,
            proficiency
        } = req.body;

        const rawSkillName = name ?? skill_name;

        if (
            typeof rawSkillName !== "string" ||
            !rawSkillName.trim()
        ) {
            return res.status(400).json({
                message: "Skill name is required"
            });
        }

        const skillName = rawSkillName.trim();

        // Check duplicate skill
        const existingSkill = await pool.query(
            `SELECT id
             FROM user_skills
             WHERE user_id = $1
             AND LOWER(skill_name) = LOWER($2)
             AND id != $3`,
            [
                userId,
                skillName,
                skillId
            ]
        );

        if (existingSkill.rows.length > 0) {
            return res.status(409).json({
                message: "This skill is already added"
            });
        }

        // Update skill
        const result = await pool.query(
            `UPDATE user_skills
             SET skill_name = $1,
                 proficiency = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             AND user_id = $4
             RETURNING *`,
            [
                skillName,
                proficiency || null,
                skillId,
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Skill not found"
            });
        }

        return res.status(200).json({
            message: "Skill updated successfully",
            skill: result.rows[0]
        });

    } catch (error) {
        console.error("Update skill error:", error);

        return res.status(500).json({
            message: "Failed to update skill"
        });
    }
};


// ======================================================
// DELETE SKILL
// DELETE /api/users/skills/:skillId
// ======================================================
const deleteSkill = async (req, res) => {
    try {
        const userId = req.user.userId;
        const skillId = req.params.skillId;

        const result = await pool.query(
            `DELETE FROM user_skills
             WHERE id = $1
             AND user_id = $2
             RETURNING *`,
            [
                skillId,
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Skill not found"
            });
        }

        return res.status(200).json({
            message: "Skill deleted successfully",
            skill: result.rows[0]
        });

    } catch (error) {
        console.error("Delete skill error:", error);

        return res.status(500).json({
            message: "Failed to delete skill"
        });
    }
};


// ======================================================
// EXPORTS
// ======================================================
module.exports = {
    addSkill,
    getMySkills,
    updateSkill,
    deleteSkill
};