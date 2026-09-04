const bcrypt = require("bcrypt");
const pool = require("../db/db");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // 2. Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Insert user into database
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    // 5. Send response
    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};
const login = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // 1. Check required fields
      if (!email || !password) {
        return res.status(400).json({
          message: "Email and password are required",
        });
      }
  
      // 2. Find user by email
      const result = await pool.query(
        "SELECT id, name, email, password_hash FROM users WHERE email = $1",
        [email]
      );
  
      if (result.rows.length === 0) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }
  
      const user = result.rows[0];
  
      // 3. Compare password
      const passwordMatch = await bcrypt.compare(
        password,
        user.password_hash
      );
  
      if (!passwordMatch) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }
  
      // 4. Create JWT
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
  
      // 5. Send response
      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
  
      res.status(500).json({
        message: "Server error",
      });
    }
  };
  
  module.exports = { register, login };
 