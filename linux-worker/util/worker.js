const { Notification } = require("../models/notification.model.js")
const { Recipient } = require("../models/recipient.model.js")
const { sendMulticastNotification } = require("../config/multicast-notification.js");
const { logWithTimestamp, chunk, delay } = require("./helper.js");
const { ObjectId } = require("./constants.js");
const { xiorInstance } = require("./xior.js");

async function checkAndCreateBody(productId, isBodyRequired) {
  try {
    const response = await xiorInstance.post("/worker/check-and-create-body", { id: productId, isBodyRequired })
    return { status: response.data.message, body: response.data.body }
  } catch (error) {
    logWithTimestamp("[checkAndCreateBody] Error:", error)
    return "server_error"
  }
}

async function getTokens() {
  // await Recipient.insertOne({
  //   user_id: new ObjectId("68833dec7d85ac190e8e132e"),
  //   fcm_token: "dmgP28AlStqG_xfftd_DEO:APA91bGB2NetdU-1bMRIvuEJxWuHbyNOESoBIvvCUwu_E5sjWgwXGabXMOzU3QKthmzGx5QFybSOerVE5sy3d80ccwWc_-zD-b0UU_n0DnathLuFkacBCpM",
  //   state: "DELHI",
  //   registration_category: new ObjectId("67f8eab6c9b185c78ba70afb"),
  // })
  const tokens = await Recipient.find({})
  return tokens.map(t => t.fcm_token);
}

async function processNotification() {
  try {
    logWithTimestamp("[processNotification] Checking notifications");

    const notification = await Notification.findOneAndUpdate(
      { status: "pending" },
      { $set: { status: "locked" } },
      { returnDocument: "after" }
    );

    if (!notification) {
      logWithTimestamp("[processNotification] No pending notifications found, exiting.");
      return;
    }

    logWithTimestamp("[processNotification] Processing:", notification._id);

    const startTime = Date.now();

    const { status, body } = await checkAndCreateBody(notification.product.id, !notification.body ? true : false);
    if (status !== "available") {
      await Notification.updateOne(
        { _id: notification._id },
        { $set: { status, body } }
      );
      return;
    }

    const tokens = await getTokens();

    // no recipients
    if (!tokens || !tokens.length) {
      await Notification.updateOne(
        { _id: notification._id },
        {
          $set: {
            status: "done",
            total_recipients: 0,
            completed_at: new Date(),
            duration_ms: Date.now() - startTime,
            body,
          },
        }
      );

      return;
    }

    const batches = chunk(tokens, 200);

    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: "processing",
          total_recipients: tokens.length,
          batch_count: batches.length,
          started_at: new Date(),
          body,
        },
      }
    );

    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = notification.current_batch || 0; i < batches.length; i++) {
      const batchStart = Date.now();

      const batchTokens = batches[i];

      let success = 0;
      let failure = 0;

      const response = await sendMulticastNotification(notification, batchTokens);

      if (!response || !Array.isArray(response.responses)) {
        failure = batchTokens.length;
      } else {
        response.responses.forEach(r => {
          if (r.success) success++;
          else failure++;
        });
      }

      totalSuccess += success;
      totalFailure += failure;

      const duration = Date.now() - batchStart;

      await Notification.updateOne(
        { _id: notification._id },
        {
          $push: {
            batches: {
              batch_no: i + 1,
              tokens_count: batchTokens.length,
              success,
              failure,
              duration_ms: duration,
            },
          },
          $set: {
            sent_count: totalSuccess,
            failed_count: totalFailure,
            current_batch: i + 1,
          },
        }
      );

      logWithTimestamp(`[processNotification] Batch ${i + 1}/${batches.length} completed`);

      await delay(300);
    }

    const totalDuration = Date.now() - startTime;

    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: "done",
          duration_ms: totalDuration,
          completed_at: new Date(),
        },
      }
    );

    logWithTimestamp("[processNotification] Done:", notification._id);
  } catch (error) {
    logWithTimestamp("[processNotification] Error:", error);
  }
}

module.exports = { processNotification };