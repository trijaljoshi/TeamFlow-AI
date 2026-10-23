const bcrypt = require("bcrypt");
const pool = require("../db/db");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../utils/emailService");


/*
=========================================================
REGISTER
=========================================================
*/

const register = async (req, res) => {
    try {

        const {
            name,
            email,
            password,
            department,
            skills
        } = req.body;


        /*
        =================================================
        VALIDATION
        =================================================
        */

        if (!name || !email || !password) {
            return res.status(400).json({
                message:
                    "Name, email and password are required",
            });
        }


        if (
            !department ||
            !String(department).trim()
        ) {
            return res.status(400).json({
                message:
                    "Department is required",
            });
        }


        /*
        * At least one skill is required
        * during registration.
        */

        if (
            !Array.isArray(skills) ||
            skills.length === 0
        ) {
            return res.status(400).json({
                message:
                    "At least one skill is required",
            });
        }


        /*
        =================================================
        CLEAN SKILLS
        =================================================
        */

        const cleanedSkills = [
            ...new Set(
                skills
                    .map((skill) =>
                        String(skill).trim()
                    )
                    .filter(Boolean)
            )
        ];


        if (cleanedSkills.length === 0) {
            return res.status(400).json({
                message:
                    "At least one valid skill is required",
            });
        }


        /*
        =================================================
        CHECK EXISTING USER
        =================================================
        */

        const existingUser =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE email = $1
                `,
                [email]
            );


        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message:
                    "Email already registered",
            });
        }


        /*
        =================================================
        HASH PASSWORD
        =================================================
        */

        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );


        /*
        =================================================
        CREATE USER
        =================================================
        */

        const result =
            await pool.query(
                `
                INSERT INTO users
                    (
                        name,
                        email,
                        password_hash,
                        department
                    )
                VALUES
                    ($1, $2, $3, $4)
                RETURNING
                    id,
                    name,
                    email,
                    department,
                    created_at
                `,
                [
                    name.trim(),
                    email.trim().toLowerCase(),
                    passwordHash,
                    department.trim()
                ]
            );


        const user =
            result.rows[0];


        /*
        =================================================
        SAVE INITIAL SKILLS
        =================================================
        */

        for (const skill of cleanedSkills) {

            await pool.query(
                `
                INSERT INTO user_skills
                    (
                        user_id,
                        skill_name
                    )
                VALUES
                    ($1, $2)
                `,
                [
                    user.id,
                    skill
                ]
            );

        }


        /*
        =================================================
        GENERATE TOKEN
        =================================================
        */

        const token =
            jwt.sign(
                {
                    userId: user.id
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );


        /*
        =================================================
        RESPONSE
        =================================================
        */

        return res.status(201).json({
            message:
                "User registered successfully",

            token,

            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                department:
                    user.department,
                skills:
                    cleanedSkills,
                created_at:
                    user.created_at
            }
        });


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        return res.status(500).json({
            message:
                "Server error",
            error:
                error.message
        });
    }
};


/*
=========================================================
LOGIN
=========================================================
*/

const login = async (req, res) => {
    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {
            return res.status(400).json({
                message:
                    "Email and password are required",
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    password_hash,
                    department
                FROM users
                WHERE email = $1
                `,
                [
                    email.trim().toLowerCase()
                ]
            );


        if (result.rows.length === 0) {
            return res.status(401).json({
                message:
                    "Invalid email or password",
            });
        }


        const user =
            result.rows[0];


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordMatch) {
            return res.status(401).json({
                message:
                    "Invalid email or password",
            });
        }


        /*
        =================================================
        GET USER SKILLS
        =================================================
        */

        const skillsResult =
            await pool.query(
                `
                SELECT
                    id,
                    skill_name,
                    proficiency
                FROM user_skills
                WHERE user_id = $1
                ORDER BY skill_name ASC
                `,
                [user.id]
            );


        /*
        =================================================
        GENERATE JWT
        =================================================
        */

        const token =
            jwt.sign(
                {
                    userId: user.id
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );


        return res.json({

            message:
                "Login successful",

            token,

            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                department:
                    user.department,
                skills:
                    skillsResult.rows
            }
        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        return res.status(500).json({
            message:
                "Server error",
        });
    }
};



