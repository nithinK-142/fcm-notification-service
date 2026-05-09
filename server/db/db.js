const mongoose = require("mongoose");
const { logWithTimestamp } = require("../util/helper.js");

function createDBConnection(MONGO_URI, DB_NAME, label) {
    const start = Date.now();

    const conn = mongoose.createConnection(MONGO_URI, {dbName: DB_NAME});

    conn.on("connected", () => {
        const time = Date.now() - start;

        logWithTimestamp(`[createDBConnection] [${label}] Connected!`);
        logWithTimestamp(`[createDBConnection] [${label}] • Host: ${conn.host}`);
        logWithTimestamp(`[createDBConnection] [${label}] • PORT: ${conn.port}`);
        logWithTimestamp(`[createDBConnection] [${label}] • Database: ${conn.name}`);
        logWithTimestamp(`[createDBConnection] [${label}] • Ready State: ${conn.readyState} (1 = connected)`);
        logWithTimestamp(`[createDBConnection] [${label}] • Connection Time: ${time}ms\n`);
    });

    conn.on("error", (error) => {
        logWithTimestamp(`[createDBConnection] ${label} - Error: ${error}`);
    });

    return conn;
}

async function connectDBs(config) {
    try {
        const connections = {};

        const connectionPromises = config.map((config) => {
            const { mongoUri, dbName, label } = config;

            const conn = createDBConnection(mongoUri, dbName, label);

            connections[label] = conn;

            return new Promise((res, rej) => {
                conn.once("connected", () => res());
                conn.once("error", (err) => rej(err));
            });
        });

        await Promise.all(connectionPromises);

        logWithTimestamp(`[connectDBs] All ${config.length} databases connected successfully`);

        return connections;

    } catch (error) {
        logWithTimestamp(`[connectDBs] Error: ${error}`);
        process.exit(1);
    }
}

module.exports = { connectDBs };