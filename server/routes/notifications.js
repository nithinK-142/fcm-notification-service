const { Router } = require("express");
const { v7: uuid } = require("uuid");
const { notifications } = require("../data/store.js");
const { getModels } = require("../models/models.js")

const router = Router()
const { Notification } = getModels()

router.get("/", async (req, res) => {
  try {
    const { search, status } = req.query

    const query = {}

    // status filter
    if (status) {
      query.status = status
    }

    // search (product name + body)
    if (search) {
      query.$or = [
        { "product.name": { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } }
      ]
    }

    const result = await Notification.find({}).sort({ created_at: -1 })
    res.json({
      notifications: result,
      total: result.length
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
      body: body || "Now Live!",
      priority
    });
  }
  const created = await Notification.insertMany(Array.from(new Map(notifications.map(n => [n.product.id, n])).values()))
  res.status(201).json(created)
})

router.put("/:id", (req, res) => {
  const idx = notifications.findIndex((n) => n.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: "Notification not found" })

  if (notifications[idx].status === "sent") {
    return res.status(400).json({ message: "Cannot edit a sent notification" })
  }

  notifications[idx] = {
    ...notifications[idx],
    ...req.body,
    id: notifications[idx].id,
    createdAt: notifications[idx].createdAt,
    updatedAt: new Date().toISOString(),
  }
  res.json(notifications[idx])
})

router.delete("/:id", (req, res) => {
  const idx = notifications.findIndex((n) => n.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: "Notification not found" })
  notifications.splice(idx, 1)
  res.json({ message: "Deleted" })
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