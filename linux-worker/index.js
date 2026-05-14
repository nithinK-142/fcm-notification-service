require("dotenv").config();
const cron = require("node-cron");
const { connectDB } = require("./db/db.js");
const { initFirebase } = require("./config/firebase.js");
const { logWithTimestamp } = require("./util/helper.js");
const { processNotification } = require("./util/worker.js");
const { purgeOldRecords } = require("./db/failed-tokens-db.js");

const { MONGO_URI, DB_NAME } = process.env;

async function recoverStuckNotifications() {
  const { Notification } = require("./models/notification.model.js");
  const result = await Notification.updateMany(
    { status: { $in: ["locked", "processing"] } },
    { $set: { status: "pending" } }
  );
  if (result.modifiedCount > 0) {
    logWithTimestamp(`[recoverStuckNotifications] Reset ${result.modifiedCount} stuck notification(s) to pending`);
  }
}

async function startWorker() {
  logWithTimestamp(`[startWorker] Notification worker booting up`);

  await connectDB(MONGO_URI, DB_NAME);

  await initFirebase();

  await recoverStuckNotifications();

  cron.schedule("* 7-22 * * *", processNotification); // every minute 7am to 10pm

  cron.schedule("0 2 * * *", purgeOldRecords); // 2am daily

  logWithTimestamp(`[startWorker] ${cron.getTasks().size} cron tasks initialized`);
}

startWorker();