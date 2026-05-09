const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { users } = require("../data/store.js");
const { signToken } = require("../middleware/auth.js");

const router = Router()

router.post("/login", async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" })
  }

  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password" })
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role })
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
})

module.exports = router;
