const { Router } = require("express");
const { getModels } = require("../models/models.js");
const { signToken } = require("../middleware/auth.js");
const { CustomError } = require("../util/custom-error.js");
const { routeHandler } = require("../middleware/request.middleware.js");

const router = Router()
const { TeamMember } = getModels()

router.post("/login", routeHandler(async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      throw new CustomError(400, "Email and password required")
    }

    const tm = await TeamMember.findOne({ department: "CMT", user_hierarachy: "Checker", email, password })
    if (!tm) {
      throw new CustomError(401, "Invalid email or password")
    }

    const token = signToken({ id: tm._id, email: tm.email, name: tm.name, role: tm.user_hierarachy, profile: tm.profile })
    return res.success({ token })
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Login failed", error)
  }
}))

module.exports = router;
