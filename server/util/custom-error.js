class CustomError extends Error {
    constructor(statusCode, message, cause) {
        super(message)
        this.name = "CustomError"
        this.statusCode = statusCode
        this.cause = cause
    }
}
module.exports = { CustomError }