/*
=========================================================
PASSWORD RESET: REQUEST OTP, VERIFY OTP, RESET PASSWORD
=========================================================
*/
const requestPasswordReset = async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const genericMessage = "If an account exists for that email, a password reset OTP has been sent.";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }

    try {
        const userResult = await pool.query(
            "SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1",
            [email]
        );

        // Same generic response for unknown accounts to reduce account enumeration.
        if (userResult.rows.length === 0) {
            return res.status(200).json({ message: genericMessage });
        }

        const recent = await pool.query(
            `SELECT COUNT(*)::int AS count, MAX(created_at) AS last_sent
             FROM password_reset_otps
             WHERE email = $1 AND created_at > NOW() - INTERVAL '15 minutes'`,
            [email]
        );
        if (recent.rows[0].count >= 5) {
            return res.status(429).json({ message: "Too many OTP requests. Please try again in 15 minutes." });
        }
        if (recent.rows[0].last_sent && Date.now() - new Date(recent.rows[0].last_sent).getTime() < 60000) {
            return res.status(429).json({ message: "Please wait one minute before requesting another OTP." });
        }

        const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        const otpHash = crypto.createHash("sha256").update(`${email}:${otp}:${process.env.JWT_SECRET || ""}`).digest("hex");

        await pool.query("DELETE FROM password_reset_otps WHERE email = $1", [email]);
        await pool.query(
            `INSERT INTO password_reset_otps (email, otp_hash, expires_at, attempts, verified_at)
             VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NULL)`,
            [email, otpHash]
        );

        try {
            await sendEmail({
                to: userResult.rows[0].email,
                name: userResult.rows[0].name,
                subject: "Your TeamFlow AI password reset code",
                htmlContent: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
                      <h2 style="color:#0d9488">TeamFlow AI</h2>
                      <p>Use this one-time password to reset your password:</p>
                      <div style="font-size:32px;letter-spacing:8px;font-weight:700;padding:16px;background:#f1f5f9;text-align:center;border-radius:8px">${otp}</div>
                      <p>This code expires in 10 minutes and can be used only once.</p>
                      <p>If you did not request this, you can safely ignore this email.</p>
                    </div>`
            });
        } catch (mailError) {
            await pool.query("DELETE FROM password_reset_otps WHERE email = $1", [email]);
            return res.status(503).json({ message: "Email delivery is currently unavailable. Please try again later." });
        }

        return res.status(200).json({ message: genericMessage });
    } catch (error) {
        console.error("Request password reset error:", error.message);
        return res.status(500).json({ message: "Unable to process password reset right now." });
    }
};

const verifyPasswordResetOtp = async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    if (!email || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ message: "Enter the email and six-digit OTP." });
    }

    try {
        const result = await pool.query(
            `SELECT id, otp_hash, expires_at, attempts
             FROM password_reset_otps
             WHERE email = $1
             ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        const row = result.rows[0];
        if (!row || new Date(row.expires_at) <= new Date() || row.attempts >= 5) {
            return res.status(400).json({ message: "OTP is invalid or expired. Request a new one." });
        }

        const submittedHash = crypto.createHash("sha256").update(`${email}:${otp}:${process.env.JWT_SECRET || ""}`).digest("hex");
        const matches = submittedHash.length === row.otp_hash.length &&
            crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(row.otp_hash));

        if (!matches) {
            await pool.query("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1", [row.id]);
            return res.status(400).json({ message: "OTP is invalid or expired." });
        }

        await pool.query(
            "UPDATE password_reset_otps SET verified_at = NOW() WHERE id = $1",
            [row.id]
        );
        return res.status(200).json({ message: "OTP verified. You can now reset your password." });
    } catch (error) {
        console.error("Verify password reset OTP error:", error.message);
        return res.status(500).json({ message: "Unable to verify OTP right now." });
    }
};

const resetPassword = async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || password.length < 8) {
        return res.status(400).json({ message: "Enter your email and a password of at least 8 characters." });
    }

    try {
        const result = await pool.query(
            `SELECT id FROM password_reset_otps
             WHERE email = $1 AND verified_at IS NOT NULL
               AND verified_at > NOW() - INTERVAL '10 minutes'
               AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Verify a valid OTP before resetting your password." });
        }

        const userResult = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1", [email]);
        if (userResult.rows.length === 0) {
            await pool.query("DELETE FROM password_reset_otps WHERE email = $1", [email]);
            return res.status(400).json({ message: "Unable to reset password. Request a new OTP." });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userResult.rows[0].id]);
        await pool.query("DELETE FROM password_reset_otps WHERE email = $1", [email]);

        return res.status(200).json({ message: "Password reset successfully. Please sign in with your new password." });
    } catch (error) {
        console.error("Reset password error:", error.message);
        return res.status(500).json({ message: "Unable to reset password right now." });
    }
};

/*
=========================================================
GET ALL USERS
Used by All Tasks → Assign To
=========================================================
*/

const getUsers = async (req, res) => {
    try {

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    department,
                    created_at
                FROM users
                ORDER BY name ASC
                `
            );


        res.status(200).json({
            users:
                result.rows,
        });


    } catch (error) {

        console.error(
            "Get users error:",
            error
        );


        res.status(500).json({
            message:
                "Failed to fetch users",
        });
    }
};


module.exports = {
    register,
    login,
    getUsers,
    requestPasswordReset,
    verifyPasswordResetOtp,
    resetPassword,
};