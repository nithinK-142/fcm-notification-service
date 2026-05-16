const { Router } = require("express");
const { getModels } = require("../models/models.js");
const { PRIORITY_RANK } = require("../util/constants.js");
const { escapeRegex } = require("../util/helper.js");
const { CustomError } = require("../util/custom-error.js");
const { routeHandler } = require("../middleware/request.middleware.js");

const router = Router()
const { Notification } = getModels()

router.get("/", routeHandler(async (req, res) => {
  try {
    const { search, status, page = 1, limit = 25 } = req.query

    const query = {}
    if (status && status !== "All") query.status = status
    if (search?.trim()) {
      const escapedSearch = escapeRegex(search)
      query.$or = [
        { "product.name": { $regex: escapedSearch, $options: "i" } },
        { body: { $regex: escapedSearch, $options: "i" } },
        { "product.brand": { $regex: escapedSearch, $options: "i" } },
        { "product.sku_uic": { $regex: escapedSearch, $options: "i" } },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [result, total, statuses] = await Promise.all([
      Notification.find(query, {
        _id: 1,
        body: 1,
        status: 1,
        priority: 1,
        sent_count: 1,
        failed_count: 1,
        current_batch: 1,
        created_at: 1,
        updated_at: 1,
        "product.name": 1,
        "product.image_url": 1,
        "product.state": 1,
      }).sort({ created_at: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(query),
      Notification.distinct("status").lean(),
    ]);

    return res.success({
      notifications: result,
      statuses: ["All", ...statuses],
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    })
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Failed to fetch notifications", error)
  }
}))

router.get("/:id", routeHandler((async (req, res) => {
  try {
    const notification = await Notification.findById(
      req.params.id,
      {
        started_at: 1,
        completed_at: 1,
        body: 1,
        status: 1,
        priority: 1,
        sent_count: 1,
        failed_count: 1,
        current_batch: 1,
        created_at: 1,
        updated_at: 1,
        duration_ms: 1,
        batches: 1,
      }
    ).lean()
    return res.success(notification)
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Failed to fetch notification", error)
  }
})))

router.post("/", routeHandler(async (req, res) => {
  try {
    const rawDocs = req.body;
    const notifications = [];

    for (const doc of rawDocs) {
      const { id, name, skuUic, imageUrl, state, body, priority, grade, brand, price, category } = doc;
      notifications.push({
        product: {
          id,
          name,
          image_url: imageUrl,
          state,
          sku_uic: skuUic,
          grade,
          brand,
          price,
          category: {
            registration: category.registration ? {
              id: category.registration?.id,
              category_title: category.registration?.categoryTitle,
              category_type: category.registration?.categoryType,
            } : null,
            main: category.main ? {
              id: category.main?.id,
              category_title: category.main?.categoryTitle,
              category_type: category.main?.categoryType,
            } : null,
            sub: category.sub ? {
              id: category.sub?.id,
              category_title: category.sub?.categoryTitle,
              category_type: category.sub?.categoryType,
            } : null,
          },
        },
        body,
        priority,
        priority_rank: PRIORITY_RANK[priority] ?? 2,
      });
    }
    const created = await Notification.insertMany(Array.from(new Map(notifications.map(n => [n.product.id, n])).values()))
    return res.success(created)
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Failed to create notifications", error)
  }
}))

router.patch("/:id", routeHandler(async (req, res) => {
  try {
    const { id } = req.params
    const { body } = req.body

    const notification = await Notification.findById(id)
    if (!notification) {
      throw new CustomError(404, "Notification not found")
    }

    if (notification.status !== "pending") {
      throw new CustomError(409, "Only pending notifications can be edited")
    }

    const result = await Notification.updateOne(
      { _id: id, status: { $nin: ["locked", "processing"] } },
      { $set: { body, updated_at: new Date() } }
    )
    if (result.modifiedCount === 0) {
      throw new CustomError(409, "Only pending notifications can be edited")
    }
    return res.success({ message: "Notification updated successfully" })
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Failed to update notification")
  }
}))

router.delete("/:id", routeHandler(async (req, res) => {
  try {
    const { id } = req.params

    const notification = await Notification.findById(id)
    if (!notification) {
      throw new CustomError(404, "Notification not found")
    }

    if (["locked", "processing"].includes(notification.status)) {
      throw new CustomError(409, `Cannot delete notification with status '${notification.status}'`)
    }

    const result = await Notification.deleteOne({ _id: id, status: { $nin: ["locked", "processing"] }, })
    if (result.deletedCount === 0) {
      throw new CustomError(409, "Notification cannot be deleted while locked or processing")
    }

    return res.success({ message: "Notification deleted successfully" })
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Failed to delete notification")
  }
}))

router.post("/:id/send", routeHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id)
    if (!notification) {
      throw new CustomError(404, "Notification not found")
    }


    if (notification.status !== "pending") {
      throw new CustomError(409, `Cannot send notification with status '${notification.status}'`)
    }

    if (notification.execute_now) {
      throw new CustomError(409, "Notification is already marked for send now")
    }

    const activeExecuteNowNotification = await Notification.findOne({
      _id: { $ne: id },
      execute_now: true,
      status: { $nin: ["done", "server_error"] }
    })

    if (activeExecuteNowNotification) {
      throw new CustomError(409, "Another notification is already marked for send now")
    }

    const result = await Notification.updateOne(
      { _id: id, status: "pending", execute_now: false },
      { $set: { execute_now: true, priority_rank: 0, updated_at: new Date() } }
    )
    if (result.modifiedCount === 0) {
      throw new CustomError(409, "Notification could not be marked for send now")
    }

    return res.status(200).json({ message: "Notification will send immediately or in the next run" })
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Failed to send notification")
  }
}))

module.exports = router;