const mongoose = require("mongoose");
const { logWithTimestamp } = require("../util/helper.js");

async function connectDB(MONGO_URI, DB_NAME) {
    try {

        const start = Date.now();

        await mongoose.connect(MONGO_URI, { dbName: DB_NAME });

        const conn = mongoose.connection;
        const time = Date.now() - start;

        logWithTimestamp("[connectDB] MongoDB Connected!");
        logWithTimestamp(`[connectDB] • Host: ${conn.host}`);
        logWithTimestamp(`[connectDB] • PORT: ${conn.port}`);
        logWithTimestamp(`[connectDB] • Database: ${conn.name}`);
        logWithTimestamp(`[connectDB] • Ready State: ${conn.readyState} (1 = connected)`);
        logWithTimestamp(`[connectDB] • Connection Time: ${time}ms`);

    } catch (error) {
        logWithTimestamp(`[connectDB] Error Message: ${error.message}`);
        logWithTimestamp(`[connectDB] Error Object: ${error}`);
        process.exit(1);
    }
};

module.exports = { connectDB };