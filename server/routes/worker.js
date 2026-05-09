const { Router } = require("express");
const { getModels } = require("../models/models.js")

const router = Router()
const { Product, ProductPriceLog } = getModels()

async function createNotificationBody(product) {
  const productlistingAndStock = await ProductPriceLog
    .find({ product_id: product._id, action_type: "Listing Accepted" })
    .sort({ createdAt: -1 })

  const defaultText = `Now LIVE ₹${product?.listing_price}`;

  if (productlistingAndStock.length === 1) return `${defaultText}! New Arrival`;

  if (productlistingAndStock?.stock_update_info) {
    const stockInfo = productlistingAndStock.stock_update_info;
    if (stockInfo.newstock > 0 && stockInfo.stock === 0) {
      return `${defaultText}! Back in Stock`;
    }
  }

  if (productlistingAndStock?.deals_type === "FLASH DEALS") {
    return `${defaultText}! Flash Deal ⚡`;
  }
  if (productlistingAndStock?.deals_type === "EXCLUSIVE DEALS") {
    return `${defaultText}! Exclusive Deal ⭐`;
  }

  return defaultText;
}

router.post("/check-and-create-body", async (req, res) => {
  const { id, isBodyRequired } = req.body;
  let message = "available";
  const product = await Product.findOne(
    { _id: id },
    { _id: 1, product_status: 1, avl_stock: 1, listing_price: 1 }
  )

  if (!product) message = "product_not_found";
  if (product.avl_stock <= 0) message = "no_stock";
  if (product.avl_stock > 0 && product.product_status === "Deactive") message = "no_stock";

  let body;
  if (isBodyRequired) {
    body = await createNotificationBody(product);
  }

  return res.json({ message, body })
})

module.exports = router;