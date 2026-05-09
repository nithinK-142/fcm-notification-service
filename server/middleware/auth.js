const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" })
  }
  try {
    const payload = jwt.verify(auth.slice(7), SECRET)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" })
}

module.exports = { authenticate, signToken };