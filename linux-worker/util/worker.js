const { Notification } = require("../models/notification.model.js")
const { Recipient } = require("../models/recipient.model.js")
const { sendMulticastNotification } = require("../config/multicast-notification.js");
const { logWithTimestamp, chunk, delay } = require("./helper.js");
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

async function getTokens(notification) {
  const states = notification.product.state || []

  const hasAllState = states.some((s) => s?.toLowerCase() === "all")
  const query = { registration_category: notification.product.category.registration.id, }

  if (!hasAllState && states.length > 0) {
    query.state = { $in: states.filter((s) => s?.toLowerCase() !== "all") }
  }

  const tokens = await Recipient.find(query, { _id: 0, fcm_token: 1 }).lean();
  return tokens.map(t => t.fcm_token);
}

async function processNotification() {
  try {
    logWithTimestamp("[processNotification] Checking notifications");

    const notification = await Notification.findOneAndUpdate(
      { status: "pending" },
      { $set: { status: "locked" } },
      {
        returnDocument: "after",
        sort: {
          priority_rank: 1,  // 0 (execute_now) → 1 (high) → 2 (normal) → 3 (low)
          created_at: 1,  // oldest first within same rank
        },
      }
    )

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

    const tokens = await getTokens(notification);

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