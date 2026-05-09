const { Router } = require("express");
const { getModels } = require("../models/models.js")

const router = Router()
const { Product } = getModels()

router.post("/check-product-availibility/:id", async (req, res) => {
  let message = "available";
  const product = await Product.findOne(
    { _id: req.params.id },
    { _id: 0, product_status: 1, avl_stock: 1 }
  )

  if (!product) message = "product_not_found";
  if (product.avl_stock <= 0) message = "no_stock";
  if (product.avl_stock > 0 && product.product_status === "Deactive") message = "no_stock";

  return res.json({ message })
})

module.exports = router;