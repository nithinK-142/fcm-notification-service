const { Router } = require("express");
const { products, notifications } = require("../data/store.js");

const router = Router()

router.get("/stats", (req, res) => {
  const totalProducts = products.length
  const activeProducts = products.filter((p) => p.status === "active").length
  const totalNotifications = notifications.length
  const sentNotifications = notifications.filter((n) => n.status === "sent").length

  const recentNotifications = [...notifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  res.json({
    totalProducts,
    activeProducts,
    totalNotifications,
    sentNotifications,
    recentNotifications,
    recentProducts,
  })
})

module.exports = router;