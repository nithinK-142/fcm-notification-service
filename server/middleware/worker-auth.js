const crypto = require("crypto")

function verifyWorkerSignature(req, res, next) {
    const timestamp = req.headers["x-timestamp"]
    const signature = req.headers["x-signature"]

    if (!timestamp || !signature) {
        return res.status(401).json({ message: "Missing signature" })
    }

    // Reject if older than 5 minutes
    if (Date.now() - parseInt(timestamp) > 5 * 60 * 1000) {
        return res.status(401).json({ message: "Request expired" })
    }

    const expected = crypto
        .createHmac("sha256", process.env.SERVER_SECRET)
        .update(`${timestamp}:${JSON.stringify(req.body)}`)
        .digest("hex")

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return res.status(401).json({ message: "Invalid signature" })
    }

    next()
}


module.exports = { verifyWorkerSignature };