const mongoose = require("mongoose");
const { ObjectId } = require("../util/constants.js");

const productSchema = new mongoose.Schema(
    {
        _id: ObjectId,
        product_name: { type: String, required: true },
        product_status: { type: String },
        sku_uic: { type: String },
        brand: { type: String },
        grade: { type: String },
        listing_price: { type: Number },
        avl_stock: { type: Number },
        product_main_image_file_name: { type: String },
        listing_state: { type: [String] },
        registration_category: { type: ObjectId },
        main_category: { type: ObjectId },
        sub_category: { type: ObjectId },
        view_count: { type: Number },
    },
    {
        collection: "productscmts",
        strict: false,
    }
);

module.exports = {
    ProductModel: function (conn) {
        return conn.models.Product || conn.model("Product", productSchema, "productscmts");
    }
};