const express = require("express");

const {
    register,
    login,
    getUsers,
    requestPasswordReset,
    verifyPasswordResetOtp,
    resetPassword,
} = require("../controller/authcontroller");

const authMiddleware = require("../middleware/authmiddleware");

const router = express.Router();


// Register
router.post("/register", register);

// Password reset OTP flow
router.post("/forgot-password", requestPasswordReset);
router.post("/verify-reset-otp", verifyPasswordResetOtp);
router.post("/reset-password", resetPassword);


// Login
router.post("/login", login);


// Get all registered users
router.get(
    "/users",
    authMiddleware,
    getUsers
);


module.exports = router;