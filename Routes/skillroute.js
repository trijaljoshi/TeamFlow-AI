const express = require("express");

const router = express.Router();

const {
    addSkill,
    getMySkills,
    updateSkill,
    deleteSkill
} = require("../controller/skillcontroller");

const authMiddleware = require("../middleware/authmiddleware");


// Add skill
router.post(
    "/users/skills",
    authMiddleware,
    addSkill
);


// Get my skills
router.get(
    "/users/skills",
    authMiddleware,
    getMySkills
);


// Update skill
router.patch(
    "/users/skills/:skillId",
    authMiddleware,
    updateSkill
);


// Delete skill
router.delete(
    "/users/skills/:skillId",
    authMiddleware,
    deleteSkill
);


module.exports = router;