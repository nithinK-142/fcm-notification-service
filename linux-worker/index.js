require("dotenv").config();
const cron = require("node-cron");
const { connectDB } = require("./db/db.js");
const { initFirebase } = require("./config/firebase.js");
const { logWithTimestamp } = require("./util/helper.js");
const { processNotification } = require("./util/worker.js");

const { MONGO_URI, DB_NAME } = process.env;

async function startWorker() {
  logWithTimestamp(`[startWorker] Notification worker booting up`);

  await connectDB(MONGO_URI, DB_NAME);

  await initFirebase();

  cron.schedule("*/1 * * * *", processNotification);

  logWithTimestamp(`[startWorker] ${cron.getTasks().size} cron tasks initialized`);
}

startWorker();