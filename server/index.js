require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { authenticate } = require("./middleware/auth.js");
const { connectDBs } = require("./db/db.js");
const { initModels } = require("./models/models.js");
const { logWithTimestamp } = require("./util/helper.js");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.ALLOWED_URLS.split(","), credentials: true }));
app.use(express.json());

const { MONGO_URI_LOCAL, DB_NAME_LOCAL, LOCAL_DB_LABEL, MONGO_URI_ATLAS, DB_NAME_ATLAS, ATLAS_DB_LABEL } = process.env;

async function startServer() {
  try {
    const dbs = await connectDBs([
      {
        mongoUri: MONGO_URI_LOCAL,
        dbName: DB_NAME_LOCAL,
        label: LOCAL_DB_LABEL,
      },
      {
        mongoUri: MONGO_URI_ATLAS,
        dbName: DB_NAME_ATLAS,
        label: ATLAS_DB_LABEL,
      },
    ]);

    await initModels(dbs.LOCAL_DB, dbs.ATLAS_DB);

    const authRoutes = require("./routes/auth.js");
    const productRoutes = require("./routes/products.js");
    const notificationRoutes = require("./routes/notifications.js");
    const workerRoutes = require("./routes/worker.js");
    const dashboardRoutes = require("./routes/dashboard.js");

    // Public routes
    app.use("/api/auth", authRoutes);
    app.use("/api/worker", workerRoutes);

    // Protected routes
    app.use("/api/products", authenticate, productRoutes);
    app.use("/api/notifications", authenticate, notificationRoutes);
    app.use("/api/dashboard", authenticate, dashboardRoutes);

    app.listen(PORT, () => {
      logWithTimestamp(`[startServer] Server running on ${PORT}`);
    });

  } catch (error) {
    logWithTimestamp("[startServer] Error", error);
    process.exit(1);
  }
}

startServer();