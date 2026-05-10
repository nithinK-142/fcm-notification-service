const { ProductModel } = require("./product.model.js");
const { NotificationModel } = require("./notification.model.js");
const { ProductPriceLogModel } = require("./product-price-log.model.js");
const { CategoryModel } = require("./category.model.js");

let models = null;

async function initModels(LOCAL_DB, ATLAS_DB) {
    if (models) return models;
    models = {
        Product: ProductModel(LOCAL_DB),
        Notification: NotificationModel(ATLAS_DB),
        ProductPriceLog: ProductPriceLogModel(LOCAL_DB),
        Category: CategoryModel(LOCAL_DB),
    };
    return models;
}

function getModels() {
    if (!models) {
        throw new Error("Models not initialized.");
    }
    return models;
}

module.exports = { initModels, getModels };