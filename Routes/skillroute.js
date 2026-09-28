const express = require("express");
const router = express.Router();

const {
    addSkill,
    getMySkills,
    updateSkill,
    deleteSkill
} = require("../controller/skillcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Skills
router.post("/users/skills", authMiddleware, addSkill);
router.get("/users/skills", authMiddleware, getMySkills);
router.patch("/users/skills/:skillId", authMiddleware, updateSkill);
router.delete("/users/skills/:skillId", authMiddleware, deleteSkill);

module.exports = router;