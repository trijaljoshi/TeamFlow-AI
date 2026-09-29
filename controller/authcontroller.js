const bcrypt = require("bcrypt");
const pool = require("../db/db");
const jwt = require("jsonwebtoken");


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
};