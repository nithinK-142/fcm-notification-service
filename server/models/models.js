const { ProductModel } = require("./product.model.js");
const { NotificationModel } = require("./notification.model.js");

let models = null;

async function initModels(LOCAL_DB, ATLAS_DB) {
    if (models) return models;
    models = {
        Product: ProductModel(LOCAL_DB),
        Notification: NotificationModel(ATLAS_DB),
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