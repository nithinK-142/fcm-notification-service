const ObjectId = require("mongoose").Types.ObjectId;

const PRIORITY_RANK = { high: 1, normal: 2, low: 3 };

module.exports = {
    ObjectId,
    PRIORITY_RANK,
}