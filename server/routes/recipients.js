const { Router } = require("express");
const { getModels } = require("../models/models.js");

const router = Router()
const { Recipient, Category } = getModels()

router.get("/", async (req, res) => {
  try {
    const [
      totalRecipients,
      recipientsByState,
      recipientsByRegCategory,
    ] = await Promise.all([
      Recipient.countDocuments(),
      Recipient.aggregate([
        { $group: { _id: { $toLower: "$state" }, count: { $sum: 1 } } },
        { $project: { state: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } }
      ]),
      Recipient.aggregate([
        { $group: { _id: "$registration_category", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
    ])

    const regCategoryIds = [...new Set(recipientsByRegCategory.map(d => d._id.toString()))];
    const regCategories = await Category.find({ _id: { $in: regCategoryIds } }, { _id: 1, category_title: 1 })
    const regCategoryMap = new Map(regCategories.map(c => [c._id.toString(), c.category_title]))
    const regCategoryLookup = recipientsByRegCategory.reduce((acc, cat) => {
      acc[cat._id.toString()] = {
        count: cat.count,
        categoryTitle: regCategoryMap.get(cat._id.toString()) || "No Category Selected"
      }
      return acc
    }, {})

    return res.json({
      totalRecipients,
      recipientsByState,
      recipientsByRegCategory: regCategoryLookup,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: "Failed to fetch recipients" })
  }
})

module.exports = router;