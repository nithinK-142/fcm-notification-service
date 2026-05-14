const path = require("path");
const Database = require("better-sqlite3");
const { logWithTimestamp } = require("../util/helper.js");

const DB_PATH = path.join(__dirname, "../data/failed_tokens.db");

let db;

function getDb() {
  if (db) return db;

  // Ensure the data directory exists
  const fs = require("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);

  // WAL mode — faster writes, safe for concurrent reads
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS failed_tokens (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id  TEXT    NOT NULL,
      fcm_token        TEXT    NOT NULL,
      error_code       TEXT,
      created_at       INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notification_id ON failed_tokens (notification_id);
    CREATE INDEX IF NOT EXISTS idx_created_at      ON failed_tokens (created_at);
  `);

  logWithTimestamp("[failedTokensDb] SQLite initialized:", DB_PATH);
  return db;
}

// Bulk-insert failed tokens for a notification batch.
// errorCode is optional — pass FCM error code string when available.
function storeFailedTokens(notificationId, tokens, errorCode = null) {
  if (!tokens?.length) return;
  try {
    const insert = getDb().prepare(`
      INSERT INTO failed_tokens (notification_id, fcm_token, error_code)
      VALUES (@notificationId, @fcmToken, @errorCode)
    `);
    const insertMany = getDb().transaction((rows) => {
      for (const row of rows) insert.run(row);
    });
    insertMany(tokens.map((t) => ({ notificationId, fcmToken: t, errorCode })));
  } catch (e) {
    logWithTimestamp("[failedTokensDb] Error storing failed tokens:", e?.message);
  }
}

// Delete records older than 7 days.
// Call this once on startup — no need for a cron.
function purgeOldRecords() {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const { changes } = getDb()
      .prepare("DELETE FROM failed_tokens WHERE created_at < ?")
      .run(cutoff);
    if (changes > 0) {
      logWithTimestamp(`[failedTokensDb] Purged ${changes} failed token records older than 7 days`);
    }
  } catch (e) {
    logWithTimestamp("[failedTokensDb] Error purging old records:", e?.message);
  }
}

// Query helpers for debugging — not used in the send path.
function getFailedTokensByNotification(notificationId) {
  return getDb()
    .prepare("SELECT * FROM failed_tokens WHERE notification_id = ? ORDER BY id")
    .all(notificationId);
}

function getFailedTokenStats(notificationId) {
  return getDb()
    .prepare(`
      SELECT
        error_code,
        COUNT(*) as count
      FROM failed_tokens
      WHERE notification_id = ?
      GROUP BY error_code
      ORDER BY count DESC
    `)
    .all(notificationId);
}

module.exports = { storeFailedTokens, purgeOldRecords, getFailedTokensByNotification, getFailedTokenStats };
