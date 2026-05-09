const mongoose = require("mongoose");

const productPriceLogSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Types.ObjectId },
    deals_type: String,
    action_type: String,
    stock_update_info: {
      oldlistingprice: Number,
      listing_price: Number,
      newstock: Number,
      stock: Number,
    },
  },
  {
    timestamps: true,
    collection: "productpricelogs",
    strict: false,
  }
);

module.exports = {
  ProductPriceLogModel: function (conn) {
    return conn.models.ProductPriceLog || conn.model("ProductPriceLog", productPriceLogSchema, "productpricelogs");
  }
};
