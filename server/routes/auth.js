const { Router } = require("express");
const { getModels } = require("../models/models.js");
const { signToken } = require("../middleware/auth.js");

const router = Router()
const { TeamMember } = getModels()

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" })
    }

    const tm = await TeamMember.findOne({ department: "CMT", user_hierarachy: "Checker", email, password })
    if (!tm) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    const token = signToken({ id: tm._id, email: tm.email, name: tm.name, role: tm.user_hierarachy, profile: tm.profile })
    return res.json({ token })
  } catch (error) {
    console.log("[login]", error)
    return res.status(500).json({ message: "Server error" })
  }
})

module.exports = router;
