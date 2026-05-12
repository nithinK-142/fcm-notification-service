const { getApp, resetFirebase } = require("./firebase.js");
const { delay, logWithTimestamp } = require("../util/helper.js");

async function withTimeout(promise, ms) {
    const race = await Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`FCM timeout after ${ms}ms`)), ms)
        ),
    ]);

    return race;
}

function isRetryableNetworkError(error) {
    const msg = String(error?.message || error);
    return (
        msg.includes("socket disconnected") ||
        msg.includes("TLS") ||
        msg.includes("Client network socket disconnected") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("EAI_AGAIN") ||
        msg.includes("GOAWAY") ||
        msg.includes("ping_timeout") ||
        msg.includes("RST_STREAM")
    );
}

async function sendMulticastNotification(notification, tokens) {
    try {
        logWithTimestamp("[sendMulticastNotification] tokens length",tokens.length)
        if (!tokens?.length) return null;
        
        const title = notification.product.name;
        const body = notification.body;
        const image = notification.product.image_url || "";
        const link = notification.link || "";
        const sku = notification.product.sku_uic || "";

        const message = {
            notification: {
                title,
                body,
                image,
            },
            data: {
                title,
                body,
                image,
                moreTitle: link,
                sku_uic: sku,
            },
            android: {
                notification: {
                    icon: 'ic_stat_notify'
                },
            },
            apns: {
                headers: {
                    "apns-priority": "10",
                },
                payload: {
                    aps: {
                        category: "GENERAL",
                        sound: "default"
                    }
                }
            },
            tokens,
        };
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // getApp().messaging() always returns messaging bound to the current live app.
                // Unlike getMessaging() from firebase-admin/messaging which caches the first
                // app instance and never updates after a reset.
                return await withTimeout(getApp().messaging().sendEachForMulticast(message), 60000);
            } catch (error) {
                const msg = String(error?.message || error);
                logWithTimestamp(`[sendMulticastNotification] Error: FCM attempt ${attempt} failed:`, msg);

                // reset http2 session on any session-level error including timeout
                if (
                    msg.includes("GOAWAY") ||
                    msg.includes("ping_timeout") ||
                    msg.includes("FCM timeout") ||
                    msg.includes("ECONNRESET") ||
                    msg.includes("RST_STREAM")
                ) {
                    await resetFirebase();
                }

                if (!isRetryableNetworkError(error) || attempt === 3) return null;

                await delay(800 * attempt);
            }
        }

        return null;
    } catch (error) {
        logWithTimestamp("[sendMulticastNotification] Error:", error?.message || error);
        return null;
    }
}

module.exports = { sendMulticastNotification };
