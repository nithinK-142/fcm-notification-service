const crypto = require("crypto")

const serializeError = (error) => {
    const obj = {
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
    }
    if (error.cause) obj.cause = serializeError(error.cause)
    return obj
}

const requestTracing = (req, res, next) => {
    req.tracing = {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        requestStartedAt: process.hrtime.bigint(),
        step: 0,
    }
    res.setHeader("x-request-id", req.tracing.requestId)
    next()
}

const loggerMiddleware = (req, res, next) => {
    const step = () => `[${req.tracing.requestId.slice(0, 8)}] #${++req.tracing.step}`

    const log = {
        requestId: req.tracing.requestId,
        timestamp: req.tracing.timestamp,
        request: {
            method: req.method,
            url: req.originalUrl,
            path: req.path,
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            query: req.query,
            params: req.params,
            body: req.body,
            headers: {
                origin: req.headers.origin,
                host: req.headers.host,
                referer: req.headers.referer,
                userAgent: req.headers["user-agent"],
                contentType: req.headers["content-type"],
                contentLength: req.headers["content-length"],
                authorization: req.headers["x-authorization"] ? "***" : undefined,
            },
        },
        response: null,
        error: null,
        memory: null,
    }

    console.log(`${step()} request received — ${req.method} ${req.originalUrl}`)

    let responseBody = undefined
    const originalJson = res.json
    res.json = function (body) {
        responseBody = body
        return originalJson.call(this, body)
    }

    const finalizeLog = (type) => {
        if (log.completed) return
        log.completed = true

        const duration = Number(process.hrtime.bigint() - req.tracing.requestStartedAt) / 1e6

        if (req.error) {
            log.error = req.error.serialized
        }

        log.response = {
            type,
            statusCode: res.statusCode,
            duration: `${duration.toFixed(2)}ms`,
            contentLength: res.get("content-length"),
            body: responseBody,
        }

        log.memory = {
            heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        }

        console.log(`${step()} response sent — ${res.statusCode} in ${log.response.duration}`)
        console.log(JSON.stringify(log, null, 2))
    }

    res.on("finish", () => finalizeLog("finish"))
    res.on("close", () => finalizeLog("close"))
    res.on("error", (error) => {
        log.error = serializeError(error)
        finalizeLog("error")
    })

    next()
}

const routeHandler = (controller) => {
    return async (req, res, next) => {
        const step = () => `[${req.tracing.requestId.slice(0, 8)}] #${++req.tracing.step}`
        console.log(`${step()} controller entered — ${req.method} ${req.path} — ${controller.name || "anonymous"}`)
        try {
            await controller(req, res, next)
            console.log(`${step()} controller resolved`)
        } catch (error) {
            req.error = {
                raw: error,
                serialized: serializeError(error),
            }
            console.log(`${step()} controller threw — ${error.message}`)
            next(error)
        }
    }
}

module.exports = { requestTracing, loggerMiddleware, routeHandler }