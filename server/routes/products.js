const { Router } = require("express");
const { getModels } = require("../models/models.js");
const { escapeRegex } = require("../util/helper.js");

const router = Router()
const { Product, Category } = getModels()

router.post("/", async (req, res) => {
  try {
    const { search, category, page = 1, limit = 25 } = req.body

    const query = {
      cmt_approver_status: "Accepted",
      cmt_approver_status_listing: "Accepted",
      product_status: "Active",
      avl_stock: { $gt: 0 },
    }

    const andConditions = []

    if (search) {
      andConditions.push({
        $or: [
          { product_name: { $regex: escapeRegex(search), $options: "i" } },
          { brand_name: { $regex: escapeRegex(search), $options: "i" } },
        ]
      })
    }
    if (category && category !== "All") {
      const escapedCategory = escapeRegex(category);
      andConditions.push({
        $or: [
          { registration_category: escapedCategory },
          { main_category: escapedCategory },
          { sub_category: escapedCategory },
        ]
      })
    }
    if (andConditions.length) {
      query.$and = andConditions
    }

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
      registration_category: 1,
      main_category: 1,
      sub_category: 1,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const categoriesMap = {
      "Registration Category": [...new Set(docs.map(d => d.registration_category.toString()))],
      "Main Category": [...new Set(docs.map(d => d.main_category.toString()))],
      "Sub Category": [...new Set(docs.map(d => d.sub_category.toString()))],
    }

    const categories = await Category.find(
      { _id: { $in: [...new Set(Object.values(categoriesMap).flat())] } },
      { _id: 1, category_title: 1, category_type: 1 }
    )

    const categoriesLookup = categories.reduce((acc, cat) => {
      const type = cat.category_type
      if (!acc[type]) acc[type] = {}
      acc[type][cat._id.toString()] = cat
      return acc
    }, {})

    const result = docs.map((p) => ({
      id: p._id,
      name: p.product_name || "—",
      skuUic: p.sku_uic || "—",
      viewCount: p.view_count || 0,
      avlStock: p.avl_stock || 0,
      category: {
        registration: categoriesLookup["Registration Category"]?.[p.registration_category?.toString()] || null,
        main: categoriesLookup["Main Category"]?.[p.main_category?.toString()] || null,
        sub: categoriesLookup["Sub Category"]?.[p.sub_category?.toString()] || null,
      },
      price: p.listing_price || 0,
      status: p.product_status || "—",
      imageUrl: p.product_main_image_file_name || null,
      createdAt: p.createdAt || null,
      state: p.listing_state || [],
      brand: p.brand_name || "—",
      grade: p.grade || "—",
    }))

    return res.json({
      products: result,
      categories: [
        { id: "All", name: "All Categories" },
        ...Array.from(
          new Map(
            Object.values(categoriesLookup)
              .flatMap((group) => Object.values(group))
              .map((cat) => [
                cat._id.toString(),
                {
                  id: cat._id,
                  name: cat.category_title,
                  type: cat.category_type,
                }
              ])
          ).values()
        )
      ],
      pagination: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit))
      },
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: "Failed to fetch products" })
  }
})

module.exports = router;