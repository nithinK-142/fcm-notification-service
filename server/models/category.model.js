const mongoose = require("mongoose");
const { ObjectId } = require("../util/constants.js");

const categorySchema = new mongoose.Schema(
  {
    category_title: String,
    category_type: String,
    main_category: { type: ObjectId },
    registration_category: { type: ObjectId },
  },
  {
    timestamps: true,
    collection: "categorycmts",
    strict: false,
  }
);

module.exports = {
  CategoryModel: function (conn) {
    return conn.models.Category || conn.model("Category", categorySchema, "categorycmts");
  }
};
