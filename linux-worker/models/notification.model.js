const mongoose = require("mongoose");
const { ObjectId } = require("../util/constants.js");

const NotificationSchema = new mongoose.Schema(
  {
    product: {
      id: ObjectId,
      name: String,
      image_url: String,
      sku_uic: String,
      brand: String,
      grade: String,
      price: Number,
      state: [String],
      category: {
        registration: {
          id: ObjectId,
          categoryTitle: String,
          categoryType: String,
        },
        main: {
          id: ObjectId,
          categoryTitle: String,
          categoryType: String,
        },
        sub: {
          id: ObjectId,
          categoryTitle: String,
          categoryType: String,
        },
      }
    },

    body: { type: String, default: "Now Live!" },
    status: { type: String, default: "pending" },

    execute_now: { type: Boolean, default: false },
    priority: { type: String, enum: ["high", "normal", "low"], default: "normal", index: true },
    priority_rank: { type: Number, enum: [0, 1, 2, 3], default: 2, index: true },

    link: String,

    total_recipients: Number,
    sent_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },

    batch_count: Number,
    current_batch: { type: Number, default: 0 },

    duration_ms: Number,
    started_at: Date,
    completed_at: Date,

    batches: [
      {
        batch_no: Number,
        tokens_count: Number,
        success: Number,
        failure: Number,
        duration_ms: Number,
      },
    ],
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    versionKey: false,
  }
);

const Notification = mongoose.model("notifications", NotificationSchema);

module.exports = { Notification };