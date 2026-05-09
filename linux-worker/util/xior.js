const { Xior } = require("xior");

const xiorInstance = Xior.create({
    baseURL: `${process.env.SERVER_URL}/api`,
    headers: {
        "Content-Type": "application/json",
    },
});

module.exports = { xiorInstance };