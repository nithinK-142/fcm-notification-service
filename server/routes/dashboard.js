const { Router } = require("express");
const { getModels } = require("../models/models.js");
const { CustomError } = require("../util/custom-error.js");
const { routeHandler } = require("../middleware/request.middleware.js");

const router = Router();
const { Product, Notification, Recipient } = getModels();

router.get("/stats", routeHandler(async (req, res) => {
  try {
    const [
      totalProducts,
      activeProducts,
      totalNotifications,
      sentNotifications,
      totalRecipients,
      updatedToday,
      recentNotifications,
      recentProducts,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ product_status: "Active", avl_stock: { $gt: 0 } }),
      Notification.countDocuments(),
      Notification.countDocuments({ status: "done" }),
      Recipient.countDocuments(),
      Recipient.countDocuments({
        updated_at: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),

      Notification.find()
        .sort({ created_at: -1 })
        .limit(5)
        .select("product.name product.image_url body status priority sent_count created_at"),

      Product
        .find({
          cmt_approver_status: "Accepted",
          cmt_approver_status_listing: "Accepted",
          product_status: "Active",
          avl_stock: { $gt: 0 },
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("product_name product_main_image_file_name listing_price product_status grade brand_name createdAt"),
    ]);

    return res.success({
      totalProducts,
      activeProducts,
      totalNotifications,
      sentNotifications,
      totalRecipients,
      updatedToday,
      recentNotifications: recentNotifications.map((n) => ({
        id: n._id,
        title: n.product?.name,
        imageUrl: n.product?.image_url,
        body: n.body,
        status: n.status,
        priority: n.priority,
        sentCount: n.sent_count,
        createdAt: n.created_at,
      })),
      recentProducts: recentProducts.map((p) => ({
        id: p._id,
        name: p.product_name,
        imageUrl: p.product_main_image_file_name,
        price: p.listing_price,
        status: p.product_status,
        grade: p.grade,
        brand: p.brand_name,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof CustomError) throw error
    throw new CustomError(500, "Failed to fetch stats", error)
  }
}));

module.exports = router;