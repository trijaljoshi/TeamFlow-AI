const jwt = require("jsonwebtoken");
const pool = require("../db/db");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (!decoded.userId) {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        // Get CURRENT user information from database
        const result = await pool.query(
            `SELECT id, name, email, role, department
             FROM users
             WHERE id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        const user = result.rows[0];

        // Store complete authenticated user
        req.user = {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department
        };

        next();

    } catch (error) {
        console.error("Auth middleware error:", error);

        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

module.exports = authMiddleware;