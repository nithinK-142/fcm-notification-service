const path = require("path");
const admin = require("firebase-admin");
const { logWithTimestamp } = require("../util/helper.js");

let initialized = false;

async function initFirebase() {
    if (initialized && admin.apps.length) return admin;

    const serviceAccount = require(path.join(__dirname, "./firebase.json"));

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

    initialized = true;
    logWithTimestamp("[initFirebase] Firebase initialized");
    return admin;
}

async function resetFirebase() {
    try {
        logWithTimestamp("[resetFirebase] Resetting Firebase (HTTP2 recovery)...");
        await Promise.all(admin.apps.map((app) => app.delete()));
    } catch (e) {
        // ignore
    }
    initialized = false;
    initFirebase();
}

module.exports = { admin, initFirebase, resetFirebase };
