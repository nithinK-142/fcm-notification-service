const { Router } = require("express");
const { getModels } = require("../models/models.js")

const router = Router()
const { Product } = getModels()

router.post("/", async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 50 } = req.body

    const query = {
      cmt_approver_status: "Accepted",
      cmt_approver_status_listing: "Accepted",
      product_status: "Active",
      avl_stock: { $gt: 0 },
    }
    if (category) query.category = category
    if (status) query.product_status = status
    if (search) query.$or = [
      { product_name: { $regex: search, $options: "i" } },
      { brand_name: { $regex: search, $options: "i" } },
    ]

    const skip = (Number(page) - 1) * Number(limit)
    const total = await Product.countDocuments(query)
    const docs = await Product.find(query, {
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
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const result = docs.map((p) => ({
      id: p._id,
      name: p.product_name || "—",
      skuUic: p.sku_uic || "—",
      viewCount: p.view_count || 0,
      avlStock: p.avl_stock || 0,
      category: p.category || "—",
      price: p.listing_price || 0,
      status: p.product_status || "—",
      imageUrl: p.product_main_image_file_name || null,
      createdAt: p.createdAt || null,
      state: p.listing_state || [],
      brand: p.brand_name || "—",
      grade: p.grade || "—",
    }))

    res.json({ products: result, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: "Failed to fetch products" })
  }
})

module.exports = router;