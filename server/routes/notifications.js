const { Router } = require("express");
const { v7: uuid } = require("uuid");
const { notifications } = require("../data/store.js");
const { getModels } = require("../models/models.js");
const { logWithTimestamp } = require("../../linux-worker/util/helper.js");
const { PRIORITY_RANK } = require("../util/constants.js");

const router = Router()
const { Notification } = getModels()

router.get("/", async (req, res) => {
  try {
    const { search, status, page = 1, limit = 25 } = req.query

    const query = {}
    if (status) query.status = status
    if (search) {
      query.$or = [
        { "product.name": { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    const total = await Notification.countDocuments(query)
    const result = await Notification.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Number(limit))

    res.json({
      notifications: result,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: "Failed to fetch notifications" })
  }
})

router.post("/", async (req, res) => {
  const rawDocs = req.body;
  const notifications = [];

  for (const doc of rawDocs) {
    const { id, name, skuUic, imageUrl, state, body, priority, grade, brand, price } = doc;
    notifications.push({
      product: {
        id,
        name,
        image_url: imageUrl,
        state,
        sku_uic: skuUic,
        grade,
        brand,
        price
      },
      body,
      priority,
      priority_rank: PRIORITY_RANK[priority] ?? 2,
    });
  }
  const created = await Notification.insertMany(Array.from(new Map(notifications.map(n => [n.product.id, n])).values()))
  res.status(201).json(created)
})

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { body } = req.body

    const notification = await Notification.findById(id)
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    if (notification.status !== "pending") {
      return res.status(409).json({ message: "Only pending notifications can be edited" })
    }

    const result = await Notification.updateOne(
      { _id: id, status: { $nin: ["locked", "processing"] } },
      { $set: { body, updated_at: new Date() } }
    )
    if (result.modifiedCount === 0) {
      return res.status(409).json({ message: "Only pending notifications can be edited" })
    }
    return res.status(200).json({ message: "Notification updated successfully" })
  } catch (error) {
    logWithTimestamp("[update notification]", error)
    return res.status(500).json({ message: "Failed to update notification" })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params

    const notification = await Notification.findById(id)
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    if (["locked", "processing"].includes(notification.status)) {
      return res.status(409).json({ message: `Cannot delete notification with status '${notification.status}'` })
    }

    const result = await Notification.deleteOne({ _id: id, status: { $nin: ["locked", "processing"] }, })
    if (result.deletedCount === 0) {
      return res.status(409).json({ message: "Notification cannot be deleted while locked or processing" })
    }

    return res.status(200).json({ message: "Notification deleted successfully" })
  } catch (error) {
    logWithTimestamp("[delete notification]", error)
    return res.status(500).json({ message: "Failed to delete notification" })
  }
})

// Send notification now
router.post("/:id/send", (req, res) => {
  const idx = notifications.findIndex((n) => n.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: "Notification not found" })
  if (notifications[idx].status === "sent") {
    return res.status(400).json({ message: "Already sent" })
  }

  // In a real app you'd call FCM/APNs here
  notifications[idx].status = "sent"
  notifications[idx].sentAt = new Date().toISOString()

  console.log(`📤 Notification sent: "${notifications[idx].title}"`)
  res.json({ message: "Notification sent successfully", notification: notifications[idx] })
})

module.exports = router;