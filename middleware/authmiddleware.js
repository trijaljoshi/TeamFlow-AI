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

        if (!token) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // Verify the JWT using the configured secret
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (!decoded.userId) {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        // Fetch the current user from the actual database schema.
        // The users table does not contain a role column.
        const result = await pool.query(
            `SELECT id, name, email, department
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

        req.user = {
            userId: user.id,
            name: user.name,
            email: user.email,
            department: user.department
        };

        return next();

    } catch (error) {
        console.error("Auth middleware error:", error.message);

        if (
            error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token"
            });
        }

        return res.status(500).json({
            message: "Authentication failed"
        });
    }
};

module.exports = authMiddleware;