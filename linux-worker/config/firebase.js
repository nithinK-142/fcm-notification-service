const path = require("path");
const admin = require("firebase-admin");
const { logWithTimestamp } = require("../util/helper.js");

let currentApp = null;

async function initFirebase() {
    if (currentApp) return currentApp;

    const serviceAccount = require(path.join(__dirname, "./firebase.json"));
    currentApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

    logWithTimestamp("[initFirebase] Firebase initialized");
    return currentApp;
}

// Always returns the current live app instance.
// Use this instead of admin.app() which may return a stale/deleted app.
function getApp() {
    return currentApp;
}

async function resetFirebase() {
    logWithTimestamp("[resetFirebase] Resetting Firebase (HTTP/2 recovery)...");
    try {
        if (currentApp) {
            await currentApp.delete();
        }
    } catch (e) {
        // ignore teardown errors
    }
    currentApp = null;
    await initFirebase();
    logWithTimestamp("[resetFirebase] Firebase reset complete");
}

module.exports = { admin, initFirebase, getApp, resetFirebase };