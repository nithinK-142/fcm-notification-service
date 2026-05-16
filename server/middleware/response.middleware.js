const responseMiddleware = (req, res, next) => {
    res.success = (data, statusCode = 200) => {
        res.status(statusCode).json({ success: true, data })
    }
    res.fail = (message, statusCode = 500) => {
        res.status(statusCode).json({ success: false, message })
    }
    next()
}

const errorMiddleware = (error, req, res, next) => {
    const statusCode = error.statusCode ?? 500
    const message = error.message ?? "Internal server error"
    res.fail(message, statusCode)
}

module.exports = { responseMiddleware, errorMiddleware }