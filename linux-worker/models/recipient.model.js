const mongoose = require("mongoose");
const { ObjectId } = require("../util/constants");

const RecipientSchema = new mongoose.Schema(
  {
    user_id: {
      type: ObjectId,
      required: true,
      index: true,
    },

    fcm_token: {
      type: String,
      required: true,
      unique: true,
    },

    state: {
      type: String,
      index: true,
    },

    registration_category: {
      type: ObjectId,
      required: true,
      index: true,
    },

  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    versionKey: false,
  }
);

RecipientSchema.index({
  state: 1,
  registration_category: 1,
});

const Recipient = mongoose.model("recipients", RecipientSchema);

module.exports = { Recipient };