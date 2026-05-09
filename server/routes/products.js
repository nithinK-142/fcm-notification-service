const { Router } = require("express");
const { getModels } = require("../models/models.js")

const router = Router()
const { Product } = getModels()

router.post("/", async (req, res) => {
  const { search, category, status } = req.body;


  const docs = await Product.find(
    {
      cmt_approver_status: "Accepted",
      cmt_approver_status_listing: "Accepted",
      product_status: "Active",
      avl_stock: { $gt: 0 }
    },
    {
      _id: 1,
      product_name: 1,
      sku_uic: 1,
      view_count: 1,
      avl_stock: 1,
      product_type: 1,
      listing_price: 1,
      product_status: 1,
      product_main_image_file_name: 1,
      createdAt: 1,
      listing_state: 1,
      brand_name: 1,
      grade: 1,
    }
  ).limit(100);
  const result = docs.map((p) => ({
    id: p._id || "-",
    name: p.product_name || "-",
    skuUic: p.sku_uic || "-",
    viewCount: p.view_count || "-",
    avlStock: p.avl_stock || "-",
    category: p.category || "-",
    price: p.listing_price || "-",
    status: p.product_status || "-",
    imageUrl: p.product_main_image_file_name || "-",
    createdAt: p.createdAt || "-",
    state: p.listing_state || [],
    brand: p.brand_name || "-",
    grade: p.grade || "-",
  }));

  return res.json({ products: result, total: result.length })
})

module.exports = router;