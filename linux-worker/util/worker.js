const NodeCache = require("node-cache");
const { Notification } = require("../models/notification.model.js")
const { Recipient } = require("../models/recipient.model.js")
const { sendMulticastNotification } = require("../config/multicast-notification.js");
const { logWithTimestamp, chunk } = require("./helper.js");
const { xiorInstance } = require("./xior.js");
const { storeFailedTokens } = require("../db/failed-tokens-db.js");

let isRunning = false;

const tokenCache = new NodeCache({ stdTTL: 30 * 60, checkperiod: 60 });

const CONCURRENT_BATCHES = process.env.CONCURRENT_BATCHES || 3;

async function checkAndCreateBody(productId, isBodyRequired) {
  try {
    const response = await xiorInstance.post("/worker/check-and-create-body", { id: productId, isBodyRequired })
    return { status: response.data.message, body: response.data.body }
  } catch (error) {
    logWithTimestamp("[checkAndCreateBody] Error:", error)
    return { status: "server_error", body: "" }
  }
}

async function getTokens(notification) {
  const states = notification.product.state || []
  const hasAllState = states.some((s) => s?.toLowerCase() === "all")

  const query = { registration_category: notification.product.category.registration.id }
  if (!hasAllState && states.length > 0) {
    query.state = { $in: states.filter((s) => s?.toLowerCase() !== "all") }
  }

  const cacheKey = JSON.stringify(query)
  const cached = tokenCache.get(cacheKey)
  if (cached !== undefined) {
    logWithTimestamp(`[getTokens] Cache hit — ${cached.length} tokens`)
    return cached
  }

  const docs = await Recipient.find(query, { _id: 0, fcm_token: 1 }).lean();
  const tokens = docs.map(t => t.fcm_token)

  tokenCache.set(cacheKey, tokens)
  logWithTimestamp(`[getTokens] Cache miss — fetched and cached ${tokens.length} tokens`)

  return tokens
}

async function processNotification() {
  if (isRunning) {
    logWithTimestamp("[processNotification] Previous execution still running, skipping this tick.");
    return;
  }

  isRunning = true;

  try {
    logWithTimestamp("[processNotification] Checking notifications");

    const notification = await Notification.findOneAndUpdate(
      { status: "pending" },
      { $set: { status: "locked" } },
      {
        returnDocument: "after",
        sort: {
          priority_rank: 1,  // 0 (execute_now) → 1 (high) → 2 (normal) → 3 (low)
          created_at: 1,     // oldest first within same rank
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
    const resumeFrom = notification.current_batch || 0;
    const isResume = resumeFrom > 0;

    // On resume: carry forward existing counts so sent/failed accumulate correctly.
    // On fresh start: reset everything and record started_at.
    let totalSuccess = isResume ? (notification.sent_count || 0) : 0;
    let totalFailure = isResume ? (notification.failed_count || 0) : 0;

    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: "processing",
          total_recipients: tokens.length,
          batch_count: batches.length,
          body,
          ...(isResume ? {} : { started_at: new Date() }),
        },
      }
    );

    if (isResume) {
      logWithTimestamp(`[processNotification] Resuming from batch ${resumeFrom + 1}/${batches.length}`);
    }

    logWithTimestamp(
      `[processNotification] Sending to ${tokens.length} recipients` +
      ` in ${batches.length} batches (${CONCURRENT_BATCHES} concurrent)`
    );

    // Process in windows of CONCURRENT_BATCHES.
    // Promise.allSettled — one failure in a window doesn't abort the rest.
    // One DB write per window instead of per batch.
    for (let i = resumeFrom; i < batches.length; i += CONCURRENT_BATCHES) {
      const window = batches.slice(i, i + CONCURRENT_BATCHES);

      const results = await Promise.allSettled(
        window.map((batchTokens, wi) => {
          const batchStart = Date.now();
          return sendMulticastNotification(notification, batchTokens).then(response => {
            let success = 0;
            let failure = 0;
            const failedTokens = [];

            if (!response || !Array.isArray(response.responses)) {
              failure = batchTokens.length;
              storeFailedTokens(notification._id.toString(), batchTokens, "NO_RESPONSE");
            } else {
              response.responses.forEach((r, idx) => {
                if (r.success) {
                  success++;
                } else {
                  failure++;
                  if (batchTokens[idx]) {
                    failedTokens.push({
                      token: batchTokens[idx],
                      errorCode: r.error?.code || "UNKNOWN"
                    });
                  }
                }
              });
              const byErrorCode = {};
              failedTokens.forEach(f => {
                if (!byErrorCode[f.errorCode]) byErrorCode[f.errorCode] = [];
                byErrorCode[f.errorCode].push(f.token);
              });
              for (const [code, tokens] of Object.entries(byErrorCode)) {
                storeFailedTokens(notification._id.toString(), tokens, code);
              }
            }
            return {
              batch_no: i + wi + 1,
              tokens_count: batchTokens.length,
              success,
              failure,
              duration_ms: Date.now() - batchStart,
            };
          });
        })
      );

      const windowBatches = results.map((r, w) => {
        const val = r.status === "fulfilled" && r.value
          ? r.value
          : { batch_no: i + w + 1, tokens_count: window[w].length, success: 0, failure: window[w].length, duration_ms: 0 };
        totalSuccess += val.success;
        totalFailure += val.failure;
        return val;
      });

      await Notification.updateOne(
        { _id: notification._id },
        {
          $push: { batches: { $each: windowBatches } },
          $set: {
            sent_count: totalSuccess,
            failed_count: totalFailure,
            current_batch: i + window.length,
          },
        }
      );

      logWithTimestamp(
        `[processNotification] Batches ${i + 1}–${i + window.length}/${batches.length} done` +
        ` | sent: ${totalSuccess} failed: ${totalFailure}`
      );
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

    logWithTimestamp(
      `[processNotification] Done: ${notification._id}` +
      ` | sent: ${totalSuccess} failed: ${totalFailure}` +
      ` | took: ${(totalDuration / 1000).toFixed(1)}s`
    );
  } catch (error) {
    logWithTimestamp("[processNotification] Error:", error);
    try {
      await Notification.updateOne(
        { status: { $in: ["locked", "processing"] } },
        { $set: { status: "server_error", completed_at: new Date() } }
      );
    } catch (e) {
      logWithTimestamp("[processNotification] Failed to mark server_error:", e?.message);
    }
  } finally {
    isRunning = false;
  }
}

module.exports = { processNotification };