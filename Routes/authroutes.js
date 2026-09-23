const express = require("express");

const {
    register,
    login,
    getUsers,
} = require("../controller/authcontroller");

const authMiddleware = require("../middleware/authmiddleware");

const router = express.Router();


// Register
router.post("/register", register);


// Login
router.post("/login", login);


// Get all registered users
router.get(
    "/users",
    authMiddleware,
    getUsers
);


module.exports = router;