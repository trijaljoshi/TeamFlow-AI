const express = require("express");
const router = express.Router();

const {
    addSkill,
    getMySkills,
    updateSkill,
    deleteSkill
} = require("../controller/skillcontroller");

router.post("/users/skills", addSkill);
router.get("/users/skills", getMySkills);
router.patch("/users/skills/:skillId", updateSkill);
router.delete("/users/skills/:skillId", deleteSkill);

module.exports = router;